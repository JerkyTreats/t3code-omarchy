import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import type { ProjectId } from "@t3tools/contracts";

import { useGitStatus } from "../lib/gitStatusState";
import { gitRepositoryContextQueryOptions } from "../lib/gitReactQuery";
import { useProjectById } from "../storeSelectors";
import { useStore } from "../store";
import { buildProjectOverviewSnapshot } from "./ProjectOverview.logic";

export function useProjectPageData(projectId: ProjectId) {
  const navigate = useNavigate();
  const bootstrapComplete = useStore((store) => store.bootstrapComplete);
  const project = useProjectById(projectId);
  const allThreads = useStore((store) => store.threads);
  const gitStatusQuery = useGitStatus(project?.cwd ?? null);
  const repositoryContextQuery = useQuery(gitRepositoryContextQueryOptions(project?.cwd ?? null));

  const threads = useMemo(
    () => allThreads.filter((thread) => thread.projectId === projectId),
    [allThreads, projectId],
  );

  useEffect(() => {
    if (!bootstrapComplete) {
      return;
    }
    if (!project) {
      void navigate({ to: "/", replace: true });
    }
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
        gitStatus: gitStatusQuery.data,
        repositoryContext: repositoryContextQuery.data ?? null,
      }),
    [gitStatusQuery.data, repositoryContextQuery.data, threads],
  );

  if (!bootstrapComplete || !project) {
    return {
      bootstrapComplete,
      latestActiveThread: null,
      overview,
      project: null,
      repoRoot: null,
      threads,
      workspacePath: null,
    };
  }

  return {
    bootstrapComplete,
    latestActiveThread,
    overview,
    project,
    repoRoot: repositoryContextQuery.data?.repoRoot ?? project.cwd,
    threads,
    workspacePath: project.cwd,
  };
}
