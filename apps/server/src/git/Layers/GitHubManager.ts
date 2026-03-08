import type {
  GitHubListIssuesResult,
  GitHubStatusInput,
  GitHubStatusResult,
} from "@t3tools/contracts";
import { Effect, Layer } from "effect";

import { GitHubCliError } from "../Errors.ts";
import { GitHubCli } from "../Services/GitHubCli.ts";
import { GitCore } from "../Services/GitCore.ts";
import { GitHubManager, type GitHubManagerShape } from "../Services/GitHubManager.ts";

const DEFAULT_HOSTNAME = "github.com";

function isGitHubCliMissing(error: GitHubCliError): boolean {
  return error.detail.includes("required but not available on PATH");
}

function emptyStatus(input: GitHubStatusInput): GitHubStatusResult {
  return {
    installed: false,
    authenticated: false,
    hostname: input.hostname ?? DEFAULT_HOSTNAME,
    accountLogin: null,
    gitProtocol: null,
    tokenSource: null,
    scopes: [],
    repo: null,
  };
}

function parseGitHubRepoSelector(remoteUrl: string, hostname: string): string | null {
  const trimmed = remoteUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const normalizedHostname = hostname.toLowerCase();

  const scpLikeMatch = !trimmed.includes("://")
    ? /^(?:[^@]+@)?([^:]+):(.+)$/.exec(trimmed)
    : null;
  if (scpLikeMatch) {
    const remoteHost = scpLikeMatch[1];
    const remotePath = scpLikeMatch[2];
    if (!remoteHost || !remotePath) {
      return null;
    }
    if (remoteHost.toLowerCase() !== normalizedHostname) {
      return null;
    }
    const pathSegments = remotePath
      .replace(/\.git$/i, "")
      .split("/")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
    if (pathSegments.length < 2) {
      return null;
    }
    return `${pathSegments[pathSegments.length - 2]}/${pathSegments[pathSegments.length - 1]}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.toLowerCase() !== normalizedHostname) {
      return null;
    }
    const pathSegments = parsed.pathname
      .replace(/\.git$/i, "")
      .split("/")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
    if (pathSegments.length < 2) {
      return null;
    }
    return `${pathSegments[pathSegments.length - 2]}/${pathSegments[pathSegments.length - 1]}`;
  } catch {
    return null;
  }
}

const makeGitHubManager = Effect.gen(function* () {
  const gitHubCli = yield* GitHubCli;
  const gitCore = yield* GitCore;

  const resolveRepositorySelector = Effect.fnUntraced(function* (cwd: string, hostname: string) {
    const statusDetails = yield* gitCore.statusDetails(cwd).pipe(Effect.catch(() => Effect.succeed(null)));
    const branchRemoteName =
      statusDetails?.branch !== null && statusDetails?.branch !== undefined
        ? yield* gitCore
            .readConfigValue(cwd, `branch.${statusDetails.branch}.remote`)
            .pipe(Effect.catch(() => Effect.succeed(null)))
        : null;
    const upstreamRemoteName = statusDetails?.upstreamRef?.split("/")[0] ?? null;
    const remoteNames = [branchRemoteName, upstreamRemoteName, "origin"].filter(
      (value, index, values): value is string => typeof value === "string" && value.length > 0 && values.indexOf(value) === index,
    );

    for (const remoteName of remoteNames) {
      const remoteUrl = yield* gitCore
        .readConfigValue(cwd, `remote.${remoteName}.url`)
        .pipe(Effect.catch(() => Effect.succeed(null)));
      if (!remoteUrl) {
        continue;
      }
      const selector = parseGitHubRepoSelector(remoteUrl, hostname);
      if (selector) {
        return selector;
      }
    }

    return null;
  });

  const status: GitHubManagerShape["status"] = Effect.fnUntraced(function* (input) {
    const hostname = input.hostname ?? DEFAULT_HOSTNAME;
    const auth = yield* gitHubCli.getAuthStatus({
      ...(input.cwd !== null ? { cwd: input.cwd } : {}),
      ...(input.hostname ? { hostname: input.hostname } : {}),
    }).pipe(
      Effect.map((value) => ({ installed: true as const, value })),
      Effect.catch((error) => {
        if (isGitHubCliMissing(error)) {
          return Effect.succeed({ installed: false as const, value: null });
        }
        return Effect.fail(error);
      }),
    );

    if (!auth.installed) {
      return emptyStatus(input);
    }

    const repositorySelector =
      input.cwd !== null ? yield* resolveRepositorySelector(input.cwd, hostname) : null;
    const repo =
      input.cwd !== null && repositorySelector
        ? yield* gitHubCli.getRepository({ cwd: input.cwd, repo: repositorySelector }).pipe(
            Effect.catch(() => Effect.succeed(null)),
          )
        : null;

    return {
      installed: true,
      authenticated: auth.value?.state === "success",
      hostname: auth.value?.host ?? hostname,
      accountLogin: auth.value?.login ?? null,
      gitProtocol: auth.value?.gitProtocol ?? null,
      tokenSource: auth.value?.tokenSource ?? null,
      scopes: auth.value?.scopes ?? [],
      repo,
    } satisfies GitHubStatusResult;
  });

  const login: GitHubManagerShape["login"] = Effect.fnUntraced(function* (input) {
    const currentStatus = yield* status({
      cwd: input.cwd,
      hostname: input.hostname,
    });

    if (!currentStatus.installed || currentStatus.authenticated) {
      return currentStatus;
    }

    yield* gitHubCli.loginWithBrowser({
      ...(input.cwd !== null ? { cwd: input.cwd } : {}),
      ...(input.hostname ? { hostname: input.hostname } : {}),
      ...(input.gitProtocol ? { gitProtocol: input.gitProtocol } : {}),
    });

    return yield* status({
      cwd: input.cwd,
      hostname: input.hostname,
    });
  });

  const listIssues: GitHubManagerShape["listIssues"] = Effect.fnUntraced(function* (input) {
    if (input.cwd === null) {
      return yield* new GitHubCliError({
        operation: "listIssues",
        detail: "Select a project before listing GitHub issues.",
      });
    }

    const repositorySelector = yield* resolveRepositorySelector(input.cwd, DEFAULT_HOSTNAME);
    if (!repositorySelector) {
      return {
        repo: null,
        issues: [],
      } satisfies GitHubListIssuesResult;
    }

    const [repo, issues] = yield* Effect.all(
      [
        gitHubCli
          .getRepository({ cwd: input.cwd, repo: repositorySelector })
          .pipe(Effect.catch(() => Effect.succeed(null))),
        gitHubCli.listIssues({
          cwd: input.cwd,
          repo: repositorySelector,
          ...(input.state ? { state: input.state } : {}),
          ...(input.limit ? { limit: input.limit } : {}),
        }),
      ],
      { concurrency: "unbounded" },
    );

    return {
      repo,
      issues,
    } satisfies GitHubListIssuesResult;
  });

  return {
    status,
    login,
    listIssues,
  } satisfies GitHubManagerShape;
});

export const GitHubManagerLive = Layer.effect(GitHubManager, makeGitHubManager);
