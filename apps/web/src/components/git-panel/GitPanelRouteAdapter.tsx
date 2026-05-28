import type { ScopedThreadRef } from "@t3tools/contracts";
import { Suspense, lazy, useCallback, useMemo } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { selectEnvironmentState, useStore } from "~/store";
import { createThreadSelectorByRef } from "~/storeSelectors";
import { projectScriptCwd } from "@t3tools/shared/projectScripts";
import { DiffPanelLoadingState } from "../DiffPanelShell";
import { RightPanelSheet } from "../RightPanelSheet";
import { Sidebar, SidebarProvider, SidebarRail } from "../ui/sidebar";

const GitPanel = lazy(() => import("./GitPanel"));

const GIT_PANEL_INLINE_LAYOUT_MEDIA_QUERY = "(max-width: 1280px)";
const GIT_PANEL_INLINE_SIDEBAR_WIDTH_STORAGE_KEY = "chat_git_panel_sidebar_width";
const GIT_PANEL_INLINE_DEFAULT_WIDTH = "clamp(24rem,36vw,34rem)";
const GIT_PANEL_INLINE_SIDEBAR_MIN_WIDTH = 22 * 16;

interface GitPanelRouteAdapterProps {
  gitOpen: boolean;
  onCloseGit: () => void;
  onOpenGit: () => void;
  renderGitContent: boolean;
  threadRef: ScopedThreadRef;
}

export function GitPanelRouteAdapter(props: GitPanelRouteAdapterProps) {
  const activeThread = useStore(
    useMemo(() => createThreadSelectorByRef(props.threadRef), [props.threadRef]),
  );
  const activeProject = useStore((store) =>
    activeThread
      ? selectEnvironmentState(store, props.threadRef.environmentId).projectById[
          activeThread.projectId
        ]
      : undefined,
  );
  const activeDraftThread = useComposerDraftStore((store) =>
    store.getDraftThreadByRef(props.threadRef),
  );
  const fallbackDraftProject = useStore((store) => {
    if (!activeDraftThread) {
      return undefined;
    }
    return selectEnvironmentState(store, props.threadRef.environmentId).projectById[
      activeDraftThread.projectId
    ];
  });
  const shouldUseGitSheet = useMediaQuery(GIT_PANEL_INLINE_LAYOUT_MEDIA_QUERY);
  const project = activeProject ?? fallbackDraftProject;
  const activeWorktreePath = activeThread?.worktreePath ?? activeDraftThread?.worktreePath ?? null;
  const workspaceCwd = project
    ? projectScriptCwd({
        project: { cwd: project.cwd },
        worktreePath: activeWorktreePath,
      })
    : null;
  const repoCwd = project?.cwd ?? null;

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        props.onOpenGit();
        return;
      }
      props.onCloseGit();
    },
    [props],
  );

  const gitPanelContent = props.renderGitContent ? (
    <Suspense fallback={<DiffPanelLoadingState label="Loading Git panel..." />}>
      <GitPanel activeThreadRef={props.threadRef} repoCwd={repoCwd} workspaceCwd={workspaceCwd} />
    </Suspense>
  ) : null;

  if (shouldUseGitSheet) {
    return (
      <RightPanelSheet open={props.gitOpen} onClose={props.onCloseGit}>
        {gitPanelContent}
      </RightPanelSheet>
    );
  }

  return (
    <SidebarProvider
      defaultOpen={false}
      open={props.gitOpen}
      onOpenChange={onOpenChange}
      className="w-auto min-h-0 flex-none bg-transparent"
      style={{ "--sidebar-width": GIT_PANEL_INLINE_DEFAULT_WIDTH } as React.CSSProperties}
    >
      <Sidebar
        side="right"
        collapsible="offcanvas"
        className="border-l border-sidebar-border bg-sidebar text-sidebar-foreground"
        resizable={{
          minWidth: GIT_PANEL_INLINE_SIDEBAR_MIN_WIDTH,
          storageKey: GIT_PANEL_INLINE_SIDEBAR_WIDTH_STORAGE_KEY,
        }}
      >
        {gitPanelContent}
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
}
