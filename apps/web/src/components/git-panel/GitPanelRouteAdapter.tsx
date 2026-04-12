import { ThreadId } from "@t3tools/contracts";
import { Suspense, lazy, useCallback } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { useStore } from "~/store";
import { Sheet, SheetPopup } from "../ui/sheet";
import { Sidebar, SidebarProvider, SidebarRail } from "../ui/sidebar";
import { DiffPanelLoadingState } from "../DiffPanelShell";
import { resolveGitPanelContext } from "./resolveGitPanelContext";

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
  threadId: ThreadId;
}

export function GitPanelRouteAdapter(props: GitPanelRouteAdapterProps) {
  const activeThread = useStore((store) =>
    store.threads.find((thread) => thread.id === props.threadId),
  );
  const activeProject = useStore((store) =>
    activeThread
      ? (store.projects.find((project) => project.id === activeThread.projectId) ?? null)
      : null,
  );
  const activeDraftThread = useComposerDraftStore((store) => store.getDraftThread(props.threadId));
  const shouldUseGitSheet = useMediaQuery(GIT_PANEL_INLINE_LAYOUT_MEDIA_QUERY);
  const gitPanelContext = resolveGitPanelContext({
    activeDraftThread,
    activeProject,
    activeThread: activeThread ?? null,
  });

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
      <GitPanel
        activeThreadId={props.threadId}
        panelVariant="sidepanel"
        repoCwd={gitPanelContext.repoCwd}
        repoRoot={gitPanelContext.repoRoot}
        workspaceCwd={gitPanelContext.workspaceCwd}
      />
    </Suspense>
  ) : null;

  if (shouldUseGitSheet) {
    return (
      <Sheet
        open={props.gitOpen}
        onOpenChange={(open) => {
          if (!open) {
            props.onCloseGit();
          }
        }}
      >
        <SheetPopup
          side="right"
          showCloseButton={false}
          keepMounted
          className="w-[min(88vw,640px)] max-w-[640px] p-0"
        >
          {gitPanelContent}
        </SheetPopup>
      </Sheet>
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
