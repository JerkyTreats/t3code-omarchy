import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime";
import type {
  EnvironmentId,
  ProjectId,
  ScopedProjectRef,
  ScopedThreadRef,
} from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { useGitStatus } from "~/lib/gitStatusState";
import { selectEnvironmentState, selectThreadsForEnvironment, useStore } from "~/store";
import { buildProjectOverviewSnapshot } from "../projectManagementOverview";
import {
  type ProjectManagementProject,
  type ProjectManagementRepositoryContextInput,
  type ProjectManagementThread,
} from "../projectManagementTypes";
import { mapVcsStatusToProjectRepositoryStatus } from "./projectManagementStatusAdapter";

export interface ProjectManagementData {
  readonly bootstrapComplete: boolean;
  readonly latestActiveThread: ProjectManagementThread | null;
  readonly latestActiveThreadRef: ScopedThreadRef | null;
  readonly overview: ReturnType<typeof buildProjectOverviewSnapshot>;
  readonly project: ProjectManagementProject | null;
  readonly projectRef: ScopedProjectRef | null;
  readonly repositoryContext: ProjectManagementRepositoryContextInput | null;
  readonly repoRoot: string | null;
  readonly repositoryStatus: ReturnType<typeof mapVcsStatusToProjectRepositoryStatus>;
  readonly threads: ReadonlyArray<ProjectManagementThread>;
  readonly workspacePath: string | null;
}

function mapProjectManagementThread(
  thread: ReturnType<typeof selectThreadsForEnvironment>[number],
): ProjectManagementThread {
  return {
    id: thread.id,
    environmentId: thread.environmentId,
    projectId: thread.projectId,
    title: thread.title,
    archivedAt: thread.archivedAt,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    latestTurn: thread.latestTurn,
    branch: thread.branch,
    worktreePath: thread.worktreePath,
    activities: thread.activities,
  };
}

export function useProjectManagementData(input: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
}): ProjectManagementData {
  const navigate = useNavigate();
  const bootstrapComplete = useStore(
    (state) => selectEnvironmentState(state, input.environmentId).bootstrapComplete,
  );
  const project = useStore(
    (state) =>
      selectEnvironmentState(state, input.environmentId).projectById[input.projectId] ?? null,
  );
  const gitStatus = useGitStatus({
    environmentId: input.environmentId,
    cwd: project?.cwd ?? null,
  });
  const repositoryStatus = mapVcsStatusToProjectRepositoryStatus(gitStatus.data);
  const repositoryContext = useMemo(
    () => (repositoryStatus?.isRepo ? { isWorktree: false } : null),
    [repositoryStatus?.isRepo],
  );

  const sourceThreads = useStore(
    useShallow((state) =>
      selectThreadsForEnvironment(state, input.environmentId).filter(
        (thread) => thread.projectId === input.projectId,
      ),
    ),
  );
  const threads = useMemo(() => sourceThreads.map(mapProjectManagementThread), [sourceThreads]);

  useEffect(() => {
    if (!bootstrapComplete || project) {
      return;
    }
    void navigate({ to: "/", replace: true });
  }, [bootstrapComplete, navigate, project]);

  const latestActiveThread = useMemo(
    () =>
      [...threads]
        .filter((thread) => thread.archivedAt === null)
        .toSorted((left, right) => {
          const leftAt =
            left.latestTurn?.completedAt ??
            left.latestTurn?.startedAt ??
            left.updatedAt ??
            left.createdAt;
          const rightAt =
            right.latestTurn?.completedAt ??
            right.latestTurn?.startedAt ??
            right.updatedAt ??
            right.createdAt;
          return rightAt.localeCompare(leftAt);
        })[0] ?? null,
    [threads],
  );

  const overview = useMemo(
    () =>
      buildProjectOverviewSnapshot({
        threads,
        repositoryStatus,
        repositoryContext,
      }),
    [repositoryContext, repositoryStatus, threads],
  );

  if (!bootstrapComplete || !project) {
    return {
      bootstrapComplete,
      latestActiveThread: null,
      latestActiveThreadRef: null,
      overview,
      project: null,
      projectRef: null,
      repositoryContext,
      repoRoot: null,
      repositoryStatus,
      threads,
      workspacePath: null,
    };
  }

  return {
    bootstrapComplete,
    latestActiveThread,
    latestActiveThreadRef: latestActiveThread
      ? scopeThreadRef(latestActiveThread.environmentId, latestActiveThread.id)
      : null,
    overview,
    project,
    projectRef: scopeProjectRef(project.environmentId, project.id),
    repositoryContext,
    repoRoot: project.cwd,
    repositoryStatus,
    threads,
    workspacePath: project.cwd,
  };
}
