import type { GitStatusResult } from "@t3tools/contracts";
import { ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import { resolveGitHubIssueWorkflowState } from "./githubIssueWorkflow";
import type { Thread } from "./types";
import { DEFAULT_INTERACTION_MODE, DEFAULT_RUNTIME_MODE } from "./types";

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: ThreadId.makeUnsafe("thread-1"),
    codexThreadId: null,
    projectId: ProjectId.makeUnsafe("project-1"),
    title: "Thread",
    modelSelection: {
      provider: "codex",
      model: "gpt-5-codex",
    },
    runtimeMode: DEFAULT_RUNTIME_MODE,
    interactionMode: DEFAULT_INTERACTION_MODE,
    session: null,
    messages: [],
    turnDiffSummaries: [],
    activities: [],
    proposedPlans: [],
    error: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    latestTurn: null,
    lastVisitedAt: "2026-03-01T00:00:00.000Z",
    branch: null,
    worktreePath: null,
    issueLink: null,
    ...overrides,
  };
}

function makeActivePr(
  overrides: Partial<NonNullable<GitStatusResult["pr"]>> = {},
): NonNullable<GitStatusResult["pr"]> {
  return {
    state: "open",
    number: 123,
    url: "https://github.com/pingdotgg/codething-mvp/pull/123",
    baseBranch: "main",
    headBranch: "feature/issue-123",
    title: "Fix linked issue",
    ...overrides,
  };
}

describe("resolveGitHubIssueWorkflowState", () => {
  it("returns resolve for open issues without a linked thread", () => {
    const state = resolveGitHubIssueWorkflowState({
      issue: { number: 123, state: "open" },
      repoNameWithOwner: "pingdotgg/codething-mvp",
      threads: [],
      activeThreadId: null,
      activeIssueLink: null,
      activePr: null,
    });

    expect(state.action.kind).toBe("resolve");
    expect(state.badges).toEqual([]);
  });

  it("returns continue for linked issues on another thread", () => {
    const thread = makeThread({
      issueLink: {
        repoNameWithOwner: "pingdotgg/codething-mvp",
        number: 123,
        title: "Linked issue",
        url: "https://github.com/pingdotgg/codething-mvp/issues/123",
        state: "open",
      },
    });

    const state = resolveGitHubIssueWorkflowState({
      issue: { number: 123, state: "open" },
      repoNameWithOwner: "pingdotgg/codething-mvp",
      threads: [thread],
      activeThreadId: ThreadId.makeUnsafe("other-thread"),
      activeIssueLink: null,
      activePr: null,
    });

    expect(state.action).toEqual({ kind: "continue", threadId: thread.id });
    expect(state.badges.map((badge) => badge.label)).toContain("Thread");
  });

  it("returns open_pr for the active linked issue with an open PR", () => {
    const thread = makeThread({
      issueLink: {
        repoNameWithOwner: "pingdotgg/codething-mvp",
        number: 123,
        title: "Linked issue",
        url: "https://github.com/pingdotgg/codething-mvp/issues/123",
        state: "open",
      },
    });

    const state = resolveGitHubIssueWorkflowState({
      issue: { number: 123, state: "open" },
      repoNameWithOwner: "pingdotgg/codething-mvp",
      threads: [thread],
      activeThreadId: thread.id,
      activeIssueLink: thread.issueLink,
      activePr: makeActivePr(),
    });

    expect(state.action).toEqual({
      kind: "open_pr",
      url: "https://github.com/pingdotgg/codething-mvp/pull/123",
    });
    expect(state.badges.map((badge) => badge.label)).toContain("PR open");
  });

  it("returns view for closed issues without a linked thread", () => {
    const state = resolveGitHubIssueWorkflowState({
      issue: { number: 123, state: "closed" },
      repoNameWithOwner: "pingdotgg/codething-mvp",
      threads: [],
      activeThreadId: null,
      activeIssueLink: null,
      activePr: null,
    });

    expect(state.action.kind).toBe("view");
    expect(state.badges.map((badge) => badge.label)).toContain("Closed");
  });
});
