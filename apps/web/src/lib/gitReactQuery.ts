import {
  type EnvironmentId,
  type GitActionProgressEvent,
  type GitHubIssueLink,
  type GitStackedAction,
  type SourceControlPublishRepositoryInput,
  type ThreadId,
} from "@t3tools/contracts";
import {
  infiniteQueryOptions,
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import { ensureEnvironmentApi } from "../environmentApi";
import { requireEnvironmentConnection } from "../environments/runtime";
import { refreshGitStatus } from "./gitStatusState";
import { randomUUID } from "./utils";

const GIT_BRANCHES_STALE_TIME_MS = 15_000;
const GIT_BRANCHES_REFETCH_INTERVAL_MS = 60_000;
const GIT_BRANCHES_PAGE_SIZE = 100;

export const gitQueryKeys = {
  all: ["git"] as const,
  refs: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["git", "refs", environmentId ?? null, cwd] as const,
  branches: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["git", "branches", environmentId ?? null, cwd] as const,
  branchSearch: (environmentId: EnvironmentId | null, cwd: string | null, query: string) =>
    ["git", "refs", environmentId ?? null, cwd, "search", query] as const,
};

export const gitMutationKeys = {
  init: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["git", "mutation", "init", environmentId ?? null, cwd] as const,
  switchRef: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["git", "mutation", "switchRef", environmentId ?? null, cwd] as const,
  runStackedAction: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["git", "mutation", "run-stacked-action", environmentId ?? null, cwd] as const,
  pull: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["git", "mutation", "pull", environmentId ?? null, cwd] as const,
  mergeBranches: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["git", "mutation", "merge-branches", environmentId ?? null, cwd] as const,
  abortMerge: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["git", "mutation", "abort-merge", environmentId ?? null, cwd] as const,
  preparePullRequestThread: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["git", "mutation", "prepare-pull-request-thread", environmentId ?? null, cwd] as const,
  publishRepository: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["git", "mutation", "publish-repository", environmentId ?? null, cwd] as const,
};

export function invalidateGitQueries(
  queryClient: QueryClient,
  input?: { environmentId?: EnvironmentId | null; cwd?: string | null },
) {
  const environmentId = input?.environmentId ?? null;
  const cwd = input?.cwd ?? null;
  if (cwd !== null) {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: gitQueryKeys.refs(environmentId, cwd) }),
      queryClient.invalidateQueries({ queryKey: gitQueryKeys.branches(environmentId, cwd) }),
      refreshGitStatus({ environmentId, cwd }),
    ]).then(() => undefined);
  }

  return queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
}

export function gitBranchesQueryOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
}) {
  return queryOptions({
    queryKey: gitQueryKeys.branches(input.environmentId, input.cwd),
    queryFn: async () => {
      if (!input.cwd || !input.environmentId) throw new Error("Git refs are unavailable.");
      const api = ensureEnvironmentApi(input.environmentId);
      return api.vcs.listRefs({
        cwd: input.cwd,
        limit: GIT_BRANCHES_PAGE_SIZE,
      });
    },
    enabled: input.environmentId !== null && input.cwd !== null,
    staleTime: GIT_BRANCHES_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: GIT_BRANCHES_REFETCH_INTERVAL_MS,
  });
}

function invalidateGitBranchQueries(
  queryClient: QueryClient,
  environmentId: EnvironmentId | null,
  cwd: string | null,
) {
  return invalidateGitQueries(queryClient, { environmentId, cwd });
}

/**
 * @deprecated Use a VCS-named query helper once the UI naming migration lands.
 */
export function gitBranchSearchInfiniteQueryOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  query: string;
  enabled?: boolean;
}) {
  const normalizedQuery = input.query.trim();

  return infiniteQueryOptions({
    queryKey: gitQueryKeys.branchSearch(input.environmentId, input.cwd, normalizedQuery),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!input.cwd) throw new Error("Git refs are unavailable.");
      if (!input.environmentId) throw new Error("Git refs are unavailable.");
      const api = ensureEnvironmentApi(input.environmentId);
      return api.vcs.listRefs({
        cwd: input.cwd,
        ...(normalizedQuery.length > 0 ? { query: normalizedQuery } : {}),
        cursor: pageParam,
        limit: GIT_BRANCHES_PAGE_SIZE,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: input.cwd !== null && (input.enabled ?? true),
    staleTime: GIT_BRANCHES_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: GIT_BRANCHES_REFETCH_INTERVAL_MS,
  });
}

export function gitResolvePullRequestQueryOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  reference: string | null;
}) {
  return queryOptions({
    queryKey: [
      "git",
      "pull-request",
      input.environmentId ?? null,
      input.cwd,
      input.reference,
    ] as const,
    queryFn: async () => {
      if (!input.cwd || !input.reference || !input.environmentId) {
        throw new Error("Pull request lookup is unavailable.");
      }
      const api = ensureEnvironmentApi(input.environmentId);
      return api.git.resolvePullRequest({ cwd: input.cwd, reference: input.reference });
    },
    enabled: input.environmentId !== null && input.cwd !== null && input.reference !== null,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * @deprecated Use a VCS-named mutation helper once the UI naming migration lands.
 */
export function gitInitMutationOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: gitMutationKeys.init(input.environmentId, input.cwd),
    mutationFn: async () => {
      if (!input.cwd || !input.environmentId) throw new Error("Git init is unavailable.");
      const api = ensureEnvironmentApi(input.environmentId);
      return api.vcs.init({ cwd: input.cwd });
    },
    onSettled: async () => {
      await invalidateGitBranchQueries(input.queryClient, input.environmentId, input.cwd);
    },
  });
}

/**
 * @deprecated Use a VCS-named mutation helper once the UI naming migration lands.
 */
export function gitCheckoutMutationOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: gitMutationKeys.switchRef(input.environmentId, input.cwd),
    mutationFn: async (refName: string) => {
      if (!input.cwd || !input.environmentId) throw new Error("Git switchRef is unavailable.");
      const api = ensureEnvironmentApi(input.environmentId);
      return api.vcs.switchRef({ cwd: input.cwd, refName });
    },
    onSettled: async () => {
      await invalidateGitBranchQueries(input.queryClient, input.environmentId, input.cwd);
    },
  });
}

export function gitRunStackedActionMutationOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: gitMutationKeys.runStackedAction(input.environmentId, input.cwd),
    mutationFn: async ({
      actionId,
      action,
      commitMessage,
      featureBranch,
      targetBranch,
      issueLink,
      filePaths,
      onProgress,
    }: {
      actionId?: string;
      action: GitStackedAction;
      commitMessage?: string;
      featureBranch?: boolean;
      targetBranch?: string;
      issueLink?: GitHubIssueLink | null;
      filePaths?: string[];
      onProgress?: (event: GitActionProgressEvent) => void;
    }) => {
      if (!input.cwd || !input.environmentId) throw new Error("Git action is unavailable.");
      return requireEnvironmentConnection(input.environmentId).client.git.runStackedAction(
        {
          action,
          actionId: actionId ?? randomUUID(),
          cwd: input.cwd,
          ...(commitMessage ? { commitMessage } : {}),
          ...(featureBranch ? { featureBranch: true } : {}),
          ...(targetBranch ? { targetBranch } : {}),
          ...(issueLink ? { issueLink } : {}),
          ...(filePaths && filePaths.length > 0 ? { filePaths } : {}),
        },
        ...(onProgress ? [{ onProgress }] : []),
      );
    },
    onSuccess: async () => {
      await invalidateGitBranchQueries(input.queryClient, input.environmentId, input.cwd);
    },
  });
}

export function gitMergeBranchesMutationOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: gitMutationKeys.mergeBranches(input.environmentId, input.cwd),
    mutationFn: async ({
      sourceBranch,
      targetBranch,
    }: {
      sourceBranch: string;
      targetBranch: string;
    }) => {
      if (!input.cwd || !input.environmentId) throw new Error("Git merge is unavailable.");
      const api = ensureEnvironmentApi(input.environmentId);
      return api.git.mergeBranches({ cwd: input.cwd, sourceBranch, targetBranch });
    },
    onSettled: async () => {
      await invalidateGitQueries(input.queryClient, {
        environmentId: input.environmentId,
        cwd: input.cwd,
      });
    },
  });
}

