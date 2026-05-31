import type { ScopedProjectRef } from "@t3tools/contracts";
import { Suspense, lazy } from "react";

import { DiffPanelLoadingState } from "~/components/DiffPanelShell";
import { ProjectPanel } from "~/components/ProjectPanel";

const GitPanel = lazy(() => import("~/components/git-panel/GitPanel"));

interface ProjectScopedGitPanelProps {
  readonly projectRef: ScopedProjectRef;
  readonly repoCwd: string | null;
  readonly workspaceCwd: string | null;
}

export function ProjectScopedGitPanel({
  projectRef,
  repoCwd,
  workspaceCwd,
}: ProjectScopedGitPanelProps) {
  return (
    <Suspense
      fallback={
        <ProjectPanel contentClassName="flex min-h-[42rem] items-center justify-center text-sm text-muted-foreground">
          <DiffPanelLoadingState label="Loading Git panel..." />
        </ProjectPanel>
      }
    >
      <GitPanel
        activeProjectRef={projectRef}
        activeThreadRef={null}
        repoCwd={repoCwd}
        workspaceCwd={workspaceCwd}
      />
    </Suspense>
  );
}
