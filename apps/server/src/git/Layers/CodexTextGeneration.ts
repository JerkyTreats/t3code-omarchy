import { randomUUID } from "node:crypto";

import { Effect, FileSystem, Layer, Option, Path, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { sanitizeBranchFragment, sanitizeFeatureBranchName } from "@t3tools/shared/git";

import { resolveAttachmentPath } from "../../attachmentStore.ts";
import { ServerConfig } from "../../config.ts";
import { TextGenerationError } from "../Errors.ts";
import {
  type BranchNameGenerationInput,
  type BranchNameGenerationResult,
  type CommitMessageGenerationResult,
  type PrContentGenerationResult,
  type TextGenerationShape,
  TextGeneration,
} from "../Services/TextGeneration.ts";

const CODEX_MODEL = "gpt-5.3-codex";
const CODEX_REASONING_EFFORT = "low";
const CODEX_TIMEOUT_MS = 180_000;
const AGENTS_FILE_NAME = "AGENTS.md";
const AGENTS_DOC_MAX_CHARS = 6_000;
const AGENTS_TOTAL_MAX_CHARS = 12_000;

interface CommitGuidanceDocument {
  readonly path: string;
  readonly content: string;
}

function toCodexOutputJsonSchema(schema: Schema.Top): unknown {
  const document = Schema.toJsonSchemaDocument(schema);
  if (document.definitions && Object.keys(document.definitions).length > 0) {
    return {
      ...document.schema,
      $defs: document.definitions,
    };
  }
  return document.schema;
}

function normalizeCodexError(
  operation: string,
  error: unknown,
  fallback: string,
): TextGenerationError {
  if (Schema.is(TextGenerationError)(error)) {
    return error;
  }

  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (
      error.message.includes("Command not found: codex") ||
      lower.includes("spawn codex") ||
      lower.includes("enoent")
    ) {
      return new TextGenerationError({
        operation,
        detail: "Codex CLI (`codex`) is required but not available on PATH.",
        cause: error,
      });
    }
    return new TextGenerationError({
      operation,
      detail: `${fallback}: ${error.message}`,
      cause: error,
    });
  }

  return new TextGenerationError({
    operation,
    detail: fallback,
    cause: error,
  });
}

function limitSection(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const truncated = value.slice(0, maxChars);
  return `${truncated}\n\n[truncated]`;
}

function uniqueStrings(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(values)];
}

