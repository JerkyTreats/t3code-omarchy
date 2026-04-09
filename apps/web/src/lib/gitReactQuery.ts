import type {
  GitActionProgressEvent,
  GitHubIssueLink,
  GitStackedAction,
  ThreadId,
} from "@t3tools/contracts";
import {
  infiniteQueryOptions,
  mutationOptions,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";

import {
  ensureCurrentNativeApiFeature,
  ensureNativeApi,
  hasCurrentNativeApiFeature,
} from "../nativeApi";
import { getWsRpcClient } from "../wsRpcClient";
import { randomUUID } from "./utils";

const GIT_STATUS_STALE_TIME_MS = 5_000;
const GIT_STATUS_REFETCH_INTERVAL_MS = 15_000;
const GIT_BRANCHES_STALE_TIME_MS = 15_000;
const GIT_BRANCHES_REFETCH_INTERVAL_MS = 60_000;
const GIT_REPOSITORY_CONTEXT_STALE_TIME_MS = 30_000;
const GIT_BRANCHES_PAGE_SIZE = 100;

export const gitQueryKeys = {
  all: ["git"] as const,
  status: (cwd: string | null) => ["git", "status", cwd] as const,
  branches: (cwd: string | null) => ["git", "branches", cwd] as const,
  branchSearch: (cwd: string | null, query: string) =>
    ["git", "branches", cwd, "search", query] as const,
  pullRequest: (cwd: string | null, reference: string | null) =>
    ["git", "pull-request", cwd, reference] as const,
  repositoryContext: (cwd: string | null) => ["git", "repository-context", cwd] as const,
};

export const gitMutationKeys = {
  init: (cwd: string | null) => ["git", "mutation", "init", cwd] as const,
  checkout: (cwd: string | null) => ["git", "mutation", "checkout", cwd] as const,
  runStackedAction: (cwd: string | null) => ["git", "mutation", "run-stacked-action", cwd] as const,
  pull: (cwd: string | null) => ["git", "mutation", "pull", cwd] as const,
  preparePullRequestThread: (cwd: string | null) =>
    ["git", "mutation", "prepare-pull-request-thread", cwd] as const,
  mergeBranches: (cwd: string | null) => ["git", "mutation", "merge-branches", cwd] as const,
  abortMerge: (cwd: string | null) => ["git", "mutation", "abort-merge", cwd] as const,
};

export function invalidateGitQueries(queryClient: QueryClient, input?: { cwd?: string | null }) {
  const cwd = input?.cwd ?? null;
  if (cwd !== null) {
    return queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "git" &&
        query.queryKey.includes(cwd),
    });
  }

  return queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
}

function invalidateGitBranchQueries(queryClient: QueryClient, cwd: string | null) {
  if (cwd === null) {
    return Promise.resolve();
  }

  return queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === "git" &&
      query.queryKey.includes(cwd) &&
      query.queryKey.includes("branches"),
  });
}

export function gitStatusQueryOptions(cwd: string | null) {
  return queryOptions({
    queryKey: gitQueryKeys.status(cwd),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!cwd) throw new Error("Git status is unavailable.");
      return api.git.status({ cwd });
    },
    enabled: cwd !== null,
    staleTime: GIT_STATUS_STALE_TIME_MS,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: GIT_STATUS_REFETCH_INTERVAL_MS,
  });
}

export function gitBranchesQueryOptions(cwd: string | null) {
  return queryOptions({
    queryKey: gitQueryKeys.branches(cwd),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!cwd) throw new Error("Git branches are unavailable.");
      return api.git.listBranches({ cwd });
    },
    enabled: cwd !== null,
    staleTime: GIT_BRANCHES_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: GIT_BRANCHES_REFETCH_INTERVAL_MS,
  });
}

