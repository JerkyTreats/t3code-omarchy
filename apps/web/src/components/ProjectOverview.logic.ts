import type { GitRepositoryContextResult, GitStatusResult } from "@t3tools/contracts";

import { deriveWorkLogEntries } from "../session-logic";
import { type Thread } from "../types";
import {
  deriveProjectInferenceRollup,
  type ProjectInferenceRollup,
} from "./ProjectInference.logic";

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

function latestThreadActivityAt(thread: Thread): string {
  return (
    thread.latestTurn?.completedAt ??
    thread.latestTurn?.startedAt ??
    thread.updatedAt ??
    thread.createdAt
  );
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
    inference: deriveProjectInferenceRollup(input.threads, nowIso),
    branches,
    worktreeCount: linkedThreads.filter((thread) => thread.worktreePath !== null).length,
    repoSummary: buildRepoSummary({
      gitStatus: input.gitStatus,
      repositoryContext: input.repositoryContext,
    }),
  };
}
