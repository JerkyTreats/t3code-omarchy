import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import type { GitListBranchesResult, NativeApi } from "@t3tools/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  gitBranchSearchInfiniteQueryOptions,
  gitMergeBranchesMutationOptions,
  gitMutationKeys,
  gitPreparePullRequestThreadMutationOptions,
  gitPullMutationOptions,
  gitRepositoryContextQueryOptions,
  gitRunStackedActionMutationOptions,
  invalidateGitQueries,
} from "./gitReactQuery";
import { UnsupportedNativeApiFeatureError } from "../forkNativeApiAdapter";
import * as nativeApi from "../nativeApi";

afterEach(() => {
  vi.restoreAllMocks();
});

const BRANCH_QUERY_RESULT: GitListBranchesResult = {
  branches: [],
  isRepo: true,
  hasOriginRemote: true,
  nextCursor: null,
  totalCount: 0,
};

const BRANCH_SEARCH_RESULT: InfiniteData<GitListBranchesResult, number> = {
  pages: [BRANCH_QUERY_RESULT],
  pageParams: [0],
};

describe("gitMutationKeys", () => {
  it("scopes stacked action keys by cwd", () => {
    expect(gitMutationKeys.runStackedAction("/repo/a")).not.toEqual(
      gitMutationKeys.runStackedAction("/repo/b"),
    );
  });

  it("scopes pull keys by cwd", () => {
    expect(gitMutationKeys.pull("/repo/a")).not.toEqual(gitMutationKeys.pull("/repo/b"));
  });

  it("scopes pull request thread preparation keys by cwd", () => {
    expect(gitMutationKeys.preparePullRequestThread("/repo/a")).not.toEqual(
      gitMutationKeys.preparePullRequestThread("/repo/b"),
    );
  });
});

describe("git mutation options", () => {
  const queryClient = new QueryClient();

  it("attaches cwd-scoped mutation key for runStackedAction", () => {
    const options = gitRunStackedActionMutationOptions({
      cwd: "/repo/a",
      queryClient,
    });
    expect(options.mutationKey).toEqual(gitMutationKeys.runStackedAction("/repo/a"));
  });

  it("forwards promote target branch to the native API", async () => {
    const runStackedAction = vi.fn().mockResolvedValue({});
    vi.spyOn(nativeApi, "ensureNativeApi").mockReturnValue({
      git: {
        runStackedAction,
      },
    } as unknown as NativeApi);

    const options = gitRunStackedActionMutationOptions({ cwd: "/repo/a", queryClient });
    await options.mutationFn?.({ action: "promote", targetBranch: "main" }, {} as never);

    expect(runStackedAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: expect.any(String),
        cwd: "/repo/a",
        action: "promote",
        targetBranch: "main",
      }),
    );
  });

  it("forwards linked issues to the native API", async () => {
    const runStackedAction = vi.fn().mockResolvedValue({});
    vi.spyOn(nativeApi, "ensureNativeApi").mockReturnValue({
      git: {
        runStackedAction,
      },
    } as unknown as NativeApi);

    const options = gitRunStackedActionMutationOptions({ cwd: "/repo/a", queryClient });
    await options.mutationFn?.(
      {
        action: "commit_push_pr",
        issueLink: {
          repoNameWithOwner: "pingdotgg/codething-mvp",
          number: 123,
          title: "Linked issue",
          url: "https://github.com/pingdotgg/codething-mvp/issues/123",
          state: "open",
        },
      },
      {} as never,
    );

    expect(runStackedAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: expect.any(String),
        cwd: "/repo/a",
        action: "commit_push_pr",
        issueLink: {
          repoNameWithOwner: "pingdotgg/codething-mvp",
          number: 123,
          title: "Linked issue",
          url: "https://github.com/pingdotgg/codething-mvp/issues/123",
          state: "open",
        },
      }),
    );
  });

  it("attaches cwd-scoped mutation key for pull", () => {
    const options = gitPullMutationOptions({ cwd: "/repo/a", queryClient });
    expect(options.mutationKey).toEqual(gitMutationKeys.pull("/repo/a"));
  });

  it("attaches cwd-scoped mutation key for preparePullRequestThread", () => {
    const options = gitPreparePullRequestThreadMutationOptions({
      cwd: "/repo/a",
      queryClient,
    });
    expect(options.mutationKey).toEqual(gitMutationKeys.preparePullRequestThread("/repo/a"));
  });

  it("disables repository context queries when the transport does not support them", () => {
    vi.spyOn(nativeApi, "hasCurrentNativeApiFeature").mockReturnValue(false);

    const options = gitRepositoryContextQueryOptions("/repo/a");

    expect(options.enabled).toBe(false);
  });

  it("surfaces typed unsupported errors for merge actions on RPC transport", async () => {
    vi.spyOn(nativeApi, "ensureNativeApi").mockReturnValue({
      git: {
        mergeBranches: vi.fn(),
      },
    } as unknown as NativeApi);
    vi.spyOn(nativeApi, "ensureCurrentNativeApiFeature").mockImplementation(() => {
      throw new UnsupportedNativeApiFeatureError("git.mergeBranches");
    });

    const options = gitMergeBranchesMutationOptions({ cwd: "/repo/a", queryClient });

    await expect(
      options.mutationFn?.(
        {
          sourceBranch: "feature",
          targetBranch: "main",
        },
        {} as never,
      ),
    ).rejects.toBeInstanceOf(UnsupportedNativeApiFeatureError);
  });

  it("invalidates cwd-scoped branch search queries", async () => {
    queryClient.setQueryData(
      gitBranchSearchInfiniteQueryOptions({
        cwd: "/repo/a",
        query: "feature",
      }).queryKey,
      BRANCH_SEARCH_RESULT,
    );
    queryClient.setQueryData(
      gitBranchSearchInfiniteQueryOptions({
        cwd: "/repo/b",
        query: "feature",
      }).queryKey,
      BRANCH_SEARCH_RESULT,
    );

    await invalidateGitQueries(queryClient, { cwd: "/repo/a" });

    expect(
      queryClient.getQueryState(
        gitBranchSearchInfiniteQueryOptions({
          cwd: "/repo/a",
          query: "feature",
        }).queryKey,
      )?.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryState(
        gitBranchSearchInfiniteQueryOptions({
          cwd: "/repo/b",
          query: "feature",
        }).queryKey,
      )?.isInvalidated,
    ).toBe(false);
  });
});
