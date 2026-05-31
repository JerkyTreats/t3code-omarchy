import { FolderKanbanIcon, GitBranchIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { EnvironmentId } from "@t3tools/contracts";

import { cn } from "~/lib/utils";
import type { ProjectRepoSummary } from "~/project-management/projectManagementOverview";
import { ProjectFavicon } from "~/components/ProjectFavicon";
import { Badge } from "~/components/ui/badge";

interface ProjectManagementHeaderProps {
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly environmentId: EnvironmentId;
  readonly faviconCwd: string;
  readonly projectName: string;
  readonly repoSummary: ProjectRepoSummary;
  readonly workspacePath: string;
}

export function ProjectManagementHeader({
  actions,
  className,
  environmentId,
  faviconCwd,
  projectName,
  repoSummary,
  workspacePath,
}: ProjectManagementHeaderProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card px-4 py-4 text-card-foreground shadow-sm sm:px-5",
        className,
      )}
    >
      <div className="@container/project-header flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted/45">
            <ProjectFavicon
              environmentId={environmentId}
              cwd={faviconCwd}
              className="size-5 text-foreground/75"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1 bg-muted/40">
                <FolderKanbanIcon className="size-3" />
                Project
              </Badge>
              <Badge variant="outline" className="gap-1 bg-muted/40">
                <GitBranchIcon className="size-3" />
                {repoSummary.workspaceKindLabel}
              </Badge>
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
                {projectName}
              </h1>
              <p className="mt-1 break-all text-xs text-muted-foreground sm:text-sm">
                {workspacePath}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{repoSummary.statusLabel}</span>
              <span className="text-muted-foreground/45">/</span>
              <span>{repoSummary.branchLabel}</span>
              <span className="text-muted-foreground/45">/</span>
              <span>{repoSummary.remoteLabel}</span>
            </div>
          </div>
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2 xl:max-w-[34rem] xl:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
