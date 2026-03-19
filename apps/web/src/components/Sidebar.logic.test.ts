import { describe, expect, it } from "vitest";

import {
  deriveThreadActivityStatusFlags,
  hasUnseenCompletion,
  resolveSidebarNewThreadEnvMode,
  resolveThreadRowClassName,
  resolveThreadStatusPill,
  shouldClearThreadSelectionOnMouseDown,
} from "./Sidebar.logic";

function makeLatestTurn(overrides?: {
  completedAt?: string | null;
  startedAt?: string | null;
}): Parameters<typeof hasUnseenCompletion>[0]["latestTurn"] {
  return {
    turnId: "turn-1" as never,
    state: "completed",
    assistantMessageId: null,
    requestedAt: "2026-03-09T10:00:00.000Z",
    startedAt: overrides?.startedAt ?? "2026-03-09T10:00:00.000Z",
    completedAt: overrides?.completedAt ?? "2026-03-09T10:05:00.000Z",
  };
}

function makePlanActivity(input: {
  createdAt?: string;
  sequence?: number;
  turnId?: string;
  steps: ReadonlyArray<{
    step: string;
    status: "pending" | "inProgress" | "completed";
  }>;
}): NonNullable<Parameters<typeof deriveThreadActivityStatusFlags>[0]>[number] {
  return {
    id: `evt-${input.sequence ?? 1}` as never,
    tone: "info",
    kind: "turn.plan.updated",
    summary: "Plan updated",
    payload: { plan: input.steps },
    turnId: (input.turnId ?? "turn-1") as never,
    sequence: input.sequence ?? 1,
    createdAt: input.createdAt ?? "2026-03-09T10:00:00.000Z",
  };
}

describe("hasUnseenCompletion", () => {
  it("returns true when a thread completed after its last visit", () => {
    expect(
      hasUnseenCompletion({
        activities: [],
        interactionMode: "default",
        latestTurn: makeLatestTurn(),
        lastVisitedAt: "2026-03-09T10:04:00.000Z",
        proposedPlans: [],
        session: null,
      }),
    ).toBe(true);
  });
});

describe("shouldClearThreadSelectionOnMouseDown", () => {
  it("preserves selection for thread items", () => {
    const child = {
      closest: (selector: string) =>
        selector.includes("[data-thread-item]") ? ({} as Element) : null,
    } as unknown as HTMLElement;

    expect(shouldClearThreadSelectionOnMouseDown(child)).toBe(false);
  });

  it("preserves selection for thread list toggle controls", () => {
    const selectionSafe = {
      closest: (selector: string) =>
        selector.includes("[data-thread-selection-safe]") ? ({} as Element) : null,
    } as unknown as HTMLElement;

    expect(shouldClearThreadSelectionOnMouseDown(selectionSafe)).toBe(false);
  });

  it("clears selection for unrelated sidebar clicks", () => {
    const unrelated = {
      closest: () => null,
    } as unknown as HTMLElement;

    expect(shouldClearThreadSelectionOnMouseDown(unrelated)).toBe(true);
  });
});

describe("resolveSidebarNewThreadEnvMode", () => {
  it("uses the app default when the caller does not request a specific mode", () => {
    expect(
      resolveSidebarNewThreadEnvMode({
        defaultEnvMode: "worktree",
      }),
    ).toBe("worktree");
  });

  it("preserves an explicit requested mode over the app default", () => {
    expect(
      resolveSidebarNewThreadEnvMode({
        requestedEnvMode: "local",
        defaultEnvMode: "worktree",
      }),
    ).toBe("local");
  });
});

