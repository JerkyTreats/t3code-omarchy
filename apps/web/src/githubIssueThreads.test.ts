import { describe, expect, it } from "vitest";

import type { GitHubIssue } from "@t3tools/contracts";

import {
  buildIssueResolutionPrompt,
  buildIssueThreadTitle,
  buildIssueWorkspaceBranchName,
} from "./githubIssueThreads";

function createIssue(overrides?: Partial<GitHubIssue>): GitHubIssue {
  return {
    number: 123,
    title: "Fix composer send state after reconnect",
    state: "open",
    url: "https://github.com/pingdotgg/t3code/issues/123",
    body: "The composer stays disabled after the websocket reconnects.",
    createdAt: "2026-03-12T10:00:00Z",
    updatedAt: "2026-03-13T15:30:00Z",
    labels: [{ name: "bug", color: "d73a4a" }],
    assignees: [{ login: "theo" }],
    author: "alice",
    ...overrides,
  };
}

describe("githubIssueThreads", () => {
  it("builds a stable issue branch name and avoids collisions", () => {
    const branchName = buildIssueWorkspaceBranchName(createIssue(), [
      "main",
      "t3code/issue-123/fix-composer-send-state-after-reconnect",
    ]);

    expect(branchName).toBe("t3code/issue-123/fix-composer-send-state-after-reconnect-2");
  });

  it("builds a concise issue thread title", () => {
    expect(buildIssueThreadTitle(createIssue())).toBe(
      "#123 Fix composer send state after reconnect",
    );
  });

  it("builds a resolution prompt with issue metadata and body", () => {
    const prompt = buildIssueResolutionPrompt({
      issue: createIssue(),
      baseBranch: "main",
      repoNameWithOwner: "pingdotgg/t3code",
    });

    expect(prompt).toContain("Resolve GitHub issue #123: Fix composer send state after reconnect");
    expect(prompt).toContain("Repository: pingdotgg/t3code");
    expect(prompt).toContain("Base branch: main");
    expect(prompt).toContain("Labels: bug");
    expect(prompt).toContain("Assignees: @theo");
    expect(prompt).toContain("The composer stays disabled after the websocket reconnects.");
  });

  it("falls back when the issue body is empty", () => {
    const prompt = buildIssueResolutionPrompt({
      issue: createIssue({ body: null }),
      baseBranch: null,
      repoNameWithOwner: null,
    });

    expect(prompt).toContain("No issue description was provided.");
  });
});
