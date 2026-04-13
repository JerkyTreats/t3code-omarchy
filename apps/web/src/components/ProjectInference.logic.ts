import type { OrchestrationThreadActivity } from "@t3tools/contracts";

import { formatDuration } from "../session-logic";
import type { Thread } from "../types";

export interface ProjectInferenceRollup {
  totalDurationMs: number;
  recentDurationMs: number;
  totalTurns: number;
  recentTurns: number;
  totalLabel: string;
  recentLabel: string;
}

export interface ProjectInferenceLeaderboardEntry {
  threadId: Thread["id"];
  title: string;
  archivedAt: string | null;
  latestActivityAt: string;
  totalProcessedTokens: number;
  totalInputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalDurationMs: number;
  trackedTurns: number;
  averageProcessedTokensPerTurn: number;
}

export interface ProjectInferenceDashboardSnapshot {
  lifetimeTotalBurnTokens: number;
  lifetimeInputTokens: number;
  lifetimeCachedInputTokens: number;
  lifetimeOutputTokens: number;
  recentTotalBurnTokens: number;
  recentInputTokens: number;
  recentCachedInputTokens: number;
  recentOutputTokens: number;
  projectedMonthlyBurnTokens: number;
  averageBurnPerTrackedTurn: number;
  trackedTurns: number;
  recentTrackedTurns: number;
  leaderboard: ProjectInferenceLeaderboardEntry[];
}

interface LatestTurnUsageSnapshot {
  createdAt: string;
  durationMs: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalProcessedTokens: number;
}

function activityOrder(
  left: OrchestrationThreadActivity,
  right: OrchestrationThreadActivity,
): number {
  const leftSequence = left.sequence ?? Number.MAX_SAFE_INTEGER;
  const rightSequence = right.sequence ?? Number.MAX_SAFE_INTEGER;
  return (
    left.createdAt.localeCompare(right.createdAt) ||
    leftSequence - rightSequence ||
    left.id.localeCompare(right.id)
  );
}

