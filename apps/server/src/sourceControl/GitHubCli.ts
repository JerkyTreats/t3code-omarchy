import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";

import {
  PositiveInt,
  TrimmedNonEmptyString,
  type GitHubCreateIssueInput,
  type GitHubCreateIssueResult,
  type GitHubIssue,
  type GitHubIssueMutationInput,
  type GitHubIssueMutationResult,
  type GitHubListIssuesInput,
  type GitHubListIssuesResult,
  type GitHubLoginInput,
  type GitHubStatusInput,
  type GitHubStatusResult,
  type SourceControlRepositoryVisibility,
  type VcsError,
} from "@t3tools/contracts";

import * as VcsProcess from "../vcs/VcsProcess.ts";
import * as GitHubPullRequests from "./gitHubPullRequests.ts";

const DEFAULT_TIMEOUT_MS = 30_000;

export class GitHubCliError extends Schema.TaggedErrorClass<GitHubCliError>()("GitHubCliError", {
  operation: Schema.String,
  detail: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {
  override get message(): string {
    return `GitHub CLI failed in ${this.operation}: ${this.detail}`;
  }
}

export interface GitHubPullRequestSummary {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly baseRefName: string;
  readonly headRefName: string;
  readonly state?: "open" | "closed" | "merged";
  readonly isCrossRepository?: boolean;
  readonly headRepositoryNameWithOwner?: string | null;
  readonly headRepositoryOwnerLogin?: string | null;
}

export interface GitHubRepositoryCloneUrls {
  readonly nameWithOwner: string;
  readonly url: string;
  readonly sshUrl: string;
}

export interface GitHubCliShape {
  readonly execute: (input: {
    readonly cwd: string;
    readonly args: ReadonlyArray<string>;
    readonly timeoutMs?: number;
  }) => Effect.Effect<VcsProcess.VcsProcessOutput, GitHubCliError>;

  readonly listOpenPullRequests: (input: {
    readonly cwd: string;
    readonly headSelector: string;
    readonly limit?: number;
  }) => Effect.Effect<ReadonlyArray<GitHubPullRequestSummary>, GitHubCliError>;

  readonly getPullRequest: (input: {
    readonly cwd: string;
    readonly reference: string;
  }) => Effect.Effect<GitHubPullRequestSummary, GitHubCliError>;

  readonly getRepositoryCloneUrls: (input: {
    readonly cwd: string;
    readonly repository: string;
  }) => Effect.Effect<GitHubRepositoryCloneUrls, GitHubCliError>;

  readonly createRepository: (input: {
    readonly cwd: string;
    readonly repository: string;
    readonly visibility: SourceControlRepositoryVisibility;
  }) => Effect.Effect<GitHubRepositoryCloneUrls, GitHubCliError>;

  readonly createPullRequest: (input: {
    readonly cwd: string;
    readonly baseBranch: string;
    readonly headSelector: string;
    readonly title: string;
    readonly bodyFile: string;
  }) => Effect.Effect<void, GitHubCliError>;

  readonly getDefaultBranch: (input: {
    readonly cwd: string;
  }) => Effect.Effect<string | null, GitHubCliError>;

  readonly checkoutPullRequest: (input: {
    readonly cwd: string;
    readonly reference: string;
    readonly force?: boolean;
  }) => Effect.Effect<void, GitHubCliError>;

  readonly getStatus: (
    input: GitHubStatusInput,
  ) => Effect.Effect<GitHubStatusResult, GitHubCliError>;

  readonly login: (input: GitHubLoginInput) => Effect.Effect<GitHubStatusResult, GitHubCliError>;

  readonly listIssues: (
    input: GitHubListIssuesInput,
  ) => Effect.Effect<GitHubListIssuesResult, GitHubCliError>;

  readonly createIssue: (
    input: GitHubCreateIssueInput,
  ) => Effect.Effect<GitHubCreateIssueResult, GitHubCliError>;

  readonly closeIssue: (
    input: GitHubIssueMutationInput,
  ) => Effect.Effect<GitHubIssueMutationResult, GitHubCliError>;

  readonly reopenIssue: (
    input: GitHubIssueMutationInput,
  ) => Effect.Effect<GitHubIssueMutationResult, GitHubCliError>;
}

export class GitHubCli extends Context.Service<GitHubCli, GitHubCliShape>()(
  "t3/source-control/GitHubCli",
) {}

function errorText(error: VcsError | unknown): string {
  if (typeof error === "object" && error !== null) {
    const tag = "_tag" in error && typeof error._tag === "string" ? error._tag : "";
    const detail = "detail" in error && typeof error.detail === "string" ? error.detail : "";
    const message = "message" in error && typeof error.message === "string" ? error.message : "";
    return [tag, detail, message].filter(Boolean).join("\n");
  }

  return String(error);
}

function normalizeGitHubCliError(
  operation: "execute" | "stdout",
  error: VcsError | unknown,
): GitHubCliError {
  const text = errorText(error);
  const lower = text.toLowerCase();

  if (lower.includes("command not found: gh") || lower.includes("enoent")) {
    return new GitHubCliError({
      operation,
      detail: "GitHub CLI (`gh`) is required but not available on PATH.",
      cause: error,
    });
  }

  if (
    lower.includes("authentication failed") ||
    lower.includes("not logged in") ||
    lower.includes("gh auth login") ||
    lower.includes("no oauth token")
  ) {
    return new GitHubCliError({
      operation,
      detail: "GitHub CLI is not authenticated. Run `gh auth login` and retry.",
      cause: error,
    });
  }

  if (
    lower.includes("could not resolve to a pullrequest") ||
    lower.includes("repository.pullrequest") ||
    lower.includes("no pull requests found for branch") ||
    lower.includes("pull request not found")
  ) {
    return new GitHubCliError({
      operation,
      detail: "Pull request not found. Check the PR number or URL and try again.",
      cause: error,
    });
  }

  return new GitHubCliError({
    operation,
    detail: text,
    cause: error,
  });
}

const RawGitHubRepositoryCloneUrlsSchema = Schema.Struct({
  nameWithOwner: TrimmedNonEmptyString,
  url: TrimmedNonEmptyString,
  sshUrl: TrimmedNonEmptyString,
});

const RawGitHubRepositorySchema = Schema.Struct({
  nameWithOwner: TrimmedNonEmptyString,
  url: TrimmedNonEmptyString,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  defaultBranchRef: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        name: TrimmedNonEmptyString,
      }),
    ),
  ),
});