export function gitAbortMergeMutationOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: gitMutationKeys.abortMerge(input.environmentId, input.cwd),
    mutationFn: async (cwdOverride?: string | null) => {
      const cwd = cwdOverride ?? input.cwd;
      if (!cwd || !input.environmentId) throw new Error("Git merge abort is unavailable.");
      const api = ensureEnvironmentApi(input.environmentId);
      return api.git.abortMerge({ cwd });
    },
    onSettled: async () => {
      await invalidateGitQueries(input.queryClient, {
        environmentId: input.environmentId,
        cwd: input.cwd,
      });
    },
  });
}

/**
 * @deprecated Use a VCS-named mutation helper once the UI naming migration lands.
 */
export function gitPullMutationOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: gitMutationKeys.pull(input.environmentId, input.cwd),
    mutationFn: async () => {
      if (!input.cwd || !input.environmentId) throw new Error("Git pull is unavailable.");
      const api = ensureEnvironmentApi(input.environmentId);
      return api.vcs.pull({ cwd: input.cwd });
    },
    onSuccess: async () => {
      await invalidateGitBranchQueries(input.queryClient, input.environmentId, input.cwd);
    },
  });
}

export function sourceControlPublishRepositoryMutationOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: gitMutationKeys.publishRepository(input.environmentId, input.cwd),
    mutationFn: async (args: Omit<SourceControlPublishRepositoryInput, "cwd">) => {
      if (!input.cwd || !input.environmentId) {
        throw new Error("Repository publishing is unavailable.");
      }
      const api = ensureEnvironmentApi(input.environmentId);
      return api.sourceControl.publishRepository({ cwd: input.cwd, ...args });
    },
    onSuccess: async () => {
      await invalidateGitBranchQueries(input.queryClient, input.environmentId, input.cwd);
    },
  });
}

/**
 * @deprecated Use a VCS-named mutation helper once the UI naming migration lands.
 */
export function gitCreateWorktreeMutationOptions(input: {
  environmentId: EnvironmentId | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: ["git", "mutation", "create-worktree", input.environmentId ?? null] as const,
    mutationFn: (
      args: Parameters<ReturnType<typeof ensureEnvironmentApi>["vcs"]["createWorktree"]>[0],
    ) => {
      if (!input.environmentId) {
        throw new Error("Worktree creation is unavailable.");
      }
      return ensureEnvironmentApi(input.environmentId).vcs.createWorktree(args);
    },
    onSuccess: async () => {
      await invalidateGitQueries(input.queryClient, { environmentId: input.environmentId });
    },
  });
}

/**
 * @deprecated Use a VCS-named mutation helper once the UI naming migration lands.
 */
export function gitRemoveWorktreeMutationOptions(input: {
  environmentId: EnvironmentId | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: ["git", "mutation", "remove-worktree", input.environmentId ?? null] as const,
    mutationFn: (
      args: Parameters<ReturnType<typeof ensureEnvironmentApi>["vcs"]["removeWorktree"]>[0],
    ) => {
      if (!input.environmentId) {
        throw new Error("Worktree removal is unavailable.");
      }
      return ensureEnvironmentApi(input.environmentId).vcs.removeWorktree(args);
    },
    onSuccess: async () => {
      await invalidateGitQueries(input.queryClient, { environmentId: input.environmentId });
    },
  });
}

export function gitPreparePullRequestThreadMutationOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: gitMutationKeys.preparePullRequestThread(input.environmentId, input.cwd),
    mutationFn: async (args: {
      reference: string;
      mode: "local" | "worktree";
      threadId?: ThreadId;
    }) => {
      if (!input.cwd || !input.environmentId) {
        throw new Error("Pull request thread preparation is unavailable.");
      }
      const api = ensureEnvironmentApi(input.environmentId);
      return api.git.preparePullRequestThread({
        cwd: input.cwd,
        reference: args.reference,
        mode: args.mode,
        ...(args.threadId ? { threadId: args.threadId } : {}),
      });
    },
    onSuccess: async () => {
      await invalidateGitBranchQueries(input.queryClient, input.environmentId, input.cwd);
    },
  });
}
