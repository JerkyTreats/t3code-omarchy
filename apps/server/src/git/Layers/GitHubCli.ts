import { Effect, Layer } from "effect";

import { runProcess } from "../../processRunner";
import { GitHubCliError } from "../Errors.ts";
import { GitHubCli, type GitHubCliShape } from "../Services/GitHubCli.ts";

const DEFAULT_TIMEOUT_MS = 30_000;
const LOGIN_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_HOSTNAME = "github.com";

function normalizeGitHubCliError(operation: "execute" | "stdout", error: unknown): GitHubCliError {
  if (error instanceof Error) {
    if (error.message.includes("Command not found: gh")) {
      return new GitHubCliError({
        operation,
        detail: "GitHub CLI (`gh`) is required but not available on PATH.",
        cause: error,
      });
    }

    const lower = error.message.toLowerCase();
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

    return new GitHubCliError({
      operation,
      detail: `GitHub CLI command failed: ${error.message}`,
      cause: error,
    });
  }

  return new GitHubCliError({
    operation,
    detail: "GitHub CLI command failed.",
    cause: error,
  });
}

function parseOpenPullRequests(raw: string): ReadonlyArray<{
  number: number;
  title: string;
  url: string;
  baseRefName: string;
  headRefName: string;
}> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];

  const parsed: unknown = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) {
    throw new Error("GitHub CLI returned non-array JSON.");
  }

  const result: Array<{
    number: number;
    title: string;
    url: string;
    baseRefName: string;
    headRefName: string;
  }> = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const number = record.number;
    const title = record.title;
    const url = record.url;
    const baseRefName = record.baseRefName;
    const headRefName = record.headRefName;
    if (
      typeof number !== "number" ||
      !Number.isInteger(number) ||
      number <= 0 ||
      typeof title !== "string" ||
      typeof url !== "string" ||
      typeof baseRefName !== "string" ||
      typeof headRefName !== "string"
    ) {
      continue;
    }
    result.push({
      number,
      title,
      url,
      baseRefName,
      headRefName,
    });
  }

  return result;
}

function parseAuthStatus(raw: string, hostname: string): {
  state: string;
  active: boolean;
  host: string;
  login: string | null;
  tokenSource: string | null;
  scopes: ReadonlyArray<string>;
  gitProtocol: "https" | "ssh" | null;
} | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const parsed: unknown = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("GitHub CLI returned invalid auth status JSON.");
  }

  const hosts = (parsed as { hosts?: unknown }).hosts;
  if (!hosts || typeof hosts !== "object") {
    return null;
  }

  const accounts = (hosts as Record<string, unknown>)[hostname];
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return null;
  }

  const candidate =
    accounts.find(
      (entry) =>
        entry && typeof entry === "object" && (entry as { active?: unknown }).active === true,
    ) ?? accounts[0];
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const gitProtocol = record.gitProtocol;
  const scopes = record.scopes;

  return {
    state: typeof record.state === "string" ? record.state : "unknown",
    active: record.active === true,
    host: typeof record.host === "string" ? record.host : hostname,
    login: typeof record.login === "string" && record.login.trim().length > 0 ? record.login : null,
    tokenSource:
      typeof record.tokenSource === "string" && record.tokenSource.trim().length > 0
        ? record.tokenSource
        : null,
    scopes:
      typeof scopes === "string"
        ? scopes
            .split(",")
            .map((scope) => scope.trim())
            .filter((scope) => scope.length > 0)
        : [],
    gitProtocol: gitProtocol === "https" || gitProtocol === "ssh" ? gitProtocol : null,
  };
}

