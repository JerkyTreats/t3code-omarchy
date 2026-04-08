import type {
  GitBranch,
  GitHostingProvider,
  GitStatusLocalResult,
  GitStatusRemoteResult,
  GitStatusResult,
  GitStatusStreamEvent,
} from "@t3tools/contracts";

/**
 * Sanitize an arbitrary string into a valid, lowercase git branch fragment.
 * Strips quotes, collapses separators, limits to 64 chars.
 */
export function sanitizeBranchFragment(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/^[./\s_-]+|[./\s_-]+$/g, "");

  const branchFragment = normalized
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/-+/g, "-")
    .replace(/^[./_-]+|[./_-]+$/g, "")
    .slice(0, 64)
    .replace(/[./_-]+$/g, "");

  return branchFragment.length > 0 ? branchFragment : "update";
}

export const MANAGED_WORKTREE_BRANCH_PREFIX = "t3code";

const TEMP_MANAGED_WORKTREE_BRANCH_PATTERN = new RegExp(
  `^${MANAGED_WORKTREE_BRANCH_PREFIX}/[0-9a-f]{8}$`,
);

function stripManagedWorktreePrefix(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/^refs\/heads\//, "")
    .replace(/['"`]/g, "");

  if (normalized.startsWith(`${MANAGED_WORKTREE_BRANCH_PREFIX}/`)) {
    return normalized.slice(`${MANAGED_WORKTREE_BRANCH_PREFIX}/`.length);
  }

  return normalized;
}

function resolveRandomBranchSeed(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

function toTemporaryWorktreeToken(seed: string): string {
  const hex = seed.toLowerCase().replace(/[^0-9a-f]+/g, "");
  return hex.slice(0, 8).padEnd(8, "0");
}

function hashBranchName(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildTemporaryWorktreeBranchName(seed = resolveRandomBranchSeed()): string {
  return `${MANAGED_WORKTREE_BRANCH_PREFIX}/${toTemporaryWorktreeToken(seed)}`;
}

export function isTemporaryWorktreeBranchName(branch: string): boolean {
  return TEMP_MANAGED_WORKTREE_BRANCH_PATTERN.test(branch.trim().toLowerCase());
}

export function buildManagedWorktreeBranchName(raw: string, namespace?: string): string {
  const branchFragment = sanitizeBranchFragment(stripManagedWorktreePrefix(raw));
  const namespaceFragment = namespace
    ? sanitizeBranchFragment(namespace).replaceAll("/", "-")
    : null;

  return `${MANAGED_WORKTREE_BRANCH_PREFIX}/${namespaceFragment ? `${namespaceFragment}/` : ""}${branchFragment}`;
}

export function resolveUniqueBranchName(
  existingBranchNames: readonly string[],
  desiredBranch: string,
): string {
  const trimmedBranch = desiredBranch.trim();
  if (trimmedBranch.length === 0) {
    return desiredBranch;
  }

  const normalizedExistingNames = new Set(
    existingBranchNames.map((branch) => branch.trim().toLowerCase()),
  );
  const normalizedDesiredBranch = trimmedBranch.toLowerCase();

  if (!normalizedExistingNames.has(normalizedDesiredBranch)) {
    return trimmedBranch;
  }

  let suffix = 2;
  while (normalizedExistingNames.has(`${normalizedDesiredBranch}-${suffix}`)) {
    suffix += 1;
  }

  return `${trimmedBranch}-${suffix}`;
}

export function buildWorktreeDirectoryName(branch: string): string {
  const normalizedBranch = branch.trim().toLowerCase();
  const slug = sanitizeBranchFragment(normalizedBranch).replaceAll("/", "-");
  return `${slug}-${hashBranchName(normalizedBranch)}`;
}

/**
 * Sanitize a string into a `feature/…` branch name.
 * Preserves an existing `feature/` prefix or slash-separated namespace.
 */
export function sanitizeFeatureBranchName(raw: string): string {
  const sanitized = sanitizeBranchFragment(raw);
  if (sanitized.includes("/")) {
    return sanitized.startsWith("feature/") ? sanitized : `feature/${sanitized}`;
  }
  return `feature/${sanitized}`;
}

const AUTO_FEATURE_BRANCH_FALLBACK = "feature/update";

/**
 * Resolve a unique `feature/…` branch name that doesn't collide with
 * any existing branch. Appends a numeric suffix when needed.
 */
export function resolveAutoFeatureBranchName(
  existingBranchNames: readonly string[],
  preferredBranch?: string,
): string {
  const preferred = preferredBranch?.trim();
  const resolvedBase = sanitizeFeatureBranchName(
    preferred && preferred.length > 0 ? preferred : AUTO_FEATURE_BRANCH_FALLBACK,
  );
  return resolveUniqueBranchName(existingBranchNames, resolvedBase);
}

/**
 * Strip the remote prefix from a remote ref such as `origin/feature/demo`.
 */
export function deriveLocalBranchNameFromRemoteRef(branchName: string): string {
  const firstSeparatorIndex = branchName.indexOf("/");
  if (firstSeparatorIndex <= 0 || firstSeparatorIndex === branchName.length - 1) {
    return branchName;
  }
  return branchName.slice(firstSeparatorIndex + 1);
}

function deriveLocalBranchNameCandidatesFromRemoteRef(
  branchName: string,
  remoteName?: string,
): ReadonlyArray<string> {
  const candidates = new Set<string>();
  const firstSlashCandidate = deriveLocalBranchNameFromRemoteRef(branchName);
  if (firstSlashCandidate.length > 0) {
    candidates.add(firstSlashCandidate);
  }

  if (remoteName) {
    const remotePrefix = `${remoteName}/`;
    if (branchName.startsWith(remotePrefix) && branchName.length > remotePrefix.length) {
      candidates.add(branchName.slice(remotePrefix.length));
    }
  }

  return [...candidates];
}

/**
 * Hide `origin/*` remote refs when a matching local branch already exists.
 */
export function dedupeRemoteBranchesWithLocalMatches(
  branches: ReadonlyArray<GitBranch>,
): ReadonlyArray<GitBranch> {
  const localBranchNames = new Set(
    branches.filter((branch) => !branch.isRemote).map((branch) => branch.name),
  );

  return branches.filter((branch) => {
    if (!branch.isRemote) {
      return true;
    }

    if (branch.remoteName !== "origin") {
      return true;
    }

    const localBranchCandidates = deriveLocalBranchNameCandidatesFromRemoteRef(
      branch.name,
      branch.remoteName,
    );
    return !localBranchCandidates.some((candidate) => localBranchNames.has(candidate));
  });
}

function parseGitRemoteHost(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.startsWith("git@")) {
    const hostWithPath = trimmed.slice("git@".length);
    const separatorIndex = hostWithPath.search(/[:/]/);
    if (separatorIndex <= 0) {
      return null;
    }
    return hostWithPath.slice(0, separatorIndex).toLowerCase();
  }

  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function toBaseUrl(host: string): string {
  return `https://${host}`;
}

function isGitHubHost(host: string): boolean {
  return host === "github.com" || host.includes("github");
}

function isGitLabHost(host: string): boolean {
  return host === "gitlab.com" || host.includes("gitlab");
}

export function detectGitHostingProviderFromRemoteUrl(
  remoteUrl: string,
): GitHostingProvider | null {
  const host = parseGitRemoteHost(remoteUrl);
  if (!host) {
    return null;
  }

  if (isGitHubHost(host)) {
    return {
      kind: "github",
      name: host === "github.com" ? "GitHub" : "GitHub Self-Hosted",
      baseUrl: toBaseUrl(host),
    };
  }

  if (isGitLabHost(host)) {
    return {
      kind: "gitlab",
      name: host === "gitlab.com" ? "GitLab" : "GitLab Self-Hosted",
      baseUrl: toBaseUrl(host),
    };
  }

  return {
    kind: "unknown",
    name: host,
    baseUrl: toBaseUrl(host),
  };
}

const EMPTY_GIT_STATUS_REMOTE: GitStatusRemoteResult = {
  hasUpstream: false,
  aheadCount: 0,
  behindCount: 0,
  pr: null,
};

export function mergeGitStatusParts(
  local: GitStatusLocalResult,
  remote: GitStatusRemoteResult | null,
): GitStatusResult {
  return {
    ...local,
    ...(remote ?? EMPTY_GIT_STATUS_REMOTE),
  };
}

function toRemoteStatusPart(status: GitStatusResult): GitStatusRemoteResult {
  return {
    hasUpstream: status.hasUpstream,
    aheadCount: status.aheadCount,
    behindCount: status.behindCount,
    pr: status.pr,
  };
}

function toLocalStatusPart(status: GitStatusResult): GitStatusLocalResult {
  return {
    isRepo: status.isRepo,
    ...(status.hostingProvider ? { hostingProvider: status.hostingProvider } : {}),
    hasOriginRemote: status.hasOriginRemote,
    isDefaultBranch: status.isDefaultBranch,
    branch: status.branch,
    hasWorkingTreeChanges: status.hasWorkingTreeChanges,
    workingTree: status.workingTree,
  };
}

export function applyGitStatusStreamEvent(
  current: GitStatusResult | null,
  event: GitStatusStreamEvent,
): GitStatusResult {
  switch (event._tag) {
    case "snapshot":
      return mergeGitStatusParts(event.local, event.remote);
    case "localUpdated":
      return mergeGitStatusParts(event.local, current ? toRemoteStatusPart(current) : null);
    case "remoteUpdated":
      if (current === null) {
        return mergeGitStatusParts(
          {
            isRepo: true,
            hasOriginRemote: false,
            isDefaultBranch: false,
            branch: null,
            hasWorkingTreeChanges: false,
            workingTree: { files: [], insertions: 0, deletions: 0 },
          },
          event.remote,
        );
      }
      return mergeGitStatusParts(toLocalStatusPart(current), event.remote);
  }
}
