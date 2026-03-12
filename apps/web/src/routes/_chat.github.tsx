import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ExternalLinkIcon,
  FolderGit2Icon,
  LogInIcon,
  RefreshCcwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GitHubIssueListState } from "@t3tools/contracts";

import { GitHubIcon } from "~/components/Icons";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SidebarInset } from "~/components/ui/sidebar";
import { toastManager } from "~/components/ui/toast";
import { isElectron } from "~/env";
import {
  githubIssuesQueryOptions,
  githubLoginMutationOptions,
  githubStatusQueryOptions,
  invalidateGitHubQueries,
} from "~/lib/githubReactQuery";
import { readNativeApi } from "~/nativeApi";
import { useStore } from "~/store";

const ISSUE_STATES: ReadonlyArray<{
  label: string;
  value: GitHubIssueListState;
}> = [
  { label: "Open", value: "open" },
  { label: "Closed", value: "closed" },
  { label: "All", value: "all" },
];

const AUTH_COMMAND = "gh auth login --web --git-protocol https";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function GitHubRouteView() {
  const projects = useStore((store) => store.projects);
  const queryClient = useQueryClient();
  const [selectedCwd, setSelectedCwd] = useState<string | null>(projects[0]?.cwd ?? null);
  const [issueState, setIssueState] = useState<GitHubIssueListState>("open");
  const [copiedAuthCommand, setCopiedAuthCommand] = useState(false);

  useEffect(() => {
    if (selectedCwd && projects.some((project) => project.cwd === selectedCwd)) {
      return;
    }
    setSelectedCwd(projects[0]?.cwd ?? null);
  }, [projects, selectedCwd]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.cwd === selectedCwd) ?? null,
    [projects, selectedCwd],
  );

  const statusQuery = useQuery(githubStatusQueryOptions(selectedCwd));
  const issuesEnabled =
    statusQuery.data?.installed === true &&
    statusQuery.data?.authenticated === true &&
    statusQuery.data?.repo !== null;
  const issuesQuery = useQuery(
    githubIssuesQueryOptions({
      cwd: selectedCwd,
      state: issueState,
      limit: 25,
      enabled: issuesEnabled,
    }),
  );
  const loginMutation = useMutation(githubLoginMutationOptions({ cwd: selectedCwd, queryClient }));

  const openUrl = useCallback(async (url: string) => {
    const api = readNativeApi();
    if (!api) {
      toastManager.add({
        type: "error",
        title: "Link opening is unavailable.",
      });
      return;
    }
    await api.shell.openExternal(url);
  }, []);

  const copyAuthCommand = useCallback(async () => {
    if (typeof navigator === "undefined" || navigator.clipboard?.writeText === undefined) {
      toastManager.add({
        type: "error",
        title: "Clipboard access is unavailable.",
      });
      return;
    }

    await navigator.clipboard.writeText(AUTH_COMMAND);
    setCopiedAuthCommand(true);
    window.setTimeout(() => setCopiedAuthCommand(false), 1_500);
  }, []);

  const refreshAll = useCallback(() => {
    void invalidateGitHubQueries(queryClient);
  }, [queryClient]);

  const repo = statusQuery.data?.repo ?? issuesQuery.data?.repo ?? null;

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {isElectron && (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
              GitHub
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <header className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">GitHub</h1>
              <p className="text-sm text-muted-foreground">
                Verify `gh`, authenticate the active account, and browse issues from your local
                projects.
              </p>
            </header>

            <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.9),rgba(15,23,42,0.96))] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.98))]" />
              <div className="relative grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15 backdrop-blur">
                      <GitHubIcon className="size-7" />
                    </div>
                    <div className="space-y-2 text-white">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold tracking-tight">
                          Control room for `gh`
                        </h2>
                        {statusQuery.data?.installed ? (
                          <Badge variant={statusQuery.data.authenticated ? "success" : "warning"}>
                            {statusQuery.data.authenticated ? "Authenticated" : "Needs auth"}
                          </Badge>
                        ) : (
                          <Badge variant="error">Missing `gh`</Badge>
                        )}
                      </div>
                      <p className="max-w-2xl text-sm text-white/70">
                        Keep the CLI healthy, confirm which account is active, and turn project
                        repos into an issue menu that is one click away.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/12 bg-white/6 p-4 text-white backdrop-blur">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/45">
                        <ShieldCheckIcon className="size-3.5" />
                        Binary
                      </div>
                      <div className="mt-2 text-lg font-semibold">
                        {statusQuery.data?.installed ? "Detected" : "Unavailable"}
                      </div>
                      <p className="mt-1 text-xs text-white/60">
                        Checks whether `gh` is available on PATH.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/12 bg-white/6 p-4 text-white backdrop-blur">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/45">
                        <LogInIcon className="size-3.5" />
                        Account
                      </div>
                      <div className="mt-2 truncate text-lg font-semibold">
                        {statusQuery.data?.accountLogin ?? "Not signed in"}
                      </div>
                      <p className="mt-1 text-xs text-white/60">
                        {statusQuery.data?.gitProtocol
                          ? `Git protocol: ${statusQuery.data.gitProtocol}`
                          : "Authenticate to unlock repository issue listing."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/12 bg-white/6 p-4 text-white backdrop-blur">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/45">
                        <FolderGit2Icon className="size-3.5" />
                        Repo
                      </div>
                      <div className="mt-2 truncate text-lg font-semibold">
                        {repo?.nameWithOwner ?? selectedProject?.name ?? "Select a project"}
                      </div>
                      <p className="mt-1 text-xs text-white/60">
                        {repo?.defaultBranch
                          ? `Default branch: ${repo.defaultBranch}`
                          : "Pick a local project to inspect its GitHub repo."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/12 bg-black/20 p-5 text-white shadow-2xl shadow-black/20 backdrop-blur">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium tracking-wide text-white">Actions</h3>
                    <p className="text-xs text-white/60">
                      Run a fresh verification, start the browser auth flow, or copy the fallback
                      command.
                    </p>
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    <Button
                      variant="secondary"
                      className="justify-between bg-white/10 text-white hover:bg-white/15"
                      onClick={refreshAll}
                      disabled={statusQuery.isFetching}
                    >
                      Verify `gh`
                      <RefreshCcwIcon className={statusQuery.isFetching ? "animate-spin" : ""} />
                    </Button>
                    <Button
                      className="justify-between"
                      onClick={() => loginMutation.mutate()}
                      disabled={!statusQuery.data?.installed || loginMutation.isPending}
                    >
                      {loginMutation.isPending
                        ? "Waiting for GitHub auth"
                        : "Authenticate with browser"}
                      <LogInIcon />
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-between"
                      onClick={() => void copyAuthCommand()}
                    >
                      {copiedAuthCommand ? "Copied command" : "Copy fallback command"}
                      <ExternalLinkIcon />
                    </Button>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/12 bg-black/25 p-3 font-mono text-xs text-white/75">
                    {AUTH_COMMAND}
                  </div>

                  {statusQuery.error && (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-50">
                      <div className="flex items-center gap-2 font-medium">
                        <ShieldAlertIcon className="size-3.5" />
                        Status check failed
                      </div>
                      <p className="mt-1 text-amber-50/80">{statusQuery.error.message}</p>
                    </div>
                  )}

                  {loginMutation.error && (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-50">
                      <div className="flex items-center gap-2 font-medium">
                        <ShieldAlertIcon className="size-3.5" />
                        Auth flow failed
                      </div>
                      <p className="mt-1 text-amber-50/80">{loginMutation.error.message}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
              <Card className="rounded-3xl">
                <CardHeader>
                  <CardTitle>Project source</CardTitle>
                  <CardDescription>Choose which local repo powers the issue menu.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-foreground">Project</span>
                    <Select
                      items={projects.map((project) => ({
                        label: project.name,
                        value: project.cwd,
                      }))}
                      value={selectedCwd}
                      onValueChange={(value) => setSelectedCwd(value ?? null)}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            projects.length === 0 ? "No projects yet" : "Select a project"
                          }
                        />
                      </SelectTrigger>
                      <SelectPopup alignItemWithTrigger={false}>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.cwd}>
                            <div className="flex min-w-0 flex-col text-left">
                              <span className="truncate">{project.name}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {project.cwd}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    {selectedProject ? (
                      <>
                        <div className="font-medium text-foreground">{selectedProject.name}</div>
                        <div className="mt-1 break-all">{selectedProject.cwd}</div>
                      </>
                    ) : (
                      <div>Add a GitHub backed project to activate issue browsing.</div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {statusQuery.data?.scopes.map((scope) => (
                      <Badge key={scope} variant="outline">
                        {scope}
                      </Badge>
                    ))}
                    {statusQuery.data && statusQuery.data.scopes.length === 0 && (
                      <Badge variant="outline">No scopes reported</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>Issue menu</CardTitle>
                      <CardDescription>
                        A repo aware list of GitHub issues you can scan and open fast.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ISSUE_STATES.map((item) => (
                        <Button
                          key={item.value}
                          size="xs"
                          variant={issueState === item.value ? "default" : "outline"}
                          onClick={() => setIssueState(item.value)}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={statusQuery.data?.installed ? "success" : "error"}>
                      {statusQuery.data?.installed ? "gh ready" : "gh missing"}
                    </Badge>
                    <Badge variant={statusQuery.data?.authenticated ? "success" : "warning"}>
                      {statusQuery.data?.authenticated ? "signed in" : "sign in required"}
                    </Badge>
                    {repo && <Badge variant="outline">{repo.nameWithOwner}</Badge>}
                    {repo?.url && (
                      <Button size="xs" variant="ghost" onClick={() => void openUrl(repo.url)}>
                        Open repo
                        <ExternalLinkIcon />
                      </Button>
                    )}
                  </div>

                  {!statusQuery.data?.installed ? (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                      Install `gh` to unlock GitHub status checks and issue browsing.
                    </div>
                  ) : !statusQuery.data.authenticated ? (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                      Authenticate the GitHub CLI, then come back to load issues for the selected
                      project.
                    </div>
                  ) : !repo ? (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                      The selected project does not resolve to a GitHub repository yet.
                    </div>
                  ) : issuesQuery.isLoading || issuesQuery.isFetching ? (
                    <div className="rounded-2xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
                      Loading issues from GitHub…
                    </div>
                  ) : issuesQuery.error ? (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/6 p-6 text-sm text-destructive-foreground">
                      {issuesQuery.error.message}
                    </div>
                  ) : issuesQuery.data && issuesQuery.data.issues.length > 0 ? (
                    <div className="grid gap-3">
                      {issuesQuery.data.issues.map((issue) => (
                        <button
                          key={issue.number}
                          type="button"
                          className="group flex w-full flex-col gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-accent/50"
                          onClick={() => void openUrl(issue.url)}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">#{issue.number}</span>
                                <Badge variant={issue.state === "open" ? "success" : "secondary"}>
                                  {issue.state}
                                </Badge>
                                {issue.author && <span>by {issue.author}</span>}
                              </div>
                              <div className="mt-2 text-sm font-medium text-foreground group-hover:text-foreground">
                                {issue.title}
                              </div>
                            </div>
                            <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {issue.labels.map((label) => (
                              <span
                                key={label.name}
                                className="rounded-full border border-border px-2 py-0.5"
                              >
                                {label.name}
                              </span>
                            ))}
                            {issue.assignees.map((assignee) => (
                              <Badge key={assignee.login} variant="outline">
                                @{assignee.login}
                              </Badge>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>Updated {formatTimestamp(issue.updatedAt)}</span>
                            <span>Created {formatTimestamp(issue.createdAt)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                      No issues matched the current filter.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/github")({
  component: GitHubRouteView,
});
