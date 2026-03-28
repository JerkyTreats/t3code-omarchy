import { randomUUID } from "node:crypto";

import { Effect, FileSystem, Layer, Option, Path, Schema, Scope, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { CodexModelSelection } from "@t3tools/contracts";
import { sanitizeBranchFragment, sanitizeFeatureBranchName } from "@t3tools/shared/git";

import { resolveAttachmentPath } from "../../attachmentStore.ts";
import { ServerConfig } from "../../config.ts";
import { TextGenerationError } from "../Errors.ts";
import {
  type BranchNameGenerationInput,
  type TextGenerationShape,
  TextGeneration,
} from "../Services/TextGeneration.ts";
import { buildBranchNamePrompt, buildPrContentPrompt } from "../Prompts.ts";
import {
  normalizeCliError,
  sanitizeCommitSubject,
  sanitizePrTitle,
  toJsonSchemaObject,
} from "../Utils.ts";
import { normalizeCodexModelOptions } from "../../provider/Layers/CodexProvider.ts";
import { ServerSettingsService } from "../../serverSettings.ts";

const CODEX_GIT_TEXT_GENERATION_REASONING_EFFORT = "low";
const CODEX_TIMEOUT_MS = 180_000;
const AGENTS_FILE_NAME = "AGENTS.md";
const AGENTS_DOC_MAX_CHARS = 6_000;
const AGENTS_TOTAL_MAX_CHARS = 12_000;

interface CommitGuidanceDocument {
  readonly path: string;
  readonly content: string;
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
const makeCodexTextGeneration = Effect.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const commandSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const serverConfig = yield* Effect.service(ServerConfig);
  const serverSettingsService = yield* Effect.service(ServerSettingsService);

  type MaterializedImageAttachments = {
    readonly imagePaths: ReadonlyArray<string>;
  };

  const readStreamAsString = <E>(
    operation: string,
    stream: Stream.Stream<Uint8Array, E>,
  ): Effect.Effect<string, TextGenerationError> =>
    stream.pipe(
      Stream.decodeText(),
      Stream.runFold(
        () => "",
        (acc, chunk) => acc + chunk,
      ),
      Effect.mapError((cause) =>
        normalizeCliError("codex", operation, cause, "Failed to collect process output"),
      ),
    );

  const writeTempFile = (
    operation: string,
    prefix: string,
    content: string,
  ): Effect.Effect<string, TextGenerationError, Scope.Scope> => {
    return fileSystem
      .makeTempFileScoped({
        prefix: `t3code-${prefix}-${process.pid}-${randomUUID()}.tmp`,
      })
      .pipe(
        Effect.tap((filePath) => fileSystem.writeFileString(filePath, content)),
        Effect.mapError(
          (cause) =>
            new TextGenerationError({
              operation,
              detail: `Failed to write temp file`,
              cause,
            }),
        ),
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
          attachmentsDir: serverConfig.attachmentsDir,
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
    modelSelection,
  }: {
    operation: "generateCommitMessage" | "generatePrContent" | "generateBranchName";
    cwd: string;
    prompt: string;
    outputSchemaJson: S;
    imagePaths?: ReadonlyArray<string>;
    cleanupPaths?: ReadonlyArray<string>;
    modelSelection: CodexModelSelection;
  }): Effect.Effect<S["Type"], TextGenerationError, S["DecodingServices"]> =>
    Effect.gen(function* () {
      const schemaPath = yield* writeTempFile(
        operation,
        "codex-schema",
        JSON.stringify(toJsonSchemaObject(outputSchemaJson)),
      );
      const outputPath = yield* writeTempFile(operation, "codex-output", "");

      const codexSettings = yield* Effect.map(
        serverSettingsService.getSettings,
        (settings) => settings.providers.codex,
      ).pipe(Effect.catch(() => Effect.undefined));

      const runCodexCommand = Effect.gen(function* () {
        const normalizedOptions = normalizeCodexModelOptions(
          modelSelection.model,
          modelSelection.options,
        );
        const reasoningEffort =
          modelSelection.options?.reasoningEffort ?? CODEX_GIT_TEXT_GENERATION_REASONING_EFFORT;
        const command = ChildProcess.make(
          codexSettings?.binaryPath || "codex",
          [
            "exec",
            "--ephemeral",
            "-s",
            "read-only",
            "--model",
            modelSelection.model,
            "--config",
            `model_reasoning_effort="${reasoningEffort}"`,
            ...(normalizedOptions?.fastMode ? ["--config", `service_tier="fast"`] : []),
            "--output-schema",
            schemaPath,
            "--output-last-message",
            outputPath,
            ...imagePaths.flatMap((imagePath) => ["--image", imagePath]),
            "-",
          ],
          {
            env: {
              ...process.env,
              ...(codexSettings?.homePath ? { CODEX_HOME: codexSettings.homePath } : {}),
            },
            cwd,
            shell: process.platform === "win32",
            stdin: {
              stream: Stream.encodeText(Stream.make(prompt)),
            },
          },
        );

        const child = yield* commandSpawner
          .spawn(command)
          .pipe(
            Effect.mapError((cause) =>
              normalizeCliError("codex", operation, cause, "Failed to spawn Codex CLI process"),
            ),
          );

        const [stdout, stderr, exitCode] = yield* Effect.all(
          [
            readStreamAsString(operation, child.stdout),
            readStreamAsString(operation, child.stderr),
            child.exitCode.pipe(
              Effect.mapError((cause) =>
                normalizeCliError("codex", operation, cause, "Failed to read Codex CLI exit code"),
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

  const generateCommitMessage: TextGenerationShape["generateCommitMessage"] = Effect.fn(
    "CodexTextGeneration.generateCommitMessage",
  )(function* (input) {
    const wantsBranch = input.includeBranch === true;
    const commitGuidanceDocs = yield* loadCommitGuidanceDocuments(input.cwd);

    if (input.modelSelection.provider !== "codex") {
      return yield* new TextGenerationError({
        operation: "generateCommitMessage",
        detail: "Invalid model selection.",
      });
    }

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
      modelSelection: input.modelSelection,
    });

    return {
      subject: sanitizeCommitSubject(generated.subject),
      body: generated.body.trim(),
      ...("branch" in generated && typeof generated.branch === "string"
        ? { branch: sanitizeFeatureBranchName(generated.branch) }
        : {}),
    };
  });

  const generatePrContent: TextGenerationShape["generatePrContent"] = Effect.fn(
    "CodexTextGeneration.generatePrContent",
  )(function* (input) {
    const { prompt, outputSchema } = buildPrContentPrompt({
      baseBranch: input.baseBranch,
      headBranch: input.headBranch,
      commitSummary: input.commitSummary,
      diffSummary: input.diffSummary,
      diffPatch: input.diffPatch,
    });

    if (input.modelSelection.provider !== "codex") {
      return yield* new TextGenerationError({
        operation: "generatePrContent",
        detail: "Invalid model selection.",
      });
    }

    const generated = yield* runCodexJson({
      operation: "generatePrContent",
      cwd: input.cwd,
      prompt,
      outputSchemaJson: outputSchema,
      modelSelection: input.modelSelection,
    });

    return {
      title: sanitizePrTitle(generated.title),
      body: generated.body.trim(),
    };
  });

  const generateBranchName: TextGenerationShape["generateBranchName"] = Effect.fn(
    "CodexTextGeneration.generateBranchName",
  )(function* (input) {
    const { imagePaths } = yield* materializeImageAttachments(
      "generateBranchName",
      input.attachments,
    );
    const { prompt, outputSchema } = buildBranchNamePrompt({
      message: input.message,
      attachments: input.attachments,
    });

    if (input.modelSelection.provider !== "codex") {
      return yield* new TextGenerationError({
        operation: "generateBranchName",
        detail: "Invalid model selection.",
      });
    }

    const generated = yield* runCodexJson({
      operation: "generateBranchName",
      cwd: input.cwd,
      prompt,
      outputSchemaJson: outputSchema,
      imagePaths,
      modelSelection: input.modelSelection,
    });

    return {
      branch: sanitizeBranchFragment(generated.branch),
    };
  });

  return {
    generateCommitMessage,
    generatePrContent,
    generateBranchName,
  } satisfies TextGenerationShape;
});

export const CodexTextGenerationLive = Layer.effect(TextGeneration, makeCodexTextGeneration);
