import type { EnvironmentId, GitHubIssueListState } from "@t3tools/contracts";
import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";

import { ensureEnvironmentApi } from "~/environmentApi";

const GITHUB_STATUS_STALE_TIME_MS = 10_000;
const GITHUB_ISSUES_STALE_TIME_MS = 15_000;

export const githubQueryKeys = {
  all: ["github"] as const,
  status: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["github", "status", environmentId ?? null, cwd] as const,
  issues: (
    environmentId: EnvironmentId | null,
    cwd: string | null,
    state: GitHubIssueListState,
    limit: number,
  ) => ["github", "issues", environmentId ?? null, cwd, state, limit] as const,
};

export function invalidateGitHubQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: githubQueryKeys.all });
}

export function githubStatusQueryOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
}) {
  return queryOptions({
    queryKey: githubQueryKeys.status(input.environmentId, input.cwd),
    queryFn: async () => {
      if (!input.environmentId) throw new Error("GitHub status is unavailable.");
      const api = ensureEnvironmentApi(input.environmentId);
      return api.github.status({ cwd: input.cwd, hostname: "github.com" });
    },
    enabled: input.environmentId !== null && input.cwd !== null,
    staleTime: GITHUB_STATUS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function githubIssuesQueryOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  state: GitHubIssueListState;
  limit: number;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: githubQueryKeys.issues(input.environmentId, input.cwd, input.state, input.limit),
    queryFn: async () => {
      if (!input.environmentId) throw new Error("GitHub issues are unavailable.");
      const api = ensureEnvironmentApi(input.environmentId);
      return api.github.listIssues({
        cwd: input.cwd,
        state: input.state,
        limit: input.limit,
      });
    },
    enabled: (input.enabled ?? true) && input.environmentId !== null && input.cwd !== null,
    staleTime: GITHUB_ISSUES_STALE_TIME_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function githubLoginMutationOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: ["github", "mutation", "login", input.environmentId ?? null, input.cwd] as const,
    mutationFn: async () => {
      if (!input.environmentId) throw new Error("GitHub login is unavailable.");
      const api = ensureEnvironmentApi(input.environmentId);
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
  environmentId: EnvironmentId | null;
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: [
      "github",
      "mutation",
      "close-issue",
      input.environmentId ?? null,
      input.cwd,
    ] as const,
    mutationFn: async ({ issueNumber, repo }: { issueNumber: number; repo?: string }) => {
      if (!input.environmentId) throw new Error("GitHub issue closing is unavailable.");
      const api = ensureEnvironmentApi(input.environmentId);
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
  environmentId: EnvironmentId | null;
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: [
      "github",
      "mutation",
      "create-issue",
      input.environmentId ?? null,
      input.cwd,
    ] as const,
    mutationFn: async ({
      title,
      body,
      repo,
    }: {
      title: string;
      body?: string | null;
      repo?: string;
    }) => {
      if (!input.environmentId) throw new Error("GitHub issue creation is unavailable.");
      const api = ensureEnvironmentApi(input.environmentId);
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
  environmentId: EnvironmentId | null;
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationKey: [
      "github",
      "mutation",
      "reopen-issue",
      input.environmentId ?? null,
      input.cwd,
    ] as const,
    mutationFn: async ({ issueNumber, repo }: { issueNumber: number; repo?: string }) => {
      if (!input.environmentId) throw new Error("GitHub issue reopening is unavailable.");
      const api = ensureEnvironmentApi(input.environmentId);
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
