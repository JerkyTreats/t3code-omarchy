import type { NativeApi } from "@t3tools/contracts";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
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
