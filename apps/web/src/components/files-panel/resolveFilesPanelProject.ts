import type { Project, Thread } from "~/types";
import type { DraftThreadState } from "~/composerDraftStore";

export function resolveFilesPanelProject(input: {
  activeDraftThread: Pick<DraftThreadState, "projectId"> | null;
  activeThread: Pick<Thread, "projectId"> | null;
  projects: ReadonlyArray<Project>;
}): Project | null {
  const projectId = input.activeThread?.projectId ?? input.activeDraftThread?.projectId ?? null;
  if (!projectId) {
    return null;
  }
  return input.projects.find((project) => project.id === projectId) ?? null;
}
