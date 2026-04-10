import { type ProjectId, type ProjectScript } from "@t3tools/contracts";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  FolderKanbanIcon,
  FolderTreeIcon,
  GitBranchIcon,
  HistoryIcon,
  PlayIcon,
  SquarePenIcon,
  TimerResetIcon,
} from "lucide-react";
import { useEffect, useMemo } from "react";

import { gitRepositoryContextQueryOptions } from "../lib/gitReactQuery";
import { useGitStatus } from "../lib/gitStatusState";
import { useProjectById } from "../storeSelectors";
import { useStore } from "../store";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { useProjectScriptActions } from "../hooks/useProjectScriptActions";
import { schedulePendingProjectScriptRun } from "../projectPendingScriptRun";
import { useServerAvailableEditors, useServerKeybindings } from "../rpc/serverState";
import { buildProjectOverviewSnapshot } from "./ProjectOverview.logic";
import ProjectScriptsControl from "./ProjectScriptsControl";
import { ProjectFavicon } from "./ProjectFavicon";
import { OpenInPicker } from "./chat/OpenInPicker";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { SidebarInset, SidebarTrigger } from "./ui/sidebar";
import { formatRelativeTimeLabel } from "../timestampFormat";
import { isElectron } from "../env";

function MetricCard(props: { label: string; value: string; meta?: string }) {
  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader className="pb-2">
        <CardDescription>{props.label}</CardDescription>
        <CardTitle className="text-2xl tracking-tight">{props.value}</CardTitle>
      </CardHeader>
      {props.meta ? (
        <CardContent className="pt-0 text-xs text-muted-foreground">{props.meta}</CardContent>
      ) : null}
    </Card>
  );
}

function ScriptRow(props: { script: ProjectScript; onRunScript: (script: ProjectScript) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{props.script.name}</span>
          {props.script.runOnWorktreeCreate ? (
            <Badge variant="outline" className="text-[10px]">
              Setup
            </Badge>
          ) : null}
        </div>
        <code className="truncate text-xs text-muted-foreground">{props.script.command}</code>
      </div>
      <Button size="xs" variant="outline" onClick={() => props.onRunScript(props.script)}>
        <PlayIcon className="size-3.5" />
        Run
      </Button>
    </div>
  );
}