export function gitBranchSearchInfiniteQueryOptions(input: {
  cwd: string | null;
  query: string;
  enabled?: boolean;
}) {
  const normalizedQuery = input.query.trim();

  return infiniteQueryOptions({
    queryKey: gitQueryKeys.branchSearch(input.cwd, normalizedQuery),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const api = ensureNativeApi();
      if (!input.cwd) throw new Error("Git branches are unavailable.");
      return api.git.listBranches({
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
  cwd: string | null;
  reference: string | null;
}) {
  return queryOptions({
    queryKey: gitQueryKeys.pullRequest(input.cwd, input.reference),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd || !input.reference) {
        throw new Error("Pull request lookup is unavailable.");
      }
      return api.git.resolvePullRequest({ cwd: input.cwd, reference: input.reference });
    },
    enabled: input.cwd !== null && input.reference !== null,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function gitRepositoryContextQueryOptions(cwd: string | null) {
  return queryOptions({
    queryKey: gitQueryKeys.repositoryContext(cwd),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!cwd) throw new Error("Git repository context is unavailable.");
      ensureCurrentNativeApiFeature("git.repositoryContext");
      return api.git.repositoryContext({ cwd });
    },
    enabled: cwd !== null && hasCurrentNativeApiFeature("git.repositoryContext"),
    staleTime: GIT_REPOSITORY_CONTEXT_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function gitInitMutationOptions(input: { cwd: string | null; queryClient: QueryClient }) {
  return mutationOptions({
    mutationKey: gitMutationKeys.init(input.cwd),
    mutationFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) throw new Error("Git init is unavailable.");
      return api.git.init({ cwd: input.cwd });
    },
    onSettled: async () => {
      await invalidateGitQueries(input.queryClient, { cwd: input.cwd });
    },
  });
}

export function gitCheckoutMutationOptions(input: {
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: gitMutationKeys.checkout(input.cwd),
    mutationFn: async (branch: string) => {
      const api = ensureNativeApi();
      if (!input.cwd) throw new Error("Git checkout is unavailable.");
      return api.git.checkout({ cwd: input.cwd, branch });
    },
    onSettled: async () => {
      await invalidateGitQueries(input.queryClient, { cwd: input.cwd });
    },
  });
}

export function gitRunStackedActionMutationOptions(input: {
  cwd: string | null;
  queryClient: QueryClient;
  model?: string | null;
}) {
  return mutationOptions({
    mutationKey: gitMutationKeys.runStackedAction(input.cwd),
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
      const api = ensureNativeApi();
      if (!input.cwd) throw new Error("Git action is unavailable.");

      const payload = {
        actionId: actionId ?? randomUUID(),
        cwd: input.cwd,
        action,
        ...(commitMessage ? { commitMessage } : {}),
        ...(featureBranch ? { featureBranch: true } : {}),
        ...(targetBranch ? { targetBranch } : {}),
        ...(issueLink ? { issueLink } : {}),
        ...(filePaths && filePaths.length > 0 ? { filePaths } : {}),
      };

      if (onProgress) {
        return getWsRpcClient().git.runStackedAction(payload, { onProgress });
      }

      return api.git.runStackedAction(payload);
    },
    onSettled: async () => {
      await invalidateGitQueries(input.queryClient, { cwd: input.cwd });
    },
  });
}

export function gitPullMutationOptions(input: { cwd: string | null; queryClient: QueryClient }) {
  return mutationOptions({
    mutationKey: gitMutationKeys.pull(input.cwd),
    mutationFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) throw new Error("Git pull is unavailable.");
      return api.git.pull({ cwd: input.cwd });
    },
    onSettled: async () => {
      await invalidateGitQueries(input.queryClient, { cwd: input.cwd });
    },
  });
}

export function gitPreparePullRequestThreadMutationOptions(input: {
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: gitMutationKeys.preparePullRequestThread(input.cwd),
    mutationFn: async (args: {
      reference: string;
      mode: "local" | "worktree";
      threadId?: ThreadId;
    }) => {
      const api = ensureNativeApi();
      if (!input.cwd) throw new Error("Pull request thread preparation is unavailable.");
      return api.git.preparePullRequestThread({
        cwd: input.cwd,
        reference: args.reference,
        mode: args.mode,
        ...(args.threadId ? { threadId: args.threadId } : {}),
      });
    },
    onSettled: async () => {
      await invalidateGitQueries(input.queryClient, { cwd: input.cwd });
    },
  });
}

export function gitCreateWorktreeMutationOptions(input: { queryClient: QueryClient }) {
  return mutationOptions({
    mutationKey: ["git", "mutation", "create-worktree"] as const,
    mutationFn: (
      args: Parameters<ReturnType<typeof ensureNativeApi>["git"]["createWorktree"]>[0],
    ) => ensureNativeApi().git.createWorktree(args),
    onSettled: async () => {
      await invalidateGitQueries(input.queryClient);
    },
  });
}

export function gitRemoveWorktreeMutationOptions(input: { queryClient: QueryClient }) {
  return mutationOptions({
    mutationKey: ["git", "mutation", "remove-worktree"] as const,
    mutationFn: (
      args: Parameters<ReturnType<typeof ensureNativeApi>["git"]["removeWorktree"]>[0],
    ) => ensureNativeApi().git.removeWorktree(args),
    onSettled: async () => {
      await invalidateGitQueries(input.queryClient);
    },
  });
}

export function gitMergeBranchesMutationOptions(input: {
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: gitMutationKeys.mergeBranches(input.cwd),
    mutationFn: async ({
      sourceBranch,
      targetBranch,
    }: {
      sourceBranch: string;
      targetBranch: string;
    }) => {
      const api = ensureNativeApi();
      if (!input.cwd) throw new Error("Git merge is unavailable.");
      ensureCurrentNativeApiFeature("git.mergeBranches");
      return api.git.mergeBranches({ cwd: input.cwd, sourceBranch, targetBranch });
    },
    onSettled: async () => {
      await invalidateGitQueries(input.queryClient, { cwd: input.cwd });
    },
  });
}

export function gitAbortMergeMutationOptions(input: {
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: gitMutationKeys.abortMerge(input.cwd),
    mutationFn: async (cwdOverride?: string | null) => {
      const api = ensureNativeApi();
      const cwd = cwdOverride ?? input.cwd;
      if (!cwd) throw new Error("Git merge abort is unavailable.");
      ensureCurrentNativeApiFeature("git.abortMerge");
      return api.git.abortMerge({ cwd });
    },
    onSettled: async () => {
      await invalidateGitQueries(input.queryClient, { cwd: input.cwd });
    },
  });
}

export { invalidateGitBranchQueries };
