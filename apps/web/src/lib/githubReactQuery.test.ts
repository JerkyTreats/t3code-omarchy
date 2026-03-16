import type { NativeApi } from "@t3tools/contracts";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  githubCreateIssueMutationOptions,
  githubCloseIssueMutationOptions,
  githubReopenIssueMutationOptions,
} from "./githubReactQuery";
import * as nativeApi from "../nativeApi";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("github mutation options", () => {
  const queryClient = new QueryClient();

  it("forwards close issue requests to the native API", async () => {
    const closeIssue = vi.fn().mockResolvedValue({ number: 123, state: "closed" });
    vi.spyOn(nativeApi, "ensureNativeApi").mockReturnValue({
      github: {
        closeIssue,
      },
    } as unknown as NativeApi);

    const options = githubCloseIssueMutationOptions({ cwd: "/repo/a", queryClient });
    await options.mutationFn?.({ issueNumber: 123, repo: "pingdotgg/codething-mvp" }, {} as never);

    expect(closeIssue).toHaveBeenCalledWith({
      cwd: "/repo/a",
      issueNumber: 123,
      repo: "pingdotgg/codething-mvp",
    });
  });

  it("forwards create issue requests to the native API", async () => {
    const createIssue = vi.fn().mockResolvedValue({
      number: 321,
      title: "Panel issue creation",
      state: "open",
      url: "https://github.com/pingdotgg/codething-mvp/issues/321",
      body: "Created from the panel",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      labels: [],
      assignees: [],
      author: "tester",
    });
    vi.spyOn(nativeApi, "ensureNativeApi").mockReturnValue({
      github: {
        createIssue,
      },
    } as unknown as NativeApi);

    const options = githubCreateIssueMutationOptions({ cwd: "/repo/a", queryClient });
    await options.mutationFn?.(
      {
        title: "Panel issue creation",
        body: "Created from the panel",
        repo: "pingdotgg/codething-mvp",
      },
      {} as never,
    );

    expect(createIssue).toHaveBeenCalledWith({
      cwd: "/repo/a",
      title: "Panel issue creation",
      body: "Created from the panel",
      repo: "pingdotgg/codething-mvp",
    });
  });

  it("forwards reopen issue requests to the native API", async () => {
    const reopenIssue = vi.fn().mockResolvedValue({ number: 123, state: "open" });
    vi.spyOn(nativeApi, "ensureNativeApi").mockReturnValue({
      github: {
        reopenIssue,
      },
    } as unknown as NativeApi);

    const options = githubReopenIssueMutationOptions({ cwd: "/repo/a", queryClient });
    await options.mutationFn?.({ issueNumber: 123, repo: "pingdotgg/codething-mvp" }, {} as never);

    expect(reopenIssue).toHaveBeenCalledWith({
      cwd: "/repo/a",
      issueNumber: 123,
      repo: "pingdotgg/codething-mvp",
    });
  });
});
