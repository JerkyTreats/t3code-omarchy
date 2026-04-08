import { projectScriptCwd } from "@t3tools/shared/projectScripts";
import type { Project, Thread } from "~/types";

export function resolveGitPanelContext(input: {
  activeDraftThread: { worktreePath: string | null } | null;
  activeProject: Project | null;
  activeThread: Thread | null;
}): {
  repoCwd: string | null;
  repoRoot: string | null;
  workspaceCwd: string | null;
} {
  const repoRoot = input.activeProject?.cwd ?? null;
  const workspaceCwd = input.activeProject
    ? projectScriptCwd({
        project: { cwd: input.activeProject.cwd },
        worktreePath:
          input.activeThread?.worktreePath ?? input.activeDraftThread?.worktreePath ?? null,
      })
    : null;

  return {
    repoCwd: repoRoot,
    repoRoot,
    workspaceCwd,
  };
}