const RawGitHubAuthHostEntrySchema = Schema.Struct({
  state: Schema.optional(Schema.NullOr(Schema.String)),
  active: Schema.optional(Schema.Boolean),
  host: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  login: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  tokenSource: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
  scopes: Schema.optional(Schema.NullOr(Schema.String)),
  gitProtocol: Schema.optional(Schema.NullOr(Schema.String)),
});

const RawGitHubAuthStatusSchema = Schema.Struct({
  hosts: Schema.Record(Schema.String, Schema.Array(RawGitHubAuthHostEntrySchema)),
});

const RawGitHubIssueLabelSchema = Schema.Struct({
  name: TrimmedNonEmptyString,
  color: Schema.optional(Schema.NullOr(TrimmedNonEmptyString)),
});

const RawGitHubIssueAssigneeSchema = Schema.Struct({
  login: TrimmedNonEmptyString,
});

const RawGitHubIssueAuthorSchema = Schema.Struct({
  login: TrimmedNonEmptyString,
});

const RawGitHubIssueSchema = Schema.Struct({
  number: PositiveInt,
  title: TrimmedNonEmptyString,
  state: TrimmedNonEmptyString,
  url: TrimmedNonEmptyString,
  body: Schema.optional(Schema.NullOr(Schema.String)),
  createdAt: TrimmedNonEmptyString,
  updatedAt: TrimmedNonEmptyString,
  labels: Schema.Array(RawGitHubIssueLabelSchema),
  assignees: Schema.Array(RawGitHubIssueAssigneeSchema),
  author: Schema.optional(Schema.NullOr(RawGitHubIssueAuthorSchema)),
});