describe("resolveThreadStatusPill", () => {
  const baseThread = {
    activities: [],
    interactionMode: "plan" as const,
    latestTurn: null,
    lastVisitedAt: undefined,
    proposedPlans: [],
    session: {
      provider: "codex" as const,
      status: "running" as const,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z",
      orchestrationStatus: "running" as const,
    },
  };

  it("shows pending approval before all other statuses", () => {
    expect(
      resolveThreadStatusPill({
        thread: baseThread,
        hasPendingApprovals: true,
        hasPendingUserInput: true,
      }),
    ).toMatchObject({ label: "Pending Approval", pulse: false });
  });

  it("shows awaiting input when plan mode is blocked on user answers", () => {
    expect(
      resolveThreadStatusPill({
        thread: baseThread,
        hasPendingApprovals: false,
        hasPendingUserInput: true,
      }),
    ).toMatchObject({ label: "Awaiting Input", pulse: false });
  });

  it("suppresses a stale completed pill while a new local turn is starting", () => {
    expect(
      resolveThreadStatusPill({
        thread: {
          ...baseThread,
          interactionMode: "default",
          latestTurn: makeLatestTurn(),
          lastVisitedAt: "2026-03-09T10:04:00.000Z",
          session: {
            ...baseThread.session,
            status: "ready",
            orchestrationStatus: "ready",
          },
        },
        hasPendingApprovals: false,
        hasPendingLocalTurnStart: true,
        hasPendingUserInput: false,
      }),
    ).toMatchObject({ label: "Working", pulse: true });
  });

  it("falls back to working when the thread is actively running without blockers", () => {
    expect(
      resolveThreadStatusPill({
        thread: baseThread,
        hasPendingApprovals: false,
        hasPendingUserInput: false,
      }),
    ).toMatchObject({ label: "Working", pulse: true });
  });

  it("does not reuse a stale historical plan when the latest turn is missing", () => {
    expect(
      resolveThreadStatusPill({
        thread: {
          ...baseThread,
          activities: [
            makePlanActivity({
              createdAt: "2026-03-09T06:20:46.000Z",
              turnId: "turn-old",
              steps: [
                { step: "Capture Tailscale versions and sources", status: "completed" },
                { step: "Write DNS capability whitepaper", status: "completed" },
                { step: "Update plan and endpoint spec", status: "completed" },
                { step: "Run doc sanity checks", status: "completed" },
              ],
            }),
          ],
          latestTurn: null,
        },
        hasPendingApprovals: false,
        hasPendingUserInput: false,
      }),
    ).toMatchObject({ label: "Working", pulse: true });
  });

  it("shows current plan progress while the thread is running", () => {
    expect(
      resolveThreadStatusPill({
        thread: {
          ...baseThread,
          activities: [
            makePlanActivity({
              steps: [
                { step: "Collect moonbeans", status: "completed" },
                { step: "Polish the cloud", status: "completed" },
                { step: "Fold the thunder", status: "inProgress" },
                { step: "Ship the rainbow", status: "pending" },
              ],
            }),
          ],
          latestTurn: makeLatestTurn({ completedAt: null }),
        },
        hasPendingApprovals: false,
        hasPendingUserInput: false,
      }),
    ).toMatchObject({ label: "3/4", pulse: true });
  });

  it("uses the latest plan update for the active turn", () => {
    expect(
      resolveThreadStatusPill({
        thread: {
          ...baseThread,
          activities: [
            makePlanActivity({
              sequence: 1,
              steps: [
                { step: "Warm the spoon", status: "completed" },
                { step: "Stir the void", status: "inProgress" },
              ],
            }),
            makePlanActivity({
              sequence: 2,
              steps: [
                { step: "Warm the spoon", status: "completed" },
                { step: "Stir the void", status: "completed" },
                { step: "Tune the toaster", status: "inProgress" },
                { step: "Launch the pancake", status: "pending" },
              ],
            }),
          ],
          latestTurn: makeLatestTurn({ completedAt: null }),
        },
        hasPendingApprovals: false,
        hasPendingUserInput: false,
      }),
    ).toMatchObject({ label: "3/4", pulse: true });
  });

  it("uses the newest plan update even when activities are out of array order", () => {
    expect(
      resolveThreadStatusPill({
        thread: {
          ...baseThread,
          activities: [
            makePlanActivity({
              sequence: 3,
              createdAt: "2026-03-09T10:00:03.000Z",
              steps: [
                { step: "Warm the spoon", status: "completed" },
                { step: "Stir the void", status: "completed" },
                { step: "Tune the toaster", status: "inProgress" },
                { step: "Launch the pancake", status: "pending" },
              ],
            }),
            makePlanActivity({
              sequence: 1,
              createdAt: "2026-03-09T10:00:01.000Z",
              steps: [
                { step: "Warm the spoon", status: "completed" },
                { step: "Stir the void", status: "inProgress" },
              ],
            }),
          ],
          latestTurn: makeLatestTurn({ completedAt: null }),
        },
        hasPendingApprovals: false,
        hasPendingUserInput: false,
      }),
    ).toMatchObject({ label: "3/4", pulse: true });
  });

  it("shows completed once every plan step is complete", () => {
    expect(
      resolveThreadStatusPill({
        thread: {
          ...baseThread,
          activities: [
            makePlanActivity({
              steps: [
                { step: "Wake the bears", status: "completed" },
                { step: "Bake the stars", status: "completed" },
                { step: "Paint the wind", status: "completed" },
                { step: "Wave goodbye", status: "completed" },
              ],
            }),
          ],
          latestTurn: makeLatestTurn({ completedAt: null }),
        },
        hasPendingApprovals: false,
        hasPendingUserInput: false,
      }),
    ).toMatchObject({ label: "Completed", pulse: false });
  });

  it("shows plan ready when a settled plan turn has a proposed plan ready for follow-up", () => {
    expect(
      resolveThreadStatusPill({
        thread: {
          ...baseThread,
          latestTurn: makeLatestTurn(),
          proposedPlans: [
            {
              id: "plan-1" as never,
              turnId: "turn-1" as never,
              createdAt: "2026-03-09T10:00:00.000Z",
              updatedAt: "2026-03-09T10:05:00.000Z",
              planMarkdown: "# Plan",
              implementedAt: null,
              implementationThreadId: null,
            },
          ],
          session: {
            ...baseThread.session,
            status: "ready",
            orchestrationStatus: "ready",
          },
        },
        hasPendingApprovals: false,
        hasPendingUserInput: false,
      }),
    ).toMatchObject({ label: "Plan Ready", pulse: false });
  });

  it("does not show plan ready after the proposed plan was implemented elsewhere", () => {
    expect(
      resolveThreadStatusPill({
        thread: {
          ...baseThread,
          latestTurn: makeLatestTurn(),
          proposedPlans: [
            {
              id: "plan-1" as never,
              turnId: "turn-1" as never,
              createdAt: "2026-03-09T10:00:00.000Z",
              updatedAt: "2026-03-09T10:05:00.000Z",
              planMarkdown: "# Plan",
              implementedAt: "2026-03-09T10:06:00.000Z",
              implementationThreadId: "thread-implement" as never,
            },
          ],
          session: {
            ...baseThread.session,
            status: "ready",
            orchestrationStatus: "ready",
          },
        },
        hasPendingApprovals: false,
        hasPendingUserInput: false,
      }),
    ).toMatchObject({ label: "Completed", pulse: false });
  });

  it("shows completed when there is an unseen completion and no active blocker", () => {
    expect(
      resolveThreadStatusPill({
        thread: {
          ...baseThread,
          interactionMode: "default",
          latestTurn: makeLatestTurn(),
          lastVisitedAt: "2026-03-09T10:04:00.000Z",
          session: {
            ...baseThread.session,
            status: "ready",
            orchestrationStatus: "ready",
          },
        },
        hasPendingApprovals: false,
        hasPendingUserInput: false,
      }),
    ).toMatchObject({ label: "Completed", pulse: false });
  });
});