function parseRepository(raw: string): {
  nameWithOwner: string;
  url: string;
  description: string | null;
  defaultBranch: string | null;
} | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const parsed: unknown = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("GitHub CLI returned invalid repository JSON.");
  }

  const record = parsed as Record<string, unknown>;
  const nameWithOwner = record.nameWithOwner;
  const url = record.url;
  const description = record.description;
  const defaultBranchRef = record.defaultBranchRef;

  if (typeof nameWithOwner !== "string" || typeof url !== "string") {
    return null;
  }

  let defaultBranch: string | null = null;
  if (defaultBranchRef && typeof defaultBranchRef === "object") {
    const name = (defaultBranchRef as { name?: unknown }).name;
    if (typeof name === "string" && name.trim().length > 0) {
      defaultBranch = name;
    }
  }

  return {
    nameWithOwner,
    url,
    description: typeof description === "string" ? description : null,
    defaultBranch,
  };
}

function parseIssues(raw: string): ReadonlyArray<{
  number: number;
  title: string;
  state: "open" | "closed";
  url: string;
  createdAt: string;
  updatedAt: string;
  labels: ReadonlyArray<{
    name: string;
    color: string | null;
  }>;
  assignees: ReadonlyArray<{
    login: string;
  }>;
  author: string | null;
}> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];

  const parsed: unknown = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) {
    throw new Error("GitHub CLI returned invalid issue list JSON.");
  }

  const issues: Array<{
    number: number;
    title: string;
    state: "open" | "closed";
    url: string;
    createdAt: string;
    updatedAt: string;
    labels: ReadonlyArray<{
      name: string;
      color: string | null;
    }>;
    assignees: ReadonlyArray<{
      login: string;
    }>;
    author: string | null;
  }> = [];

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const state = record.state;
    const number = record.number;
    const title = record.title;
    const url = record.url;
    const createdAt = record.createdAt;
    const updatedAt = record.updatedAt;

    if (
      typeof number !== "number" ||
      !Number.isInteger(number) ||
      number <= 0 ||
      typeof title !== "string" ||
      typeof url !== "string" ||
      typeof createdAt !== "string" ||
      typeof updatedAt !== "string"
    ) {
      continue;
    }

    const normalizedState = state === "CLOSED" ? "closed" : state === "OPEN" ? "open" : null;
    if (!normalizedState) {
      continue;
    }

    const labels = Array.isArray(record.labels)
      ? record.labels
          .flatMap((label) => {
            if (!label || typeof label !== "object") {
              return [];
            }
            const labelRecord = label as Record<string, unknown>;
            const name = labelRecord.name;
            const color = labelRecord.color;
            if (typeof name !== "string" || name.trim().length === 0) {
              return [];
            }
            return [{ name, color: typeof color === "string" && color.trim().length > 0 ? color : null }];
          })
      : [];

    const assignees = Array.isArray(record.assignees)
      ? record.assignees.flatMap((assignee) => {
          if (!assignee || typeof assignee !== "object") {
            return [];
          }
          const login = (assignee as Record<string, unknown>).login;
          if (typeof login !== "string" || login.trim().length === 0) {
            return [];
          }
          return [{ login }];
        })
      : [];

    const authorRecord = record.author;
    const author =
      authorRecord && typeof authorRecord === "object"
        ? (authorRecord as { login?: unknown }).login
        : null;

    issues.push({
      number,
      title,
      state: normalizedState,
      url,
      createdAt,
      updatedAt,
      labels,
      assignees,
      author: typeof author === "string" && author.trim().length > 0 ? author : null,
    });
  }

  return issues;
}