function normalizeRepositoryCloneUrls(
  raw: Schema.Schema.Type<typeof RawGitHubRepositoryCloneUrlsSchema>,
): GitHubRepositoryCloneUrls {
  return {
    nameWithOwner: raw.nameWithOwner,
    url: raw.url,
    sshUrl: raw.sshUrl,
  };
}

function normalizeRepository(raw: Schema.Schema.Type<typeof RawGitHubRepositorySchema>) {
  return {
    nameWithOwner: raw.nameWithOwner,
    url: raw.url,
    description: raw.description ?? null,
    defaultBranch: raw.defaultBranchRef?.name ?? null,
  };
}

function normalizeIssueState(state: string): "open" | "closed" {
  return state.toUpperCase() === "CLOSED" ? "closed" : "open";
}

function normalizeIssue(raw: Schema.Schema.Type<typeof RawGitHubIssueSchema>): GitHubIssue {
  return {
    number: raw.number,
    title: raw.title,
    state: normalizeIssueState(raw.state),
    url: raw.url,
    body: raw.body ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    labels: raw.labels.map((label) => ({
      name: label.name,
      color: label.color ?? null,
    })),
    assignees: raw.assignees.map((assignee) => ({
      login: assignee.login,
    })),
    author: raw.author?.login ?? null,
  };
}