function collectMarkdownPathsFromLine(line: string): ReadonlyArray<string> {
  const matches: string[] = [];

  for (const match of line.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g)) {
    const value = match[1]?.trim();
    if (value) {
      matches.push(value);
    }
  }

  for (const match of line.matchAll(/`([^`]+\.md)`/g)) {
    const value = match[1]?.trim();
    if (value) {
      matches.push(value);
    }
  }

  return uniqueStrings(matches);
}

function buildCommitGuidancePromptSection(
  documents: ReadonlyArray<CommitGuidanceDocument>,
): ReadonlyArray<string> {
  if (documents.length === 0) {
    return [
      "Local commit guidance:",
      "- No AGENTS.md commit guidance was found for this cwd.",
      "- Do not assume the repository uses conventional commits unless local guidance says so.",
    ];
  }

  return [
    "Local commit guidance discovered from AGENTS.md:",
    "- Follow commit-specific instructions from these files when present.",
    "- If the guidance does not define a format, use a concise repo-neutral message.",
    "- Do not assume the repository uses conventional commits unless local guidance says so.",
    "",
    ...documents.flatMap((document) => [
      `File: ${document.path}`,
      limitSection(document.content, AGENTS_DOC_MAX_CHARS),
      "",
    ]),
  ];
}

function sanitizeCommitSubject(raw: string): string {
  const singleLine = raw.trim().split(/\r?\n/g)[0]?.trim() ?? "";
  const withoutTrailingPeriod = singleLine.replace(/[.]+$/g, "").trim();
  if (withoutTrailingPeriod.length === 0) {
    return "Update project files";
  }

  if (withoutTrailingPeriod.length <= 72) {
    return withoutTrailingPeriod;
  }
  return withoutTrailingPeriod.slice(0, 72).trimEnd();
}

function sanitizePrTitle(raw: string): string {
  const singleLine = raw.trim().split(/\r?\n/g)[0]?.trim() ?? "";
  if (singleLine.length > 0) {
    return singleLine;
  }
  return "Update project changes";
}

const makeCodexTextGeneration = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const commandSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const serverConfig = yield* Effect.service(ServerConfig);

  type MaterializedImageAttachments = {
    readonly imagePaths: ReadonlyArray<string>;
  };

  const readStreamAsString = <E>(
    operation: string,
    stream: Stream.Stream<Uint8Array, E>,
  ): Effect.Effect<string, TextGenerationError> =>
    Effect.gen(function* () {
      let text = "";
      yield* Stream.runForEach(stream, (chunk) =>
        Effect.sync(() => {
          text += Buffer.from(chunk).toString("utf8");
        }),
      ).pipe(
        Effect.mapError((cause) =>
          normalizeCodexError(operation, cause, "Failed to collect process output"),
        ),
      );
      return text;
    });

  const tempDir = process.env.TMPDIR ?? process.env.TEMP ?? process.env.TMP ?? "/tmp";

  const writeTempFile = (
    operation: string,
    prefix: string,
    content: string,
  ): Effect.Effect<string, TextGenerationError> => {
    const filePath = path.join(tempDir, `t3code-${prefix}-${process.pid}-${randomUUID()}.tmp`);
    return fileSystem.writeFileString(filePath, content).pipe(
      Effect.mapError(
        (cause) =>
          new TextGenerationError({
            operation,
            detail: `Failed to write temp file at ${filePath}.`,
            cause,
          }),
      ),
      Effect.as(filePath),
    );
  };

  const safeUnlink = (filePath: string): Effect.Effect<void, never> =>
    fileSystem.remove(filePath).pipe(Effect.catch(() => Effect.void));

  const loadCommitGuidanceDocuments = (
    cwd: string,
  ): Effect.Effect<ReadonlyArray<CommitGuidanceDocument>, TextGenerationError> =>
    Effect.gen(function* () {
      const resolvedCwd = path.resolve(cwd);
      const directories: string[] = [];
      let current = resolvedCwd;
      while (true) {
        directories.push(current);
        const parent = path.dirname(current);
        if (parent === current) {
          break;
        }
        current = parent;
      }

      const discoveredDocuments: CommitGuidanceDocument[] = [];
      const seenPaths = new Set<string>();
      let totalChars = 0;

      const addDocument = (filePath: string): Effect.Effect<void, TextGenerationError> =>
        Effect.gen(function* () {
          const normalizedPath = path.normalize(filePath);
          if (seenPaths.has(normalizedPath) || totalChars >= AGENTS_TOTAL_MAX_CHARS) {
            return;
          }

          const exists = yield* fileSystem
            .exists(normalizedPath)
            .pipe(Effect.orElseSucceed(() => false));
          if (!exists) {
            return;
          }

          const content = yield* fileSystem.readFileString(normalizedPath).pipe(
            Effect.mapError(
              (cause) =>
                new TextGenerationError({
                  operation: "generateCommitMessage",
                  detail: `Failed to read local guidance file at ${normalizedPath}.`,
                  cause,
                }),
            ),
          );

          const remainingChars = AGENTS_TOTAL_MAX_CHARS - totalChars;
          if (remainingChars <= 0) {
            return;
          }

          const limitedContent = limitSection(
            content,
            Math.min(AGENTS_DOC_MAX_CHARS, remainingChars),
          );
          discoveredDocuments.push({ path: normalizedPath, content: limitedContent });
          seenPaths.add(normalizedPath);
          totalChars += limitedContent.length;
        });

      for (const directory of directories) {
        const agentsPath = path.join(directory, AGENTS_FILE_NAME);
        const exists = yield* fileSystem.exists(agentsPath).pipe(Effect.orElseSucceed(() => false));
        if (!exists) {
          continue;
        }

        yield* addDocument(agentsPath);
        if (totalChars >= AGENTS_TOTAL_MAX_CHARS) {
          break;
        }

        const agentsContent =
          discoveredDocuments.at(-1)?.path === path.normalize(agentsPath)
            ? (discoveredDocuments.at(-1)?.content ?? "")
            : "";

        for (const line of agentsContent.split(/\r?\n/g)) {
          if (!/commit|amend|git commit/i.test(line)) {
            continue;
          }

          for (const relativeDocPath of collectMarkdownPathsFromLine(line)) {
            if (/^(https?:|file:)/i.test(relativeDocPath)) {
              continue;
            }
            const resolvedDocPath = path.resolve(path.join(directory, relativeDocPath));
            yield* addDocument(resolvedDocPath);
            if (totalChars >= AGENTS_TOTAL_MAX_CHARS) {
              break;
            }
          }
          if (totalChars >= AGENTS_TOTAL_MAX_CHARS) {
            break;
          }
        }
      }

      return discoveredDocuments;
    });

  const materializeImageAttachments = (
    _operation: "generateCommitMessage" | "generatePrContent" | "generateBranchName",
    attachments: BranchNameGenerationInput["attachments"],
  ): Effect.Effect<MaterializedImageAttachments, TextGenerationError> =>
    Effect.gen(function* () {
      if (!attachments || attachments.length === 0) {
        return { imagePaths: [] };
      }

      const imagePaths: string[] = [];
      for (const attachment of attachments) {
        if (attachment.type !== "image") {
          continue;
        }

        const resolvedPath = resolveAttachmentPath({
          stateDir: serverConfig.stateDir,
          attachment,
        });
        if (!resolvedPath || !path.isAbsolute(resolvedPath)) {
          continue;
        }
        const fileInfo = yield* fileSystem
          .stat(resolvedPath)
          .pipe(Effect.catch(() => Effect.succeed(null)));
        if (!fileInfo || fileInfo.type !== "File") {
          continue;
        }
        imagePaths.push(resolvedPath);
      }
      return { imagePaths };
    });

  const runCodexJson = <S extends Schema.Top>({
    operation,
    cwd,
    prompt,
    outputSchemaJson,
    imagePaths = [],
    cleanupPaths = [],
  }: {
    operation: "generateCommitMessage" | "generatePrContent" | "generateBranchName";
    cwd: string;
    prompt: string;
    outputSchemaJson: S;
    imagePaths?: ReadonlyArray<string>;
    cleanupPaths?: ReadonlyArray<string>;
  }): Effect.Effect<S["Type"], TextGenerationError, S["DecodingServices"]> =>
    Effect.gen(function* () {
      const schemaPath = yield* writeTempFile(
        operation,
        "codex-schema",
        JSON.stringify(toCodexOutputJsonSchema(outputSchemaJson)),
      );
      const outputPath = yield* writeTempFile(operation, "codex-output", "");

      const runCodexCommand = Effect.gen(function* () {
        const command = ChildProcess.make(
          "codex",
          [
            "exec",
            "-s",
            "read-only",
            "--model",
            CODEX_MODEL,
            "--config",
            `model_reasoning_effort="${CODEX_REASONING_EFFORT}"`,
            "--output-schema",
            schemaPath,
            "--output-last-message",
            outputPath,
            ...imagePaths.flatMap((imagePath) => ["--image", imagePath]),
            "-",
          ],
          {
            cwd,
            shell: process.platform === "win32",
            stdin: {
              stream: Stream.make(new TextEncoder().encode(prompt)),
            },
          },
        );

        const child = yield* commandSpawner
          .spawn(command)
          .pipe(
            Effect.mapError((cause) =>
              normalizeCodexError(operation, cause, "Failed to spawn Codex CLI process"),
            ),
          );

        const [stdout, stderr, exitCode] = yield* Effect.all(
          [
            readStreamAsString(operation, child.stdout),
            readStreamAsString(operation, child.stderr),
            child.exitCode.pipe(
              Effect.map((value) => Number(value)),
              Effect.mapError((cause) =>
                normalizeCodexError(operation, cause, "Failed to read Codex CLI exit code"),
              ),
            ),
          ],
          { concurrency: "unbounded" },
        );

        if (exitCode !== 0) {
          const stderrDetail = stderr.trim();
          const stdoutDetail = stdout.trim();
          const detail = stderrDetail.length > 0 ? stderrDetail : stdoutDetail;
          return yield* new TextGenerationError({
            operation,
            detail:
              detail.length > 0
                ? `Codex CLI command failed: ${detail}`
                : `Codex CLI command failed with code ${exitCode}.`,
          });
        }
      });

      const cleanup = Effect.all(
        [schemaPath, outputPath, ...cleanupPaths].map((filePath) => safeUnlink(filePath)),
        {
          concurrency: "unbounded",
        },
      ).pipe(Effect.asVoid);

      return yield* Effect.gen(function* () {
        yield* runCodexCommand.pipe(
          Effect.scoped,
          Effect.timeoutOption(CODEX_TIMEOUT_MS),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(
                  new TextGenerationError({ operation, detail: "Codex CLI request timed out." }),
                ),
              onSome: () => Effect.void,
            }),
          ),
        );

        return yield* fileSystem.readFileString(outputPath).pipe(
          Effect.mapError(
            (cause) =>
              new TextGenerationError({
                operation,
                detail: "Failed to read Codex output file.",
                cause,
              }),
          ),
          Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(outputSchemaJson))),
          Effect.catchTag("SchemaError", (cause) =>
            Effect.fail(
              new TextGenerationError({
                operation,
                detail: "Codex returned invalid structured output.",
                cause,
              }),
            ),
          ),
        );
      }).pipe(Effect.ensuring(cleanup));
    });

  const generateCommitMessage: TextGenerationShape["generateCommitMessage"] = (input) => {
    return Effect.gen(function* () {
      const wantsBranch = input.includeBranch === true;
      const commitGuidanceDocs = yield* loadCommitGuidanceDocuments(input.cwd);

      const prompt = [
        "You write concise git commit messages.",
        wantsBranch
          ? "Return a JSON object with keys: subject, body, branch."
          : "Return a JSON object with keys: subject, body.",
        "Rules:",
        "- subject must be imperative, <= 72 chars, and no trailing period",
        "- body can be empty string or short bullet points",
        ...(wantsBranch
          ? ["- branch must be a short semantic git branch fragment for this change"]
          : []),
        "- capture the primary user-visible or developer-visible change",
        ...buildCommitGuidancePromptSection(commitGuidanceDocs),
        "",
        `Branch: ${input.branch ?? "(detached)"}`,
        "",
        "Staged files:",
        limitSection(input.stagedSummary, 6_000),
        "",
        "Staged patch:",
        limitSection(input.stagedPatch, 40_000),
      ].join("\n");

      const outputSchemaJson = wantsBranch
        ? Schema.Struct({
            subject: Schema.String,
            body: Schema.String,
            branch: Schema.String,
          })
        : Schema.Struct({
            subject: Schema.String,
            body: Schema.String,
          });

      const generated = yield* runCodexJson({
        operation: "generateCommitMessage",
        cwd: input.cwd,
        prompt,
        outputSchemaJson,
      });

      return {
        subject: sanitizeCommitSubject(generated.subject),
        body: generated.body.trim(),
        ...("branch" in generated && typeof generated.branch === "string"
          ? { branch: sanitizeFeatureBranchName(generated.branch) }
          : {}),
      } satisfies CommitMessageGenerationResult;
    });
  };

  const generatePrContent: TextGenerationShape["generatePrContent"] = (input) => {
    const prompt = [
      "You write GitHub pull request content.",
      "Return a JSON object with keys: title, body.",
      "Rules:",
      "- title should be concise and specific",
      "- body must be markdown and include headings '## Summary' and '## Testing'",
      "- under Summary, provide short bullet points",
      "- under Testing, include bullet points with concrete checks or 'Not run' where appropriate",
      "",
      `Base branch: ${input.baseBranch}`,
      `Head branch: ${input.headBranch}`,
      "",
      "Commits:",
      limitSection(input.commitSummary, 12_000),
      "",
      "Diff stat:",
      limitSection(input.diffSummary, 12_000),
      "",
      "Diff patch:",
      limitSection(input.diffPatch, 40_000),
    ].join("\n");

    return runCodexJson({
      operation: "generatePrContent",
      cwd: input.cwd,
      prompt,
      outputSchemaJson: Schema.Struct({
        title: Schema.String,
        body: Schema.String,
      }),
    }).pipe(
      Effect.map(
        (generated) =>
          ({
            title: sanitizePrTitle(generated.title),
            body: generated.body.trim(),
          }) satisfies PrContentGenerationResult,
      ),
    );
  };

  const generateBranchName: TextGenerationShape["generateBranchName"] = (input) => {
    return Effect.gen(function* () {
      const { imagePaths } = yield* materializeImageAttachments(
        "generateBranchName",
        input.attachments,
      );
      const attachmentLines = (input.attachments ?? []).map(
        (attachment) =>
          `- ${attachment.name} (${attachment.mimeType}, ${attachment.sizeBytes} bytes)`,
      );

      const promptSections = [
        "You generate concise git branch names.",
        "Return a JSON object with key: branch.",
        "Rules:",
        "- Branch should describe the requested work from the user message.",
        "- Keep it short and specific (2-6 words).",
        "- Use plain words only, no issue prefixes and no punctuation-heavy text.",
        "- If images are attached, use them as primary context for visual/UI issues.",
        "",
        "User message:",
        limitSection(input.message, 8_000),
      ];
      if (attachmentLines.length > 0) {
        promptSections.push(
          "",
          "Attachment metadata:",
          limitSection(attachmentLines.join("\n"), 4_000),
        );
      }
      const prompt = promptSections.join("\n");

      const generated = yield* runCodexJson({
        operation: "generateBranchName",
        cwd: input.cwd,
        prompt,
        outputSchemaJson: Schema.Struct({
          branch: Schema.String,
        }),
        imagePaths,
      });

      return {
        branch: sanitizeBranchFragment(generated.branch),
      } satisfies BranchNameGenerationResult;
    });
  };

  return {
    generateCommitMessage,
    generatePrContent,
    generateBranchName,
  } satisfies TextGenerationShape;
});

export const CodexTextGenerationLive = Layer.effect(TextGeneration, makeCodexTextGeneration);
