import { Link } from "@tanstack/react-router";
import { BarChart3Icon, FolderTreeIcon, SquarePenIcon } from "lucide-react";
import type { ProjectId, ProjectScript } from "@t3tools/contracts";

import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { useProjectScriptActions } from "../hooks/useProjectScriptActions";
import { formatContextWindowTokens } from "../lib/contextWindow";
import { schedulePendingProjectScriptRun } from "../projectPendingScriptRun";
import { useServerAvailableEditors, useServerKeybindings } from "../rpc/serverState";
import { formatDuration } from "../session-logic";
import { formatRelativeTimeLabel } from "../timestampFormat";
import { buildProjectInferenceDashboardSnapshot } from "./ProjectInference.logic";
import { ProjectManagementHeader } from "./ProjectManagementHeader";
import { ProjectPageShell } from "./ProjectPageShell";
import { ProjectPanel } from "./ProjectPanel";
import { ProjectPanelSection } from "./ProjectPanelSection";
import ProjectScriptsControl from "./ProjectScriptsControl";
import { OpenInPicker } from "./chat/OpenInPicker";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useProjectPageData } from "./useProjectPageData";

function formatExactTokens(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function MetricCard(props: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-muted/20 px-4 py-4">
      <div className="text-sm text-muted-foreground">{props.label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        {props.value}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{props.detail}</div>
    </div>
  );
}

function formatInputDetail(
  inputTokens: number,
  cachedInputTokens: number,
  recentInputTokens: number,
) {
  const cachedDetail =
    cachedInputTokens > 0
      ? `${formatExactTokens(cachedInputTokens)} cached where reported`
      : "cached input not separately reported";
  return `${formatExactTokens(inputTokens)} cumulative input tokens, ${formatExactTokens(recentInputTokens)} in the last 7 days, ${cachedDetail}`;
}

export function ProjectInferenceDashboardPage(props: { projectId: ProjectId }) {
  const { handleNewThread } = useHandleNewThread();
  const keybindings = useServerKeybindings();
  const availableEditors = useServerAvailableEditors();
  const { latestActiveThread, overview, project, threads, workspacePath } = useProjectPageData(
    props.projectId,
  );
  const { deleteProjectScript, saveProjectScript, updateProjectScript } = useProjectScriptActions(
    project ?? undefined,
  );

  const dashboard = buildProjectInferenceDashboardSnapshot({ threads });

  const runScriptFromProjectPage = async (script: ProjectScript) => {
    if (!project) {
      return;
    }
    await handleNewThread(project.id, {
      beforeNavigate: (threadId) => {
        schedulePendingProjectScriptRun({
          threadId,
          projectId: project.id,
          scriptId: script.id,
        });
      },
    });
  };

  if (!project || !workspacePath) {
    return null;
  }

  return (
    <ProjectPageShell title="Inference dashboard">
      <ProjectManagementHeader
        faviconCwd={project.cwd}
        projectName={project.name}
        repoSummary={overview.repoSummary}
        workspacePath={workspacePath}
        actions={
          <>
            <Button
              render={
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  search={{ view: "management" }}
                />
              }
              size="sm"
              variant="outline"
            >
              <FolderTreeIcon className="size-3.5" />
              Project management
            </Button>
            <Button size="sm" onClick={() => void handleNewThread(project.id)}>
              <SquarePenIcon className="size-3.5" />
              New thread
            </Button>
            {latestActiveThread ? (
              <Button
                render={<Link to="/$threadId" params={{ threadId: latestActiveThread.id }} />}
                size="sm"
                variant="outline"
              >
                <FolderTreeIcon className="size-3.5" />
                Open latest thread
              </Button>
            ) : null}
            <OpenInPicker
              keybindings={keybindings}
              availableEditors={availableEditors}
              openInCwd={project.cwd}
            />
            <ProjectScriptsControl
              scripts={project.scripts}
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
                Project-wide processed token burn and thread ranking in one contained view.
              </p>
            </div>
            <Badge className="border-border bg-muted/70 text-muted-foreground hover:bg-muted/80">
              {formatContextWindowTokens(dashboard.recentTotalBurnTokens)} burn in the last 7 days
            </Badge>
          </div>
        }
        contentClassName="space-y-5 p-4"
      >
        <ProjectPanelSection title="Overview">
          <div className="space-y-3">
            <p className="max-w-4xl text-sm text-muted-foreground">
              Burn uses provider-reported processed token totals when available. That includes
              repeated context, cache reads, and other model work across a turn, so it will run much
              higher than final prompt plus response sizes.
            </p>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Lifetime total burn"
                value={formatContextWindowTokens(dashboard.lifetimeTotalBurnTokens)}
                detail={`${formatExactTokens(dashboard.lifetimeTotalBurnTokens)} total processed tokens from tracked turns`}
              />
              <MetricCard
                label="7 day burn"
                value={formatContextWindowTokens(dashboard.recentTotalBurnTokens)}
                detail={`${formatExactTokens(dashboard.recentTotalBurnTokens)} processed tokens in the last 7 days`}
              />
              <MetricCard
                label="Projected 30 day burn"
                value={formatContextWindowTokens(dashboard.projectedMonthlyBurnTokens)}
                detail={`${formatExactTokens(dashboard.projectedMonthlyBurnTokens)} processed tokens projected from the recent 7 day pace`}
              />
              <MetricCard
                label="Input tokens"
                value={formatContextWindowTokens(dashboard.lifetimeInputTokens)}
                detail={formatInputDetail(
                  dashboard.lifetimeInputTokens,
                  dashboard.lifetimeCachedInputTokens,
                  dashboard.recentInputTokens,
                )}
              />
              <MetricCard
                label="Output tokens"
                value={formatContextWindowTokens(dashboard.lifetimeOutputTokens)}
                detail={`${formatExactTokens(dashboard.lifetimeOutputTokens)} cumulative output tokens, ${formatExactTokens(dashboard.recentOutputTokens)} in the last 7 days`}
              />
              <MetricCard
                label="Tracked turns"
                value={`${dashboard.trackedTurns}`}
                detail={`${dashboard.recentTrackedTurns} turns updated in the last 7 days`}
              />
            </div>
          </div>
        </ProjectPanelSection>

        <ProjectPanelSection
          title="Leaderboard"
          actions={
            <span className="text-xs text-muted-foreground/75">
              Ranked by cumulative processed tokens
            </span>
          }
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Thread burn by total tokens
              </h2>
              <p className="text-sm text-muted-foreground">
                Compare the heaviest threads across this project and spot where processed token burn
                is accumulating fastest.
              </p>
            </div>

            {dashboard.leaderboard.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                No token usage snapshots yet. The dashboard will populate as linked threads complete
                turns.
              </div>
            ) : (
              dashboard.leaderboard.map((entry, index) => {
                const share =
                  dashboard.lifetimeTotalBurnTokens > 0
                    ? Math.max(
                        4,
                        Math.round(
                          (entry.totalProcessedTokens / dashboard.lifetimeTotalBurnTokens) * 100,
                        ),
                      )
                    : 0;

                return (
                  <Link
                    key={entry.threadId}
                    to="/$threadId"
                    params={{ threadId: entry.threadId }}
                    className="group block rounded-2xl border border-border/60 bg-muted/20 px-4 py-4 transition-colors hover:border-border hover:bg-muted/40"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted text-sm font-semibold text-foreground">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                {entry.title}
                              </span>
                              {entry.archivedAt ? (
                                <Badge className="border-border bg-muted/50 text-muted-foreground hover:bg-muted/70">
                                  Archived
                                </Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground/70">
                              Updated {formatRelativeTimeLabel(entry.latestActivityAt)}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--ring))]"
                              style={{ width: `${Math.min(100, Math.max(share, 0))}%` }}
                            />
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground/75">
                            <span>{entry.trackedTurns} tracked turns</span>
                            <span>{formatDuration(entry.totalDurationMs)} total runtime</span>
                            <span>{formatContextWindowTokens(entry.totalInputTokens)} input</span>
                            {entry.cachedInputTokens > 0 ? (
                              <span>
                                {formatContextWindowTokens(entry.cachedInputTokens)} cached
                              </span>
                            ) : null}
                            <span>{formatContextWindowTokens(entry.outputTokens)} output</span>
                            <span>
                              {formatContextWindowTokens(entry.averageProcessedTokensPerTurn)} avg
                              burn per turn
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-left lg:text-right">
                        <div className="text-2xl font-semibold tracking-tight text-foreground">
                          {formatContextWindowTokens(entry.totalProcessedTokens)}
                        </div>
                        <div className="text-xs text-muted-foreground/70">
                          {formatExactTokens(entry.totalProcessedTokens)} total processed tokens
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </ProjectPanelSection>
      </ProjectPanel>
    </ProjectPageShell>
  );
}