function splitScopes(raw: string | null | undefined): ReadonlyArray<string> {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeGitProtocol(raw: string | null | undefined): "https" | "ssh" | null {
  return raw === "https" || raw === "ssh" ? raw : null;
}

function resolveCommandCwd(cwd: string | null | undefined): string {
  return cwd ?? process.cwd();
}

function buildRepoFlag(repository: string | undefined): Array<string> {
  return repository ? ["--repo", repository] : [];
}

function parseGitRemoteNames(raw: string): ReadonlyArray<string> {
  return raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseRemoteHostAndPath(remoteUrl: string): { host: string; path: string } | null {
  const trimmed = remoteUrl.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.startsWith("git@")) {
    const hostWithPath = trimmed.slice("git@".length);
    const separatorIndex = hostWithPath.search(/[:/]/);
    if (separatorIndex <= 0) return null;
    return {
      host: hostWithPath.slice(0, separatorIndex).toLowerCase(),
      path: hostWithPath.slice(separatorIndex + 1),
    };
  }

  try {
    const parsed = new URL(trimmed);
    return {
      host: parsed.hostname.toLowerCase(),
      path: parsed.pathname.replace(/^\/+/, ""),
    };
  } catch {
    return null;
  }
}

function parseGitHubRepositoryFromRemoteUrl(remoteUrl: string, hostname: string): string | null {
  const parsed = parseRemoteHostAndPath(remoteUrl);
  if (!parsed || parsed.host !== hostname.toLowerCase()) return null;

  const path = parsed.path.replace(/\/+$/, "").replace(/\.git$/i, "");
  const segments = path.split("/").filter((segment) => segment.length > 0);
  const owner = segments[0];
  const repo = segments[1];
  return owner && repo ? `${owner}/${repo}` : null;
}

/**
 * `gh repo create` prints the canonical URL of the new repository on stdout
 * (e.g. `https://github.com/owner/repo`). Reading it back here avoids a
 * follow-up `gh repo view`, which can race GitHub's GraphQL eventual
 * consistency window and falsely report the just-created repo as missing.
 */
function deriveRepositoryCloneUrlsFromCreateOutput(
  stdout: string,
  repository: string,
): GitHubRepositoryCloneUrls {
  const fallbackHost = "github.com";
  const match = stdout.match(/https?:\/\/[^\s]+/);
  if (match) {
    const cleaned = match[0].replace(/\.git$/, "");
    try {
      const parsed = new URL(cleaned);
      const pathname = parsed.pathname.replace(/^\/+|\/+$/g, "");
      const segments = pathname.split("/").filter(Boolean);
      if (segments.length === 2) {
        const nameWithOwner = `${segments[0]}/${segments[1]}`;
        return {
          nameWithOwner,
          url: `${parsed.origin}/${nameWithOwner}`,
          sshUrl: `git@${parsed.host}:${nameWithOwner}.git`,
        };
      }
    } catch {
      // Fall through to the input-derived defaults below.
    }
  }
  return {
    nameWithOwner: repository,
    url: `https://${fallbackHost}/${repository}`,
    sshUrl: `git@${fallbackHost}:${repository}.git`,
  };
}

function decodeGitHubJson<S extends Schema.Top>(
  raw: string,
  schema: S,
  operation:
    | "listOpenPullRequests"
    | "getPullRequest"
    | "getRepositoryCloneUrls"
    | "getStatus"
    | "listIssues"
    | "readRepository"
    | "readIssue",
  invalidDetail: string,
): Effect.Effect<S["Type"], GitHubCliError, S["DecodingServices"]> {
  return Schema.decodeEffect(Schema.fromJsonString(schema))(raw).pipe(
    Effect.mapError(
      (error) =>
        new GitHubCliError({
          operation,
          detail: `${invalidDetail}: ${SchemaIssue.makeFormatterDefault()(error.issue)}`,
          cause: error,
        }),
    ),
  );
}

export const make = Effect.fn("makeGitHubCli")(function* () {
  const process = yield* VcsProcess.VcsProcess;

  const execute: GitHubCliShape["execute"] = (input) =>
    process
      .run({
        operation: "GitHubCli.execute",
        command: "gh",
        args: input.args,
        cwd: input.cwd,
        timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      })
      .pipe(Effect.mapError((error) => normalizeGitHubCliError("execute", error)));

  const runGitStdout = (input: { cwd: string | null; args: ReadonlyArray<string> }) =>
    process
      .run({
        operation: "GitHubCli.git",
        command: "git",
        args: input.args,
        cwd: resolveCommandCwd(input.cwd),
        allowNonZeroExit: true,
      })
      .pipe(
        Effect.map((result) => (result.exitCode === 0 ? result.stdout.trim() : "")),
        Effect.catch(() => Effect.succeed("")),
      );

  const resolveRepositoryArg = Effect.fn("GitHubCli.resolveRepositoryArg")(function* (input: {
    cwd: string | null;
    repository?: string;
    hostname?: string;
  }) {
    const explicitRepository = input.repository?.trim();
    if (explicitRepository) return explicitRepository;
    if (!input.cwd) return undefined;

    const hostname = input.hostname ?? "github.com";
    const currentBranch = yield* runGitStdout({
      cwd: input.cwd,
      args: ["branch", "--show-current"],
    });
    const branchPushRemote =
      currentBranch.length > 0
        ? yield* runGitStdout({
            cwd: input.cwd,
            args: ["config", "--get", `branch.${currentBranch}.pushRemote`],
          })
        : "";
    const remotePushDefault = yield* runGitStdout({
      cwd: input.cwd,
      args: ["config", "--get", "remote.pushDefault"],
    });
    const remoteNames = parseGitRemoteNames(
      yield* runGitStdout({
        cwd: input.cwd,
        args: ["remote"],
      }),
    );
    const preferredRemoteName =
      branchPushRemote ||
      remotePushDefault ||
      (remoteNames.includes("origin") ? "origin" : (remoteNames[0] ?? ""));
    if (!preferredRemoteName) return undefined;

    const remoteUrl = yield* runGitStdout({
      cwd: input.cwd,
      args: ["remote", "get-url", preferredRemoteName],
    });
    return parseGitHubRepositoryFromRemoteUrl(remoteUrl, hostname) ?? undefined;
  });

  const readRepository = (input: { cwd: string | null; repository?: string; hostname?: string }) =>
    resolveRepositoryArg(input).pipe(
      Effect.flatMap((repository) =>
        execute({
          cwd: resolveCommandCwd(input.cwd),
          args: [
            "repo",
            "view",
            ...(repository ? [repository] : []),
            "--json",
            "nameWithOwner,url,description,defaultBranchRef",
          ],
        }),
      ),
      Effect.map((result) => result.stdout.trim()),
      Effect.flatMap((raw) =>
        decodeGitHubJson(
          raw,
          RawGitHubRepositorySchema,
          "readRepository",
          "GitHub CLI returned invalid repository JSON.",
        ),
      ),
      Effect.map(normalizeRepository),
    );

  const readIssue = (input: {
    cwd: string | null;
    repository?: string;
    hostname?: string;
    reference: string;
  }) =>
    resolveRepositoryArg(input).pipe(
      Effect.flatMap((repository) =>
        execute({
          cwd: resolveCommandCwd(input.cwd),
          args: [
            "issue",
            "view",
            input.reference,
            ...buildRepoFlag(repository),
            "--json",
            "number,title,state,url,body,createdAt,updatedAt,labels,assignees,author",
          ],
        }),
      ),
      Effect.map((result) => result.stdout.trim()),
      Effect.flatMap((raw) =>
        decodeGitHubJson(
          raw,
          RawGitHubIssueSchema,
          "readIssue",
          "GitHub CLI returned invalid issue JSON.",
        ),
      ),
      Effect.map(normalizeIssue),
    );

  const getStatus: GitHubCliShape["getStatus"] = (input) => {
    const hostname = input.hostname ?? "github.com";
    return execute({
      cwd: resolveCommandCwd(input.cwd),
      args: ["auth", "status", "--hostname", hostname, "--active", "--json", "hosts"],
    }).pipe(
      Effect.map((result) => result.stdout.trim()),
      Effect.flatMap((raw) =>
        decodeGitHubJson(
          raw,
          RawGitHubAuthStatusSchema,
          "getStatus",
          "GitHub CLI returned invalid auth status JSON.",
        ),
      ),
      Effect.flatMap((rawStatus) => {
        const hostEntries = rawStatus.hosts[hostname] ?? [];
        const activeEntry =
          hostEntries.find((entry) => entry.active === true) ?? hostEntries.at(0) ?? null;
        const authenticated =
          activeEntry?.state === "success" && (activeEntry.active ?? true) === true;

        return readRepository({ cwd: input.cwd, hostname }).pipe(
          Effect.catch(() => Effect.succeed(null)),
          Effect.map((repo) => ({
            installed: true,
            authenticated,
            hostname,
            accountLogin: authenticated ? (activeEntry?.login ?? null) : null,
            gitProtocol: authenticated ? normalizeGitProtocol(activeEntry?.gitProtocol) : null,
            tokenSource: authenticated ? (activeEntry?.tokenSource ?? null) : null,
            scopes: authenticated ? Array.from(splitScopes(activeEntry?.scopes)) : [],
            repo: authenticated ? repo : null,
          })),
        );
      }),
      Effect.catch((error) => {
        if (error.detail.includes("required but not available")) {
          return Effect.succeed({
            installed: false,
            authenticated: false,
            hostname,
            accountLogin: null,
            gitProtocol: null,
            tokenSource: null,
            scopes: [],
            repo: null,
          });
        }
        if (error.detail.includes("not authenticated")) {
          return Effect.succeed({
            installed: true,
            authenticated: false,
            hostname,
            accountLogin: null,
            gitProtocol: null,
            tokenSource: null,
            scopes: [],
            repo: null,
          });
        }
        return Effect.fail(error);
      }),
    );
  };

  const login: GitHubCliShape["login"] = (input) =>
    execute({
      cwd: resolveCommandCwd(input.cwd),
      args: [
        "auth",
        "login",
        "--hostname",
        input.hostname ?? "github.com",
        "--git-protocol",
        input.gitProtocol ?? "https",
        "--web",
      ],
      timeoutMs: 5 * 60_000,
    }).pipe(
      Effect.asVoid,
      Effect.flatMap(() => getStatus({ cwd: input.cwd, hostname: input.hostname })),
    );

  return GitHubCli.of({
    execute,
    listOpenPullRequests: (input) =>
      execute({
        cwd: input.cwd,
        args: [
          "pr",
          "list",
          "--head",
          input.headSelector,
          "--state",
          "open",
          "--limit",
          String(input.limit ?? 1),
          "--json",
          "number,title,url,baseRefName,headRefName,state,mergedAt,isCrossRepository,headRepository,headRepositoryOwner",
        ],
      }).pipe(
        Effect.map((result) => result.stdout.trim()),
        Effect.flatMap((raw) =>
          raw.length === 0
            ? Effect.succeed([])
            : Effect.sync(() => GitHubPullRequests.decodeGitHubPullRequestListJson(raw)).pipe(
                Effect.flatMap((decoded) => {
                  if (!Result.isSuccess(decoded)) {
                    return Effect.fail(
                      new GitHubCliError({
                        operation: "listOpenPullRequests",
                        detail: `GitHub CLI returned invalid PR list JSON: ${GitHubPullRequests.formatGitHubJsonDecodeError(decoded.failure)}`,
                        cause: decoded.failure,
                      }),
                    );
                  }

                  return Effect.succeed(
                    decoded.success.map(({ updatedAt: _updatedAt, ...summary }) => summary),
                  );
                }),
              ),
        ),
      ),
    getPullRequest: (input) =>
      execute({
        cwd: input.cwd,
        args: [
          "pr",
          "view",
          input.reference,
          "--json",
          "number,title,url,baseRefName,headRefName,state,mergedAt,isCrossRepository,headRepository,headRepositoryOwner",
        ],
      }).pipe(
        Effect.map((result) => result.stdout.trim()),
        Effect.flatMap((raw) =>
          Effect.sync(() => GitHubPullRequests.decodeGitHubPullRequestJson(raw)).pipe(
            Effect.flatMap((decoded) => {
              if (!Result.isSuccess(decoded)) {
                return Effect.fail(
                  new GitHubCliError({
                    operation: "getPullRequest",
                    detail: `GitHub CLI returned invalid pull request JSON: ${GitHubPullRequests.formatGitHubJsonDecodeError(decoded.failure)}`,
                    cause: decoded.failure,
                  }),
                );
              }

              return Effect.succeed(
                (({ updatedAt: _updatedAt, ...summary }) => summary)(decoded.success),
              );
            }),
          ),
        ),
      ),
    getRepositoryCloneUrls: (input) =>
      execute({
        cwd: input.cwd,
        args: ["repo", "view", input.repository, "--json", "nameWithOwner,url,sshUrl"],
      }).pipe(
        Effect.map((result) => result.stdout.trim()),
        Effect.flatMap((raw) =>
          decodeGitHubJson(
            raw,
            RawGitHubRepositoryCloneUrlsSchema,
            "getRepositoryCloneUrls",
            "GitHub CLI returned invalid repository JSON.",
          ),
        ),
        Effect.map(normalizeRepositoryCloneUrls),
      ),
    createRepository: (input) =>
      execute({
        cwd: input.cwd,
        args: ["repo", "create", input.repository, `--${input.visibility}`],
      }).pipe(
        Effect.map((result) =>
          deriveRepositoryCloneUrlsFromCreateOutput(result.stdout, input.repository),
        ),
      ),
    createPullRequest: (input) =>
      execute({
        cwd: input.cwd,
        args: [
          "pr",
          "create",
          "--base",
          input.baseBranch,
          "--head",
          input.headSelector,
          "--title",
          input.title,
          "--body-file",
          input.bodyFile,
        ],
      }).pipe(Effect.asVoid),
    getDefaultBranch: (input) =>
      execute({
        cwd: input.cwd,
        args: ["repo", "view", "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"],
      }).pipe(
        Effect.map((value) => {
          const trimmed = value.stdout.trim();
          return trimmed.length > 0 ? trimmed : null;
        }),
      ),
    checkoutPullRequest: (input) =>
      execute({
        cwd: input.cwd,
        args: ["pr", "checkout", input.reference, ...(input.force ? ["--force"] : [])],
      }).pipe(Effect.asVoid),
    getStatus,
    login,
    listIssues: (input) =>
      resolveRepositoryArg({ cwd: input.cwd }).pipe(
        Effect.flatMap((repository) =>
          execute({
            cwd: resolveCommandCwd(input.cwd),
            args: [
              "issue",
              "list",
              ...buildRepoFlag(repository),
              ...(input.state ? ["--state", input.state] : []),
              "--limit",
              String(input.limit ?? 20),
              "--json",
              "number,title,state,url,body,createdAt,updatedAt,labels,assignees,author",
            ],
          }).pipe(Effect.map((result) => ({ repository, stdout: result.stdout.trim() }))),
        ),
        Effect.flatMap(({ repository, stdout }) =>
          (stdout.length === 0
            ? Effect.succeed([] as Array<Schema.Schema.Type<typeof RawGitHubIssueSchema>>)
            : decodeGitHubJson(
                stdout,
                Schema.Array(RawGitHubIssueSchema),
                "listIssues",
                "GitHub CLI returned invalid issue list JSON.",
              )
          ).pipe(Effect.map((issues) => ({ repository, issues }))),
        ),
        Effect.flatMap(({ repository, issues }) =>
          readRepository({ cwd: input.cwd, ...(repository ? { repository } : {}) }).pipe(
            Effect.catch(() => Effect.succeed(null)),
            Effect.map((repo) => ({
              repo,
              issues: issues.map(normalizeIssue),
            })),
          ),
        ),
      ),
    createIssue: (input) =>
      resolveRepositoryArg({
        cwd: input.cwd,
        ...(input.repo ? { repository: input.repo } : {}),
      }).pipe(
        Effect.flatMap((repository) =>
          execute({
            cwd: resolveCommandCwd(input.cwd),
            args: [
              "issue",
              "create",
              ...buildRepoFlag(repository),
              "--title",
              input.title,
              "--body",
              input.body ?? "",
            ],
          }).pipe(Effect.map((result) => ({ repository, stdout: result.stdout }))),
        ),
        Effect.map(({ repository, stdout }) => ({
          repository,
          reference: stdout
            .split(/\r?\n/g)
            .map((line) => line.trim())
            .find((line) => line.length > 0),
        })),
        Effect.flatMap(({ repository, reference }) =>
          reference
            ? readIssue({
                cwd: input.cwd,
                ...(repository ? { repository } : {}),
                reference,
              })
            : Effect.fail(
                new GitHubCliError({
                  operation: "createIssue",
                  detail: "GitHub CLI did not return the created issue URL.",
                }),
              ),
        ),
      ),
    closeIssue: (input) =>
      resolveRepositoryArg({
        cwd: input.cwd,
        ...(input.repo ? { repository: input.repo } : {}),
      }).pipe(
        Effect.flatMap((repository) =>
          execute({
            cwd: resolveCommandCwd(input.cwd),
            args: ["issue", "close", String(input.issueNumber), ...buildRepoFlag(repository)],
          }),
        ),
        Effect.as({
          number: input.issueNumber,
          state: "closed" as const,
        }),
      ),
    reopenIssue: (input) =>
      resolveRepositoryArg({
        cwd: input.cwd,
        ...(input.repo ? { repository: input.repo } : {}),
      }).pipe(
        Effect.flatMap((repository) =>
          execute({
            cwd: resolveCommandCwd(input.cwd),
            args: ["issue", "reopen", String(input.issueNumber), ...buildRepoFlag(repository)],
          }),
        ),
        Effect.as({
          number: input.issueNumber,
          state: "open" as const,
        }),
      ),
  });
});

export const layer = Layer.effect(GitHubCli, make());
