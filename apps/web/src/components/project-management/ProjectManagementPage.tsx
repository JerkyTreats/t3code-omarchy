import { scopeThreadRef } from "@t3tools/client-runtime";
import type { EnvironmentId, ProjectId, ProjectScript } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import { BarChart3Icon, ClockIcon, FolderTreeIcon, SquarePenIcon } from "lucide-react";
import { useCallback } from "react";

import { ProjectPanel } from "~/components/ProjectPanel";
import ProjectScriptsControl from "~/components/ProjectScriptsControl";
import { OpenInPicker } from "~/components/chat/OpenInPicker";
import { Button } from "~/components/ui/button";
import { usePrimaryEnvironmentId } from "~/environments/primary";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import { schedulePendingProjectScriptRun } from "~/projectPendingScriptRun";
import { useProjectManagementScriptActions } from "~/project-management/adapters/projectManagementScriptAdapter";
import { useProjectManagementData } from "~/project-management/adapters/projectManagementStoreAdapter";
import { useServerAvailableEditors, useServerKeybindings } from "~/rpc/serverState";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { buildThreadRouteParams } from "~/threadRoutes";
import { ProjectManagementHeader } from "./ProjectManagementHeader";
import { ProjectManagementShell } from "./ProjectManagementShell";
import { ProjectMetricCard } from "./ProjectMetricCard";
import { ProjectScopedGitPanel } from "./ProjectScopedGitPanel";

interface ProjectManagementPageProps {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
}

export function ProjectManagementPage({ environmentId, projectId }: ProjectManagementPageProps) {
  const data = useProjectManagementData({ environmentId, projectId });
  const { handleNewThread } = useHandleNewThread();
  const keybindings = useServerKeybindings();
  const availableEditors = useServerAvailableEditors();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { deleteProjectScript, saveProjectScript, updateProjectScript } =
    useProjectManagementScriptActions(data.project);
  const showOpenInPicker =
    primaryEnvironmentId !== null && data.project?.environmentId === primaryEnvironmentId;

  const runScriptFromProjectPage = useCallback(
    async (script: ProjectScript) => {
      const project = data.project;
      const projectRef = data.projectRef;
      if (!project || !projectRef) {
        return;
      }
      await handleNewThread(projectRef, {
        beforeNavigate: (threadId) => {
          schedulePendingProjectScriptRun({
            threadId,
            projectId: project.id,
            scriptId: script.id,
          });
        },
      });
    },
    [data.project, data.projectRef, handleNewThread],
  );

  if (!data.project || !data.projectRef || !data.workspacePath) {
    return null;
  }

  const project = data.project;
  const projectRef = data.projectRef;
  const workspacePath = data.workspacePath;

  return (
    <ProjectManagementShell title="Project management">
      <ProjectManagementHeader
        environmentId={project.environmentId}
        faviconCwd={project.cwd}
        projectName={project.name}
        repoSummary={data.overview.repoSummary}
        workspacePath={workspacePath}
        actions={
          <>
            <Button size="sm" onClick={() => void handleNewThread(projectRef)}>
              <SquarePenIcon className="size-3.5" />
              New thread
            </Button>
            <Button
              render={
                <Link
                  to="/projects/$environmentId/$projectId"
                  params={{
                    environmentId: project.environmentId,
                    projectId: project.id,
                  }}
                  search={{ view: "inference" }}
                />
              }
              size="sm"
              variant="outline"
            >
              <BarChart3Icon className="size-3.5" />
              Inference
            </Button>
            {data.latestActiveThreadRef ? (
              <Button
                render={
                  <Link
                    to="/$environmentId/$threadId"
                    params={buildThreadRouteParams(data.latestActiveThreadRef)}
                  />
                }
                size="sm"
                variant="outline"
              >
                <FolderTreeIcon className="size-3.5" />
                Latest thread
              </Button>
            ) : null}
            {showOpenInPicker ? (
              <OpenInPicker
                keybindings={keybindings}
                availableEditors={availableEditors}
                openInCwd={project.cwd}
              />
            ) : null}
            <ProjectScriptsControl
              scripts={[...project.scripts]}
              keybindings={keybindings}
              onRunScript={(script) => {
                void runScriptFromProjectPage(script);
              }}
              onAddScript={saveProjectScript}
              onUpdateScript={updateProjectScript}
              onDeleteScript={deleteProjectScript}
            />
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProjectMetricCard
          label="Active threads"
          value={data.overview.activeThreadCount}
          detail={`${data.overview.archivedThreadCount} archived`}
        />
        <ProjectMetricCard
          label="Branches"
          value={data.overview.branches.length}
          detail={
            data.overview.branches.length > 0
              ? data.overview.branches.slice(0, 3).join(", ")
              : "No branches tracked"
          }
        />
        <ProjectMetricCard
          label="Worktrees"
          value={data.overview.worktreeCount}
          detail="Linked thread workspaces"
        />
        <ProjectMetricCard
          label="7 day runtime"
          value={data.overview.inference.recentLabel}
          detail={`${data.overview.inference.recentTurns} tracked turns`}
        />
      </section>

      <ProjectScopedGitPanel
        projectRef={projectRef}
        repoCwd={data.repoRoot}
        workspaceCwd={workspacePath}
      />

      <ProjectPanel
        header={
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-medium">
            <ClockIcon className="size-4" />
            Recent project activity
          </div>
        }
        contentClassName="p-0"
        className="min-h-0"
      >
        {data.overview.linkedThreads.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No threads have been linked to this project yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.overview.linkedThreads.slice(0, 8).map((thread) => {
              const threadRef = scopeThreadRef(thread.environmentId, thread.id);
              return (
                <Link
                  key={`${thread.environmentId}:${thread.id}`}
                  to="/$environmentId/$threadId"
                  params={buildThreadRouteParams(threadRef)}
                  className="flex min-w-0 items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{thread.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {thread.branch ?? "No branch"} /{" "}
                      {thread.worktreePath ? "Dedicated worktree" : "Primary checkout"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTimeLabel(thread.latestActivityAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </ProjectPanel>
    </ProjectManagementShell>
  );
}
