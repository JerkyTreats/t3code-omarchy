import type { GitHubIssueListState } from "@t3tools/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import {
  ensureCurrentNativeApiFeature,
  ensureNativeApi,
  hasCurrentNativeApiFeature,
} from "~/nativeApi";

const GITHUB_STATUS_STALE_TIME_MS = 10_000;
const GITHUB_ISSUES_STALE_TIME_MS = 15_000;

export const githubQueryKeys = {
  all: ["github"] as const,
  status: (cwd: string | null) => ["github", "status", cwd] as const,
  issues: (cwd: string | null, state: GitHubIssueListState, limit: number) =>
    ["github", "issues", cwd, state, limit] as const,
};

export function invalidateGitHubQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: githubQueryKeys.all });
}

export function githubStatusQueryOptions(cwd: string | null) {
  return queryOptions({
    queryKey: githubQueryKeys.status(cwd),
    queryFn: async () => {
      const api = ensureNativeApi();
      ensureCurrentNativeApiFeature("github.status");
      return api.github.status({ cwd, hostname: "github.com" });
    },
    enabled: cwd !== null && hasCurrentNativeApiFeature("github.status"),
    staleTime: GITHUB_STATUS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function githubIssuesQueryOptions(input: {
  cwd: string | null;
  state: GitHubIssueListState;
  limit: number;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: githubQueryKeys.issues(input.cwd, input.state, input.limit),
    queryFn: async () => {
      const api = ensureNativeApi();
      ensureCurrentNativeApiFeature("github.listIssues");
      return api.github.listIssues({
        cwd: input.cwd,
        state: input.state,
        limit: input.limit,
      });
    },
    enabled:
      (input.enabled ?? true) &&
      input.cwd !== null &&
      hasCurrentNativeApiFeature("github.listIssues"),
    staleTime: GITHUB_ISSUES_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function githubLoginMutationOptions(input: {
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: ["github", "mutation", "login", input.cwd] as const,
    mutationFn: async () => {
      const api = ensureNativeApi();
      ensureCurrentNativeApiFeature("github.login");
      return api.github.login({
        cwd: input.cwd,
        hostname: "github.com",
        gitProtocol: "https",
      });
    },
    onSuccess: async () => {
      await invalidateGitHubQueries(input.queryClient);
    },
  });
}

export function githubCloseIssueMutationOptions(input: {
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: ["github", "mutation", "close-issue", input.cwd] as const,
    mutationFn: async ({ issueNumber, repo }: { issueNumber: number; repo?: string }) => {
      const api = ensureNativeApi();
      ensureCurrentNativeApiFeature("github.closeIssue");
      return api.github.closeIssue({
        cwd: input.cwd,
        issueNumber,
        ...(repo ? { repo } : {}),
      });
    },
    onSuccess: async () => {
      await invalidateGitHubQueries(input.queryClient);
    },
  });
}

export function githubCreateIssueMutationOptions(input: {
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: ["github", "mutation", "create-issue", input.cwd] as const,
    mutationFn: async ({
      title,
      body,
      repo,
    }: {
      title: string;
      body?: string | null;
      repo?: string;
    }) => {
      const api = ensureNativeApi();
      ensureCurrentNativeApiFeature("github.createIssue");
      return api.github.createIssue({
        cwd: input.cwd,
        title,
        ...(body !== undefined ? { body } : {}),
        ...(repo ? { repo } : {}),
      });
    },
    onSuccess: async () => {
      await invalidateGitHubQueries(input.queryClient);
    },
  });
}

export function githubReopenIssueMutationOptions(input: {
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: ["github", "mutation", "reopen-issue", input.cwd] as const,
    mutationFn: async ({ issueNumber, repo }: { issueNumber: number; repo?: string }) => {
      const api = ensureNativeApi();
      ensureCurrentNativeApiFeature("github.reopenIssue");
      return api.github.reopenIssue({
        cwd: input.cwd,
        issueNumber,
        ...(repo ? { repo } : {}),
      });
    },
    onSuccess: async () => {
      await invalidateGitHubQueries(input.queryClient);
    },
  });
}
