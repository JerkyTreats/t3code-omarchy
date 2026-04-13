import { describe, expect, it } from "vitest";

import { buildProjectInferenceDashboardSnapshot } from "./ProjectInference.logic";
import {
  DEFAULT_INTERACTION_MODE,
  DEFAULT_RUNTIME_MODE,
  type Thread,
  type ThreadSession,
} from "../types";

function makeSession(): ThreadSession {
  return {
    provider: "codex",
    status: "ready",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
    orchestrationStatus: "ready",
  };
}

function makeThread(
  overrides: Partial<Thread> & Pick<Thread, "id" | "projectId" | "title">,
): Thread {
  const { id, projectId, title, ...rest } = overrides;
  return {
    id,
    codexThreadId: null,
    projectId,
    title,
    modelSelection: {
      provider: "codex",
      model: "gpt-5-codex",
    },
    runtimeMode: DEFAULT_RUNTIME_MODE,
    interactionMode: DEFAULT_INTERACTION_MODE,
    session: makeSession(),
    messages: [],
    proposedPlans: [],
    error: null,
    createdAt: "2026-03-01T10:00:00.000Z",
    archivedAt: null,
    runtime: null,
    updatedAt: "2026-03-01T10:00:00.000Z",
    latestTurn: null,
    branch: null,
    worktreePath: null,
    turnDiffSummaries: [],
    activities: [],
    ...rest,
  };
}

describe("buildProjectInferenceDashboardSnapshot", () => {
  it("builds lifetime burn totals and a leaderboard from the latest snapshot per turn", () => {
    const snapshot = buildProjectInferenceDashboardSnapshot({
      nowIso: "2026-03-12T10:00:00.000Z",
      threads: [
        makeThread({
          id: "thread-1" as never,
          projectId: "project-1" as never,
          title: "Fix auth flow",
          updatedAt: "2026-03-12T09:00:00.000Z",
          activities: [
            {
              id: "activity-1" as never,
              tone: "info",
              kind: "context-window.updated",
              summary: "Usage updated",
              payload: {
                totalProcessedTokens: 2_000,
                inputTokens: 1_600,
                outputTokens: 180,
                durationMs: 1_000,
              },
              turnId: "turn-1" as never,
              sequence: 1,
              createdAt: "2026-03-11T09:00:00.000Z",
            },
            {
              id: "activity-2" as never,
              tone: "info",
              kind: "context-window.updated",
              summary: "Usage updated",
              payload: {
                totalProcessedTokens: 2_500,
                inputTokens: 2_000,
                outputTokens: 220,
                durationMs: 1_600,
              },
              turnId: "turn-1" as never,
              sequence: 2,
              createdAt: "2026-03-11T09:01:00.000Z",
            },
            {
              id: "activity-3" as never,
              tone: "info",
              kind: "context-window.updated",
              summary: "Usage updated",
              payload: {
                totalProcessedTokens: 1_500,
                inputTokens: 1_000,
                outputTokens: 140,
                durationMs: 900,
              },
              turnId: "turn-2" as never,
              sequence: 3,
              createdAt: "2026-03-02T09:00:00.000Z",
            },
          ],
        }),
        makeThread({
          id: "thread-2" as never,
          projectId: "project-1" as never,
          title: "Refactor sidebar",
          updatedAt: "2026-03-10T11:00:00.000Z",
          archivedAt: "2026-03-11T11:00:00.000Z",
          activities: [
            {
              id: "activity-4" as never,
              tone: "info",
              kind: "context-window.updated",
              summary: "Usage updated",
              payload: {
                usedTokens: 900,
                inputTokens: 700,
                outputTokens: 90,
                durationMs: 700,
              },
              turnId: "turn-3" as never,
              sequence: 1,
              createdAt: "2026-02-25T11:00:00.000Z",
            },
          ],
        }),
      ],
    });

    expect(snapshot.lifetimeTotalBurnTokens).toBe(4_900);
    expect(snapshot.lifetimeInputTokens).toBe(3_700);
    expect(snapshot.lifetimeCachedInputTokens).toBe(0);
    expect(snapshot.lifetimeOutputTokens).toBe(450);
    expect(snapshot.recentTotalBurnTokens).toBe(2_500);
    expect(snapshot.recentInputTokens).toBe(2_000);
    expect(snapshot.recentCachedInputTokens).toBe(0);
    expect(snapshot.recentOutputTokens).toBe(220);
    expect(snapshot.projectedMonthlyBurnTokens).toBe(10_714);
    expect(snapshot.averageBurnPerTrackedTurn).toBe(1_633);
    expect(snapshot.trackedTurns).toBe(3);
    expect(snapshot.recentTrackedTurns).toBe(1);
    expect(snapshot.leaderboard.map((entry) => entry.threadId)).toEqual(["thread-1", "thread-2"]);
    expect(snapshot.leaderboard[0]).toMatchObject({
      totalProcessedTokens: 4_000,
      trackedTurns: 2,
      totalInputTokens: 3_000,
      cachedInputTokens: 0,
      outputTokens: 360,
      averageProcessedTokensPerTurn: 2_000,
    });
    expect(snapshot.leaderboard[1]).toMatchObject({
      archivedAt: "2026-03-11T11:00:00.000Z",
      totalProcessedTokens: 900,
      trackedTurns: 1,
      totalInputTokens: 700,
      cachedInputTokens: 0,
      outputTokens: 90,
      averageProcessedTokensPerTurn: 900,
    });
  });
});