function latestThreadActivityAt(thread: Thread): string {
  return (
    thread.latestTurn?.completedAt ??
    thread.latestTurn?.startedAt ??
    thread.updatedAt ??
    thread.createdAt
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveProcessedTokens(payload: Record<string, unknown>): number {
  const totalProcessedTokens = asFiniteNumber(payload.totalProcessedTokens);
  if (totalProcessedTokens !== null && totalProcessedTokens > 0) {
    return totalProcessedTokens;
  }

  // Cross-provider burn accounting is only reliable from totalProcessedTokens when present.
  // Without it, fall back to the closest per-snapshot estimate we have.
  const inputTokens = asFiniteNumber(payload.inputTokens) ?? 0;
  const cachedInputTokens = asFiniteNumber(payload.cachedInputTokens) ?? 0;
  const outputTokens = asFiniteNumber(payload.outputTokens) ?? 0;
  const reasoningOutputTokens = asFiniteNumber(payload.reasoningOutputTokens) ?? 0;
  const usedTokens = asFiniteNumber(payload.usedTokens) ?? 0;
  const componentTotal = inputTokens + cachedInputTokens + outputTokens + reasoningOutputTokens;

  return componentTotal > 0 ? Math.max(componentTotal, usedTokens) : usedTokens;
}

function collectLatestTurnUsageSnapshots(
  threads: ReadonlyArray<Thread>,
): Map<Thread["id"], Map<string, LatestTurnUsageSnapshot>> {
  const snapshotsByThreadId = new Map<Thread["id"], Map<string, LatestTurnUsageSnapshot>>();

  for (const thread of threads) {
    const latestUsageByTurnKey = new Map<string, LatestTurnUsageSnapshot>();
    for (const activity of [...thread.activities].toSorted(activityOrder)) {
      if (activity.kind !== "context-window.updated") {
        continue;
      }
      const payload = asRecord(activity.payload);
      if (!payload) {
        continue;
      }
      const processedTokens = resolveProcessedTokens(payload);
      const durationMs = asFiniteNumber(payload.durationMs) ?? 0;
      if (processedTokens <= 0 && durationMs <= 0) {
        continue;
      }

      latestUsageByTurnKey.set(activity.turnId ?? activity.id, {
        createdAt: activity.createdAt,
        durationMs,
        inputTokens: asFiniteNumber(payload.inputTokens) ?? 0,
        cachedInputTokens: asFiniteNumber(payload.cachedInputTokens) ?? 0,
        outputTokens: asFiniteNumber(payload.outputTokens) ?? 0,
        totalProcessedTokens: processedTokens,
      });
    }
    snapshotsByThreadId.set(thread.id, latestUsageByTurnKey);
  }

  return snapshotsByThreadId;
}

export function deriveProjectInferenceRollup(
  threads: ReadonlyArray<Thread>,
  nowIso: string,
): ProjectInferenceRollup {
  const cutoffMs = new Date(nowIso).getTime() - 7 * 24 * 60 * 60 * 1000;
  const latestUsageByThreadId = collectLatestTurnUsageSnapshots(threads);

  let totalDurationMs = 0;
  let recentDurationMs = 0;
  let totalTurns = 0;
  let recentTurns = 0;

  for (const latestUsageByTurnKey of latestUsageByThreadId.values()) {
    for (const usage of latestUsageByTurnKey.values()) {
      totalDurationMs += usage.durationMs;
      totalTurns += 1;
      if (new Date(usage.createdAt).getTime() >= cutoffMs) {
        recentDurationMs += usage.durationMs;
        recentTurns += 1;
      }
    }
  }

  return {
    totalDurationMs,
    recentDurationMs,
    totalTurns,
    recentTurns,
    totalLabel: formatDuration(totalDurationMs),
    recentLabel: formatDuration(recentDurationMs),
  };
}

export function buildProjectInferenceDashboardSnapshot(input: {
  nowIso?: string;
  threads: ReadonlyArray<Thread>;
}): ProjectInferenceDashboardSnapshot {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const cutoffMs = new Date(nowIso).getTime() - 7 * 24 * 60 * 60 * 1000;
  const latestUsageByThreadId = collectLatestTurnUsageSnapshots(input.threads);
  const leaderboard: ProjectInferenceLeaderboardEntry[] = [];
  let lifetimeTotalBurnTokens = 0;
  let lifetimeInputTokens = 0;
  let lifetimeCachedInputTokens = 0;
  let lifetimeOutputTokens = 0;
  let recentTotalBurnTokens = 0;
  let recentInputTokens = 0;
  let recentCachedInputTokens = 0;
  let recentOutputTokens = 0;
  let trackedTurns = 0;
  let recentTrackedTurns = 0;

  for (const thread of input.threads) {
    const usageByTurnKey = latestUsageByThreadId.get(thread.id) ?? new Map();
    let totalProcessedTokens = 0;
    let totalInputTokens = 0;
    let cachedInputTokens = 0;
    let outputTokens = 0;
    let totalDurationMs = 0;

    for (const usage of usageByTurnKey.values()) {
      totalProcessedTokens += usage.totalProcessedTokens;
      totalInputTokens += usage.inputTokens + usage.cachedInputTokens;
      cachedInputTokens += usage.cachedInputTokens;
      outputTokens += usage.outputTokens;
      totalDurationMs += usage.durationMs;
      trackedTurns += 1;
      lifetimeTotalBurnTokens += usage.totalProcessedTokens;
      lifetimeInputTokens += usage.inputTokens + usage.cachedInputTokens;
      lifetimeCachedInputTokens += usage.cachedInputTokens;
      lifetimeOutputTokens += usage.outputTokens;

      if (new Date(usage.createdAt).getTime() >= cutoffMs) {
        recentTrackedTurns += 1;
        recentTotalBurnTokens += usage.totalProcessedTokens;
        recentInputTokens += usage.inputTokens + usage.cachedInputTokens;
        recentCachedInputTokens += usage.cachedInputTokens;
        recentOutputTokens += usage.outputTokens;
      }
    }

    leaderboard.push({
      threadId: thread.id,
      title: thread.title,
      archivedAt: thread.archivedAt ?? null,
      latestActivityAt: latestThreadActivityAt(thread),
      totalProcessedTokens,
      totalInputTokens,
      cachedInputTokens,
      outputTokens,
      totalDurationMs,
      trackedTurns: usageByTurnKey.size,
      averageProcessedTokensPerTurn:
        usageByTurnKey.size > 0 ? Math.round(totalProcessedTokens / usageByTurnKey.size) : 0,
    });
  }

  leaderboard.sort(
    (left, right) =>
      right.totalProcessedTokens - left.totalProcessedTokens ||
      right.latestActivityAt.localeCompare(left.latestActivityAt) ||
      left.title.localeCompare(right.title),
  );

  return {
    lifetimeTotalBurnTokens,
    lifetimeInputTokens,
    lifetimeCachedInputTokens,
    lifetimeOutputTokens,
    recentTotalBurnTokens,
    recentInputTokens,
    recentCachedInputTokens,
    recentOutputTokens,
    projectedMonthlyBurnTokens:
      recentTotalBurnTokens > 0 ? Math.round((recentTotalBurnTokens / 7) * 30) : 0,
    averageBurnPerTrackedTurn:
      trackedTurns > 0 ? Math.round(lifetimeTotalBurnTokens / trackedTurns) : 0,
    trackedTurns,
    recentTrackedTurns,
    leaderboard,
  };
}