export function ProjectOverviewPage(props: { projectId: ProjectId }) {
  const navigate = useNavigate();
  const bootstrapComplete = useStore((store) => store.bootstrapComplete);
  const project = useProjectById(props.projectId);
  const threads = useStore((store) =>
    store.threads.filter((thread) => thread.projectId === props.projectId),
  );
  const { handleNewThread } = useHandleNewThread();
  const { deleteProjectScript, saveProjectScript, updateProjectScript } =
    useProjectScriptActions(project);
  const keybindings = useServerKeybindings();
  const availableEditors = useServerAvailableEditors();
  const gitStatusQuery = useGitStatus(project?.cwd ?? null);
  const repositoryContextQuery = useQuery(gitRepositoryContextQueryOptions(project?.cwd ?? null));

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

  if (!bootstrapComplete || !project) {
    return null;
  }

  const workspacePath = project.cwd;
  const repoRoot = repositoryContextQuery.data?.repoRoot ?? project.cwd;

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--color-emerald-500)_10%,transparent),transparent_40%),radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--color-sky-500)_10%,transparent),transparent_35%)]" />

        {!isElectron && (
          <header className="relative border-b border-border/80 bg-background/80 px-3 py-2 backdrop-blur sm:px-5">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
              <span className="text-sm font-medium text-foreground">Project overview</span>
            </div>
          </header>
        )}

        {isElectron && (
          <div className="drag-region relative flex h-[52px] shrink-0 items-center border-b border-border/80 bg-background/80 px-5 backdrop-blur">
            <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
              Project overview
            </span>
          </div>
        )}

        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            <Card className="overflow-hidden border-border/70 bg-card/95">
              <CardHeader className="gap-4 border-b border-border/70 pb-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div className="rounded-2xl border border-border/70 bg-background/90 p-3 shadow-sm">
                      <ProjectFavicon cwd={project.cwd} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            <FolderKanbanIcon className="size-3" />
                            Project
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <GitBranchIcon className="size-3" />
                            {overview.repoSummary.workspaceKindLabel}
                          </Badge>
                        </div>
                        <CardTitle className="text-3xl leading-tight tracking-tight">
                          {project.name}
                        </CardTitle>
                        <CardDescription className="max-w-3xl text-sm leading-6">
                          {workspacePath}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{overview.repoSummary.statusLabel}</span>
                        <span className="text-border">/</span>
                        <span>{overview.repoSummary.branchLabel}</span>
                        <span className="text-border">/</span>
                        <span>{overview.repoSummary.remoteLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Button size="sm" onClick={() => void handleNewThread(project.id)}>
                      <SquarePenIcon className="size-3.5" />
                      New thread
                    </Button>
                    {latestActiveThread ? (
                      <Button
                        render={
                          <Link to="/$threadId" params={{ threadId: latestActiveThread.id }} />
                        }
                        size="sm"
                        variant="outline"
                      >
                        <FolderTreeIcon className="size-3.5" />
                        Thread management
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
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Active threads"
                value={`${overview.activeThreadCount}`}
                meta={
                  latestActiveThread
                    ? `Latest update ${formatRelativeTimeLabel(
                        latestActiveThread.latestTurn?.completedAt ??
                          latestActiveThread.updatedAt ??
                          latestActiveThread.createdAt,
                      )}`
                    : "No active threads yet"
                }
              />
              <MetricCard
                label="Archived threads"
                value={`${overview.archivedThreadCount}`}
                meta={
                  overview.archivedThreadCount > 0
                    ? "Archived history remains linked to this project"
                    : "Nothing archived yet"
                }
              />
              <MetricCard
                label="Inference total"
                value={overview.inference.totalLabel}
                meta={`${overview.inference.totalTurns} completed turn${
                  overview.inference.totalTurns === 1 ? "" : "s"
                }`}
              />
              <MetricCard
                label="Last 7 days"
                value={overview.inference.recentLabel}
                meta={`${overview.inference.recentTurns} recent turn${
                  overview.inference.recentTurns === 1 ? "" : "s"
                }`}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-border/70 bg-card/95">
                <CardHeader className="border-b border-border/70">
                  <CardTitle className="text-xl">Thread management</CardTitle>
                  <CardDescription>
                    Linked threads stay in the sidebar, and this page gives you a project-level way
                    back into them.
                  </CardDescription>
                  <CardAction className="hidden md:inline-flex">
                    {latestActiveThread ? (
                      <Button
                        render={
                          <Link to="/$threadId" params={{ threadId: latestActiveThread.id }} />
                        }
                        size="sm"
                        variant="outline"
                      >
                        Open latest
                        <ArrowRightIcon className="size-3.5" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleNewThread(project.id)}
                      >
                        Create first thread
                        <ArrowRightIcon className="size-3.5" />
                      </Button>
                    )}
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-3">
                  {overview.linkedThreads.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                      No linked threads yet. Start a thread to turn this project into an active
                      workspace.
                    </div>
                  ) : (
                    overview.linkedThreads.slice(0, 8).map((thread) => (
                      <Link
                        key={thread.id}
                        to="/$threadId"
                        params={{ threadId: thread.id }}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-3 transition-colors hover:border-border hover:bg-accent/35"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {thread.title}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {thread.archivedAt ? "Archived" : "Active"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {thread.branch ? <span>{thread.branch}</span> : <span>No branch</span>}
                            {thread.worktreePath ? (
                              <>
                                <span className="text-border">/</span>
                                <span>Worktree</span>
                              </>
                            ) : null}
                            <span className="text-border">/</span>
                            <span>{formatRelativeTimeLabel(thread.latestActivityAt)}</span>
                          </div>
                        </div>
                        <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/95">
                <CardHeader className="border-b border-border/70">
                  <CardTitle className="text-xl">Repo overview</CardTitle>
                  <CardDescription>
                    Status, branch spread, and workspace shape for the checkout linked to this
                    project.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                      <div className="text-xs font-medium text-muted-foreground">
                        Workspace path
                      </div>
                      <div className="mt-1 break-all text-sm text-foreground">{workspacePath}</div>
                      {repoRoot !== workspacePath ? (
                        <div className="mt-1 break-all text-xs text-muted-foreground">
                          Repo root: {repoRoot}
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                      <div className="text-xs font-medium text-muted-foreground">Repo status</div>
                      <div className="mt-1 text-sm text-foreground">
                        {overview.repoSummary.statusLabel}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                      <div className="text-xs font-medium text-muted-foreground">Branch</div>
                      <div className="mt-1 text-sm text-foreground">
                        {overview.repoSummary.branchLabel}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                      <div className="text-xs font-medium text-muted-foreground">Remote</div>
                      <div className="mt-1 text-sm text-foreground">
                        {overview.repoSummary.remoteLabel}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          Branch information
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {overview.branches.length} distinct branch
                          {overview.branches.length === 1 ? "" : "es"} across linked work
                        </div>
                      </div>
                      <Badge variant="outline">{overview.worktreeCount} worktrees</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {overview.branches.length > 0 ? (
                        overview.branches.map((branch) => (
                          <Badge key={branch} variant="outline" className="gap-1.5">
                            <GitBranchIcon className="size-3" />
                            {branch}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No tracked branches yet
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="border-border/70 bg-card/95">
                <CardHeader className="border-b border-border/70">
                  <CardTitle className="text-xl">Scripts</CardTitle>
                  <CardDescription>
                    Run project actions directly from here. Script editing stays available from the
                    action picker above.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {project.scripts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                      No project scripts yet. Add one from the action picker to keep common tasks
                      close to the project.
                    </div>
                  ) : (
                    project.scripts.map((script) => (
                      <ScriptRow
                        key={script.id}
                        script={script}
                        onRunScript={(entry) => {
                          void runScriptFromProjectPage(entry);
                        }}
                      />
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/95">
                <CardHeader className="border-b border-border/70">
                  <CardTitle className="text-xl">Recent work</CardTitle>
                  <CardDescription>
                    Latest tool and workflow activity pulled across every linked thread.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {overview.recentWork.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                      No recent work yet. Activity will appear here once linked threads start doing
                      real work.
                    </div>
                  ) : (
                    overview.recentWork.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-border/70 bg-background/70 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                {entry.tone}
                              </Badge>
                              <span className="truncate text-sm font-medium text-foreground">
                                {entry.label}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Link
                                to="/$threadId"
                                params={{ threadId: entry.threadId }}
                                className="truncate text-foreground underline-offset-4 hover:underline"
                              >
                                {entry.threadTitle}
                              </Link>
                              <span className="text-border">/</span>
                              <span>{formatRelativeTimeLabel(entry.createdAt)}</span>
                            </div>
                          </div>
                          <HistoryIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        </div>
                        {entry.command ? (
                          <code className="mt-2 block truncate text-xs text-muted-foreground">
                            {entry.command}
                          </code>
                        ) : null}
                        {entry.detail ? (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                            {entry.detail}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/70 bg-card/95">
              <CardHeader className="border-b border-border/70">
                <CardTitle className="text-xl">Inference rollups</CardTitle>
                <CardDescription>
                  Duration totals are taken from the latest context-window usage snapshot recorded
                  for each turn.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <TimerResetIcon className="size-3.5" />
                    Total inference time
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight">
                    {overview.inference.totalLabel}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <TimerResetIcon className="size-3.5" />
                    Last 7 days
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight">
                    {overview.inference.recentLabel}
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <TimerResetIcon className="size-3.5" />
                    Tracked turns
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight">
                    {overview.inference.totalTurns}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