const makeGitHubCli = Effect.sync(() => {
  const execute: GitHubCliShape["execute"] = (input) =>
    Effect.tryPromise({
      try: () =>
        runProcess("gh", input.args, {
          cwd: input.cwd,
          timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        }),
      catch: (error) => normalizeGitHubCliError("execute", error),
    });

  const service = {
    execute,
    listOpenPullRequests: (input) =>
      execute({
        cwd: input.cwd,
        args: [
          "pr",
          "list",
          "--head",
          input.headBranch,
          "--state",
          "open",
          "--limit",
          String(input.limit ?? 1),
          "--json",
          "number,title,url,baseRefName,headRefName",
        ],
      }).pipe(
        Effect.map((result) => result.stdout),
        Effect.flatMap((raw) =>
          Effect.try({
            try: () => parseOpenPullRequests(raw),
            catch: (error: unknown) =>
              new GitHubCliError({
                operation: "listOpenPullRequests",
                detail:
                  error instanceof Error
                    ? `GitHub CLI returned invalid PR list JSON: ${error.message}`
                    : "GitHub CLI returned invalid PR list JSON.",
                ...(error !== undefined ? { cause: error } : {}),
              }),
          }),
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
          input.headBranch,
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
    getAuthStatus: (input) => {
      const hostname = input?.hostname ?? DEFAULT_HOSTNAME;
      return execute({
        ...(input?.cwd ? { cwd: input.cwd } : {}),
        args: ["auth", "status", "--hostname", hostname, "--json", "hosts"],
      }).pipe(
        Effect.map((result) => result.stdout),
        Effect.flatMap((raw) =>
          Effect.try({
            try: () => parseAuthStatus(raw, hostname),
            catch: (error: unknown) =>
              new GitHubCliError({
                operation: "getAuthStatus",
                detail:
                  error instanceof Error
                    ? `GitHub CLI returned invalid auth status JSON: ${error.message}`
                    : "GitHub CLI returned invalid auth status JSON.",
                ...(error !== undefined ? { cause: error } : {}),
              }),
          }),
        ),
      );
    },
    loginWithBrowser: (input) =>
      execute({
        ...(input?.cwd ? { cwd: input.cwd } : {}),
        timeoutMs: LOGIN_TIMEOUT_MS,
        args: [
          "auth",
          "login",
          "--hostname",
          input?.hostname ?? DEFAULT_HOSTNAME,
          "--git-protocol",
          input?.gitProtocol ?? "https",
          "--web",
        ],
      }).pipe(Effect.asVoid),
    getRepository: (input) =>
      execute({
        ...(input.cwd ? { cwd: input.cwd } : {}),
        args: [
          "repo",
          "view",
          ...(input.repo ? [input.repo] : []),
          "--json",
          "nameWithOwner,url,description,defaultBranchRef",
        ],
      }).pipe(
        Effect.map((result) => result.stdout),
        Effect.flatMap((raw) =>
          Effect.try({
            try: () => parseRepository(raw),
            catch: (error: unknown) =>
              new GitHubCliError({
                operation: "getRepository",
                detail:
                  error instanceof Error
                    ? `GitHub CLI returned invalid repository JSON: ${error.message}`
                    : "GitHub CLI returned invalid repository JSON.",
                ...(error !== undefined ? { cause: error } : {}),
              }),
          }),
        ),
      ),
    listIssues: (input) =>
      execute({
        ...(input.cwd ? { cwd: input.cwd } : {}),
        args: [
          "issue",
          "list",
          ...(input.repo ? ["--repo", input.repo] : []),
          "--state",
          input.state ?? "open",
          "--limit",
          String(input.limit ?? 25),
          "--json",
          "number,title,state,url,createdAt,updatedAt,labels,assignees,author",
        ],
      }).pipe(
        Effect.map((result) => result.stdout),
        Effect.flatMap((raw) =>
          Effect.try({
            try: () => parseIssues(raw),
            catch: (error: unknown) =>
              new GitHubCliError({
                operation: "listIssues",
                detail:
                  error instanceof Error
                    ? `GitHub CLI returned invalid issue list JSON: ${error.message}`
                    : "GitHub CLI returned invalid issue list JSON.",
                ...(error !== undefined ? { cause: error } : {}),
              }),
          }),
        ),
      ),
  } satisfies GitHubCliShape;

  return service;
});

export const GitHubCliLive = Layer.effect(GitHubCli, makeGitHubCli);
