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
