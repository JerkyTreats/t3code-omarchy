import type { ScopedThreadRef } from "@t3tools/contracts";
import { GitBranchIcon, GitCommitIcon } from "lucide-react";

import GitActionsControl from "../GitActionsControl";
import { GitHubIcon } from "../Icons";
import { ScrollArea } from "../ui/scroll-area";
import { Spinner } from "../ui/spinner";
import { useGitStatus } from "~/lib/gitStatusState";

interface GitPanelProps {
  activeThreadRef: ScopedThreadRef;
  repoCwd: string | null;
  workspaceCwd: string | null;
}

function formatChangedFileCount(count: number) {
  return count === 1 ? "1 file" : `${count} files`;
}

export default function GitPanel({ activeThreadRef, repoCwd, workspaceCwd }: GitPanelProps) {
  const gitCwd = workspaceCwd ?? repoCwd;
  const {
    data: gitStatus = null,
    error,
    isPending,
  } = useGitStatus({
    environmentId: activeThreadRef.environmentId,
    cwd: gitCwd,
  });
  const files = gitStatus?.workingTree.files ?? [];

  return (
    <aside className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between gap-3 border-b border-sidebar-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <GitHubIcon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium">Git panel</h2>
            <p className="truncate text-xs text-muted-foreground">
              {workspaceCwd ?? repoCwd ?? "No workspace"}
            </p>
          </div>
        </div>
        <GitActionsControl gitCwd={gitCwd} activeThreadRef={activeThreadRef} />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {isPending ? (
            <div className="flex items-center gap-2 rounded-md border border-sidebar-border bg-background/40 p-3 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading Git status...
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message}
            </div>
          ) : gitStatus && !gitStatus.isRepo ? (
            <div className="rounded-md border border-sidebar-border bg-background/40 p-3 text-sm text-muted-foreground">
              This workspace is not a Git repository.
            </div>
          ) : (
            <>
              <section className="rounded-md border border-sidebar-border bg-background/40 p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <GitBranchIcon className="size-3.5" />
                  Branch
                </div>
                <div className="mt-2 text-sm font-medium">
                  {gitStatus?.refName ?? "Detached HEAD"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {gitStatus?.hasUpstream ? "Tracking upstream" : "No upstream configured"}
                </p>
                {gitStatus ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ahead {gitStatus.aheadCount} / behind {gitStatus.behindCount}
                  </p>
                ) : null}
              </section>

              <section className="rounded-md border border-sidebar-border bg-background/40">
                <div className="flex items-center justify-between gap-3 border-b border-sidebar-border px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <GitCommitIcon className="size-3.5" />
                    Changed files
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatChangedFileCount(files.length)}
                  </span>
                </div>
                {files.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">No local changes.</p>
                ) : (
                  <div className="divide-y divide-sidebar-border">
                    {files.map((file) => (
                      <div key={file.path} className="grid gap-1 px-3 py-2">
                        <div className="min-w-0 truncate font-mono text-xs">{file.path}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-success">+{file.insertions}</span>
                          <span className="text-destructive">-{file.deletions}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
