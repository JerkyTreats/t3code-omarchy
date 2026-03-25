import type { NativeApi } from "@t3tools/contracts";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  gitMutationKeys,
  gitPreparePullRequestThreadMutationOptions,
  gitPullMutationOptions,
  gitRunStackedActionMutationOptions,
} from "./gitReactQuery";
import * as nativeApi from "../nativeApi";

afterEach(() => {
  vi.restoreAllMocks();
});

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
    const options = gitRunStackedActionMutationOptions({ cwd: "/repo/a", queryClient });
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
});
