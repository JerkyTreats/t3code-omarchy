import { scopeThreadRef } from "@t3tools/client-runtime";
import type { EnvironmentId, ProjectId, ProjectScript } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import { BarChart3Icon, FolderTreeIcon, SquarePenIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

import { ProjectPanel } from "~/components/ProjectPanel";
import ProjectScriptsControl from "~/components/ProjectScriptsControl";
import { OpenInPicker } from "~/components/chat/OpenInPicker";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { usePrimaryEnvironmentId } from "~/environments/primary";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import { formatContextWindowTokens } from "~/lib/contextWindow";
import { schedulePendingProjectScriptRun } from "~/projectPendingScriptRun";
import { useProjectManagementScriptActions } from "~/project-management/adapters/projectManagementScriptAdapter";
import { useProjectManagementData } from "~/project-management/adapters/projectManagementStoreAdapter";
import { buildProjectInferenceDashboardSnapshot } from "~/project-management/projectManagementInference";
import { useServerAvailableEditors, useServerKeybindings } from "~/rpc/serverState";
import { formatDuration } from "~/session-logic";
import { formatRelativeTimeLabel } from "~/timestampFormat";
import { buildThreadRouteParams } from "~/threadRoutes";
import { ProjectManagementHeader } from "./ProjectManagementHeader";
import { ProjectManagementShell } from "./ProjectManagementShell";
import { ProjectMetricCard } from "./ProjectMetricCard";

interface ProjectInferenceDashboardPageProps {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
}

function formatExactTokens(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatInputDetail(
  inputTokens: number,
  cachedInputTokens: number,
  recentInputTokens: number,
) {
  const cachedDetail =
    cachedInputTokens > 0
      ? `${formatExactTokens(cachedInputTokens)} cached where reported`
      : "Cached input not separately reported";
  return `${formatExactTokens(inputTokens)} input tokens, ${formatExactTokens(recentInputTokens)} recent, ${cachedDetail}`;
}

export function ProjectInferenceDashboardPage({
  environmentId,
  projectId,
}: ProjectInferenceDashboardPageProps) {
  const data = useProjectManagementData({ environmentId, projectId });
  const dashboard = useMemo(
    () => buildProjectInferenceDashboardSnapshot({ threads: data.threads }),
    [data.threads],
  );
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
    <ProjectManagementShell title="Inference dashboard">
      <ProjectManagementHeader
        environmentId={project.environmentId}
        faviconCwd={project.cwd}
        projectName={project.name}
        repoSummary={data.overview.repoSummary}
        workspacePath={workspacePath}
        actions={
          <>
            <Button
              render={
                <Link
                  to="/projects/$environmentId/$projectId"
                  params={{
                    environmentId: project.environmentId,
                    projectId: project.id,
                  }}
                  search={{ view: "management" }}
                />
              }
              size="sm"
              variant="outline"
            >
              <FolderTreeIcon className="size-3.5" />
              Management
            </Button>
            <Button size="sm" onClick={() => void handleNewThread(projectRef)}>
              <SquarePenIcon className="size-3.5" />
              New thread
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

      <ProjectPanel
        header={
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BarChart3Icon className="size-4" />
                <span>Inference dashboard</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Provider reported processed token burn across linked project threads.
              </p>
            </div>
            <Badge variant="outline" className="bg-muted/40">
              {formatContextWindowTokens(dashboard.recentTotalBurnTokens)} burn in the last 7 days
            </Badge>
          </div>
        }
        contentClassName="space-y-5 p-4"
        className="min-h-0"
      >
        <section className="space-y-3">
          <p className="max-w-4xl text-sm text-muted-foreground">
            Burn uses provider-reported processed token totals when available. It can include
            repeated context, cache reads, and other model work across a turn.
          </p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <ProjectMetricCard
              label="Lifetime total burn"
              value={formatContextWindowTokens(dashboard.lifetimeTotalBurnTokens)}
              detail={`${formatExactTokens(dashboard.lifetimeTotalBurnTokens)} total processed tokens`}
            />
            <ProjectMetricCard
              label="7 day burn"
              value={formatContextWindowTokens(dashboard.recentTotalBurnTokens)}
              detail={`${formatExactTokens(dashboard.recentTotalBurnTokens)} processed tokens`}
            />
            <ProjectMetricCard
              label="Projected 30 day burn"
              value={formatContextWindowTokens(dashboard.projectedMonthlyBurnTokens)}
              detail={`${formatExactTokens(dashboard.projectedMonthlyBurnTokens)} projected tokens`}
            />
            <ProjectMetricCard
              label="Input tokens"
              value={formatContextWindowTokens(dashboard.lifetimeInputTokens)}
              detail={formatInputDetail(
                dashboard.lifetimeInputTokens,
                dashboard.lifetimeCachedInputTokens,
                dashboard.recentInputTokens,
              )}
            />
            <ProjectMetricCard
              label="Output tokens"
              value={formatContextWindowTokens(dashboard.lifetimeOutputTokens)}
              detail={`${formatExactTokens(dashboard.recentOutputTokens)} recent output tokens`}
            />
            <ProjectMetricCard
              label="Tracked turns"
              value={dashboard.trackedTurns}
              detail={`${dashboard.recentTrackedTurns} turns in the last 7 days`}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Thread burn leaderboard</h2>
              <p className="text-sm text-muted-foreground">
                Ranked by cumulative processed tokens.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              Average burn {formatContextWindowTokens(dashboard.averageBurnPerTrackedTurn)}
            </span>
          </div>

          {dashboard.leaderboard.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              No token usage snapshots yet. The dashboard will populate as turns complete.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {dashboard.leaderboard.map((entry, index) => {
                const share =
                  dashboard.lifetimeTotalBurnTokens > 0
                    ? Math.max(
                        4,
                        Math.round(
                          (entry.totalProcessedTokens / dashboard.lifetimeTotalBurnTokens) * 100,
                        ),
                      )
                    : 0;
                const threadRef = scopeThreadRef(entry.environmentId, entry.threadId);

                return (
                  <Link
                    key={`${entry.environmentId}:${entry.threadId}`}
                    to="/$environmentId/$threadId"
                    params={buildThreadRouteParams(threadRef)}
                    className="group block px-4 py-4 transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium">{entry.title}</span>
                              {entry.archivedAt ? (
                                <Badge variant="outline" className="bg-muted/40">
                                  Archived
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Updated {formatRelativeTimeLabel(entry.latestActivityAt)}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.min(100, Math.max(share, 0))}%` }}
                            />
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>{entry.trackedTurns} tracked turns</span>
                            <span>{formatDuration(entry.totalDurationMs)} runtime</span>
                            <span>{formatContextWindowTokens(entry.totalInputTokens)} input</span>
                            {entry.cachedInputTokens > 0 ? (
                              <span>
                                {formatContextWindowTokens(entry.cachedInputTokens)} cached
                              </span>
                            ) : null}
                            <span>{formatContextWindowTokens(entry.outputTokens)} output</span>
                            <span>
                              {formatContextWindowTokens(entry.averageProcessedTokensPerTurn)} avg
                              burn
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-left lg:text-right">
                        <div className="text-2xl font-semibold">
                          {formatContextWindowTokens(entry.totalProcessedTokens)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatExactTokens(entry.totalProcessedTokens)} processed tokens
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </ProjectPanel>
    </ProjectManagementShell>
  );
}
