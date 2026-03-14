import { Effect } from "effect";

import type { GitCoreShape } from "./Services/GitCore.ts";

export const DEFAULT_GITHUB_HOSTNAME = "github.com";
const RESERVED_UPSTREAM_REMOTE_NAME = "upstream";

export function parseGitHubRepoSelector(remoteUrl: string, hostname: string): string | null {
  const trimmed = remoteUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const normalizedHostname = hostname.toLowerCase();

  const scpLikeMatch = !trimmed.includes("://") ? /^(?:[^@]+@)?([^:]+):(.+)$/.exec(trimmed) : null;
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

function appendUnique(target: string[], value: string | null): void {
  if (!value || target.includes(value)) {
    return;
  }
  target.push(value);
}

function appendProjectRemoteCandidate(target: string[], value: string | null): void {
  const normalizedValue = value?.trim() ?? "";
  if (
    normalizedValue.length === 0 ||
    normalizedValue.toLowerCase() === RESERVED_UPSTREAM_REMOTE_NAME
  ) {
    return;
  }
  appendUnique(target, normalizedValue);
}

export const resolveGitHubRepositorySelector = (
  cwd: string,
  gitCore: Pick<GitCoreShape, "readConfigValue">,
  hostname = DEFAULT_GITHUB_HOSTNAME,
) =>
  Effect.gen(function* () {
    const remoteNames: string[] = [];
    appendProjectRemoteCandidate(remoteNames, "origin");

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
