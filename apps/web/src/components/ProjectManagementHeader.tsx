import { FolderKanbanIcon, GitBranchIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import type { ProjectRepoSummary } from "./ProjectOverview.logic";
import { ProjectFavicon } from "./ProjectFavicon";
import { Badge } from "./ui/badge";

interface ProjectManagementHeaderProps {
  actions?: ReactNode;
  className?: string;
  faviconCwd: string;
  projectName: string;
  repoSummary: ProjectRepoSummary;
  workspacePath: string;
}

export function ProjectManagementHeader({
  actions,
  className,
  faviconCwd,
  projectName,
  repoSummary,
  workspacePath,
}: ProjectManagementHeaderProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-border bg-[linear-gradient(135deg,var(--card),color-mix(in_srgb,var(--accent)_50%,var(--card)))] px-5 py-5 text-card-foreground shadow-[0_8px_32px_-8px_color-mix(in_srgb,var(--primary)_14%,transparent)] sm:px-8 sm:py-7",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_34%),radial-gradient(circle_at_bottom_right,color-mix(in_srgb,var(--ring)_7%,transparent),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-px rounded-[calc(2rem-1px)] border border-border/50" />

      <div className="relative flex flex-col gap-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-3xl border border-border bg-muted/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <ProjectFavicon cwd={faviconCwd} className="size-7 text-foreground/75" />
            </div>

            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="gap-1 border-border bg-muted/60 text-muted-foreground hover:bg-muted/80">
                  <FolderKanbanIcon className="size-3" />
                  Project
                </Badge>
                <Badge className="gap-1 border-border bg-muted/60 text-muted-foreground hover:bg-muted/80">
                  <GitBranchIcon className="size-3" />
                  {repoSummary.workspaceKindLabel}
                </Badge>
              </div>

              <div className="space-y-2">
                <h1 className="truncate text-4xl font-semibold tracking-tight text-card-foreground sm:text-5xl">
                  {projectName}
                </h1>
                <p className="break-all text-base text-muted-foreground sm:text-lg">
                  {workspacePath}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{repoSummary.statusLabel}</span>
                <span className="text-muted-foreground/40">/</span>
                <span>{repoSummary.branchLabel}</span>
                <span className="text-muted-foreground/40">/</span>
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
      </div>
    </section>
  );
}
