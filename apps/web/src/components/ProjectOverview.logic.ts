import type {
  GitRepositoryContextResult,
  GitStatusResult,
  OrchestrationThreadActivity,
} from "@t3tools/contracts";

import { deriveWorkLogEntries, formatDuration } from "../session-logic";
import { type Thread } from "../types";

export interface ProjectOverviewLinkedThread {
  id: Thread["id"];
  title: string;
  branch: string | null;
  worktreePath: string | null;
  archivedAt: string | null;
  latestActivityAt: string;
}

export interface ProjectOverviewRecentWorkEntry {
  id: string;
  threadId: Thread["id"];
  threadTitle: string;
  createdAt: string;
  label: string;
  detail?: string;
  command?: string;
  tone: "info" | "tool" | "error" | "thinking";
}

export interface ProjectInferenceRollup {
  totalDurationMs: number;
  recentDurationMs: number;
  totalTurns: number;
  recentTurns: number;
  totalLabel: string;
  recentLabel: string;
}

export interface ProjectRepoSummary {
  statusLabel: string;
  branchLabel: string;
  remoteLabel: string;
  workspaceKindLabel: string;
}

export interface ProjectOverviewSnapshot {
  activeThreadCount: number;
  archivedThreadCount: number;
  linkedThreads: ProjectOverviewLinkedThread[];
  recentWork: ProjectOverviewRecentWorkEntry[];
  inference: ProjectInferenceRollup;
  branches: string[];
  worktreeCount: number;
  repoSummary: ProjectRepoSummary;
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

function deriveInferenceRollup(
  threads: ReadonlyArray<Thread>,
  nowIso: string,
): ProjectInferenceRollup {
  const cutoffMs = new Date(nowIso).getTime() - 7 * 24 * 60 * 60 * 1000;
  const latestUsageByTurnKey = new Map<
    string,
    {
      durationMs: number;
      createdAt: string;
    }
  >();

  for (const activity of threads.flatMap((thread) => thread.activities).toSorted(activityOrder)) {
    if (activity.kind !== "context-window.updated") {
      continue;
    }
    const payload = asRecord(activity.payload);
    const durationMs = asFiniteNumber(payload?.durationMs);
    if (durationMs === null || durationMs <= 0) {
      continue;
    }
    const key = activity.turnId ?? activity.id;
    latestUsageByTurnKey.set(key, {
      durationMs,
      createdAt: activity.createdAt,
    });
  }

  let totalDurationMs = 0;
  let recentDurationMs = 0;
  let recentTurns = 0;

  for (const usage of latestUsageByTurnKey.values()) {
    totalDurationMs += usage.durationMs;
    if (new Date(usage.createdAt).getTime() >= cutoffMs) {
      recentDurationMs += usage.durationMs;
      recentTurns += 1;
    }
  }

  return {
    totalDurationMs,
    recentDurationMs,
    totalTurns: latestUsageByTurnKey.size,
    recentTurns,
    totalLabel: formatDuration(totalDurationMs),
    recentLabel: formatDuration(recentDurationMs),
  };
}

function deriveRecentWork(
  threads: ReadonlyArray<Thread>,
  limit: number,
): ProjectOverviewRecentWorkEntry[] {
  return threads
    .flatMap((thread) =>
      deriveWorkLogEntries(thread.activities, undefined).map((entry) => {
        const recentEntry: ProjectOverviewRecentWorkEntry = {
          id: entry.id,
          threadId: thread.id,
          threadTitle: thread.title,
          createdAt: entry.createdAt,
          label: entry.label,
          tone: entry.tone,
        };
        if (entry.detail) {
          recentEntry.detail = entry.detail;
        }
        if (entry.command) {
          recentEntry.command = entry.command;
        }
        return recentEntry;
      }),
    )
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

function buildRepoSummary(input: {
  gitStatus: GitStatusResult | null;
  repositoryContext: GitRepositoryContextResult | null;
}): ProjectRepoSummary {
  const { gitStatus, repositoryContext } = input;
  if (!gitStatus?.isRepo) {
    return {
      statusLabel: "Not a Git repository",
      branchLabel: "No branch detected",
      remoteLabel: "No remote data",
      workspaceKindLabel: "Plain workspace",
    };
  }

  const remoteLabel = gitStatus.hasOriginRemote
    ? gitStatus.hasUpstream
      ? `${gitStatus.aheadCount} ahead / ${gitStatus.behindCount} behind`
      : "Origin configured, no upstream"
    : "No origin remote";
  const branchLabel = gitStatus.branch ? `On ${gitStatus.branch}` : "Detached HEAD";

  return {
    statusLabel: gitStatus.hasWorkingTreeChanges
      ? `${gitStatus.workingTree.files.length} changed file${
          gitStatus.workingTree.files.length === 1 ? "" : "s"
        }`
      : "Working tree clean",
    branchLabel,
    remoteLabel,
    workspaceKindLabel: repositoryContext?.isWorktree ? "Linked worktree" : "Primary checkout",
  };
}

export function buildProjectOverviewSnapshot(input: {
  threads: ReadonlyArray<Thread>;
  gitStatus: GitStatusResult | null;
  repositoryContext: GitRepositoryContextResult | null;
  nowIso?: string;
  recentWorkLimit?: number;
}): ProjectOverviewSnapshot {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const linkedThreads = [...input.threads]
    .map<ProjectOverviewLinkedThread>((thread) => ({
      id: thread.id,
      title: thread.title,
      branch: thread.branch,
      worktreePath: thread.worktreePath,
      archivedAt: thread.archivedAt ?? null,
      latestActivityAt: latestThreadActivityAt(thread),
    }))
    .toSorted((left, right) => right.latestActivityAt.localeCompare(left.latestActivityAt));

  const branches = [
    input.gitStatus?.branch,
    ...linkedThreads.map((thread) => thread.branch),
  ].filter((branch, index, values): branch is string => {
    if (!branch) {
      return false;
    }
    return values.indexOf(branch) === index;
  });

  return {
    activeThreadCount: linkedThreads.filter((thread) => thread.archivedAt === null).length,
    archivedThreadCount: linkedThreads.filter((thread) => thread.archivedAt !== null).length,
    linkedThreads,
    recentWork: deriveRecentWork(input.threads, input.recentWorkLimit ?? 6),
    inference: deriveInferenceRollup(input.threads, nowIso),
    branches,
    worktreeCount: linkedThreads.filter((thread) => thread.worktreePath !== null).length,
    repoSummary: buildRepoSummary({
      gitStatus: input.gitStatus,
      repositoryContext: input.repositoryContext,
    }),
  };
}