describe("deriveThreadActivityStatusFlags", () => {
  it("tracks pending approvals and pending user input in one pass", () => {
    expect(
      deriveThreadActivityStatusFlags([
        {
          id: "evt-approval-requested" as never,
          tone: "approval",
          kind: "approval.requested",
          summary: "Approval requested",
          payload: {
            requestId: "approval-1",
            requestKind: "command",
          },
          turnId: "turn-1" as never,
          sequence: 1,
          createdAt: "2026-03-09T10:00:00.000Z",
        },
        {
          id: "evt-user-input-requested" as never,
          tone: "info",
          kind: "user-input.requested",
          summary: "User input requested",
          payload: {
            requestId: "input-1",
            questions: [
              {
                id: "question-1",
                header: "Need input",
                question: "Pick one",
                options: [{ label: "A", description: "Option A" }],
              },
            ],
          },
          turnId: "turn-1" as never,
          sequence: 2,
          createdAt: "2026-03-09T10:00:01.000Z",
        },
        {
          id: "evt-approval-resolved" as never,
          tone: "approval",
          kind: "approval.resolved",
          summary: "Approval resolved",
          payload: {
            requestId: "approval-1",
          },
          turnId: "turn-1" as never,
          sequence: 3,
          createdAt: "2026-03-09T10:00:02.000Z",
        },
      ]),
    ).toEqual({
      hasPendingApprovals: false,
      hasPendingUserInput: true,
    });
  });

  it("stays correct when request activities are out of array order", () => {
    expect(
      deriveThreadActivityStatusFlags([
        {
          id: "evt-user-input-resolved" as never,
          tone: "info",
          kind: "user-input.resolved",
          summary: "User input resolved",
          payload: {
            requestId: "input-1",
          },
          turnId: "turn-1" as never,
          sequence: 4,
          createdAt: "2026-03-09T10:00:03.000Z",
        },
        {
          id: "evt-approval-requested" as never,
          tone: "approval",
          kind: "approval.requested",
          summary: "Approval requested",
          payload: {
            requestId: "approval-1",
            requestKind: "command",
          },
          turnId: "turn-1" as never,
          sequence: 1,
          createdAt: "2026-03-09T10:00:00.000Z",
        },
        {
          id: "evt-approval-resolved" as never,
          tone: "approval",
          kind: "approval.resolved",
          summary: "Approval resolved",
          payload: {
            requestId: "approval-1",
          },
          turnId: "turn-1" as never,
          sequence: 2,
          createdAt: "2026-03-09T10:00:01.000Z",
        },
        {
          id: "evt-user-input-requested" as never,
          tone: "info",
          kind: "user-input.requested",
          summary: "User input requested",
          payload: {
            requestId: "input-1",
            questions: [
              {
                id: "question-1",
                header: "Need input",
                question: "Pick one",
                options: [{ label: "A", description: "Option A" }],
              },
            ],
          },
          turnId: "turn-1" as never,
          sequence: 3,
          createdAt: "2026-03-09T10:00:02.000Z",
        },
      ]),
    ).toEqual({
      hasPendingApprovals: false,
      hasPendingUserInput: false,
    });
  });
});

describe("resolveThreadRowClassName", () => {
  it("uses the darker selected palette when a thread is both selected and active", () => {
    const className = resolveThreadRowClassName({ isActive: true, isSelected: true });
    expect(className).toContain("bg-primary/22");
    expect(className).toContain("hover:bg-primary/26");
    expect(className).toContain("dark:bg-primary/30");
    expect(className).not.toContain("bg-accent/85");
  });

  it("uses selected hover colors for selected threads", () => {
    const className = resolveThreadRowClassName({ isActive: false, isSelected: true });
    expect(className).toContain("bg-primary/15");
    expect(className).toContain("hover:bg-primary/19");
    expect(className).toContain("dark:bg-primary/22");
    expect(className).not.toContain("hover:bg-accent");
  });

  it("keeps the accent palette for active-only threads", () => {
    const className = resolveThreadRowClassName({ isActive: true, isSelected: false });
    expect(className).toContain("bg-accent/85");
    expect(className).toContain("hover:bg-accent");
  });
});
