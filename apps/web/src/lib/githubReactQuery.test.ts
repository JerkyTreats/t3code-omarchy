import type { EnvironmentApi } from "@t3tools/contracts";
import { EnvironmentId } from "@t3tools/contracts";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../environmentApi", () => ({
  ensureEnvironmentApi: vi.fn(),
}));

import {
  githubCreateIssueMutationOptions,
  githubCloseIssueMutationOptions,
  githubReopenIssueMutationOptions,
  githubStatusQueryOptions,
} from "./githubReactQuery";
import { ensureEnvironmentApi } from "../environmentApi";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("github mutation options", () => {
  const queryClient = new QueryClient();
  const environmentId = EnvironmentId.make("environment-a");

  it("forwards close issue requests to the environment API", async () => {
    const closeIssue = vi.fn().mockResolvedValue({ number: 123, state: "closed" });
    vi.mocked(ensureEnvironmentApi).mockReturnValue({
      github: {
        closeIssue,
      },
    } as unknown as EnvironmentApi);

    const options = githubCloseIssueMutationOptions({ environmentId, cwd: "/repo/a", queryClient });
    await options.mutationFn?.({ issueNumber: 123, repo: "pingdotgg/codething-mvp" }, {} as never);

    expect(closeIssue).toHaveBeenCalledWith({
      cwd: "/repo/a",
      issueNumber: 123,
      repo: "pingdotgg/codething-mvp",
    });
  });

  it("forwards create issue requests to the environment API", async () => {
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
    vi.mocked(ensureEnvironmentApi).mockReturnValue({
      github: {
        createIssue,
      },
    } as unknown as EnvironmentApi);

    const options = githubCreateIssueMutationOptions({
      environmentId,
      cwd: "/repo/a",
      queryClient,
    });
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

  it("forwards reopen issue requests to the environment API", async () => {
    const reopenIssue = vi.fn().mockResolvedValue({ number: 123, state: "open" });
    vi.mocked(ensureEnvironmentApi).mockReturnValue({
      github: {
        reopenIssue,
      },
    } as unknown as EnvironmentApi);

    const options = githubReopenIssueMutationOptions({
      environmentId,
      cwd: "/repo/a",
      queryClient,
    });
    await options.mutationFn?.({ issueNumber: 123, repo: "pingdotgg/codething-mvp" }, {} as never);

    expect(reopenIssue).toHaveBeenCalledWith({
      cwd: "/repo/a",
      issueNumber: 123,
      repo: "pingdotgg/codething-mvp",
    });
  });

  it("disables github status queries without an environment", () => {
    const options = githubStatusQueryOptions({ environmentId: null, cwd: "/repo/a" });

    expect(options.enabled).toBe(false);
  });
});
