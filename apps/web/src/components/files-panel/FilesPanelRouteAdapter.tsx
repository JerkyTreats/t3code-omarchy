import { type GitFileStatus, type ThreadId } from "@t3tools/contracts";
import { Suspense, lazy, useCallback, useMemo } from "react";

import { openInPreferredEditor } from "~/editorPreferences";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { useGitStatus } from "~/lib/gitStatusState";
import { readNativeApi } from "~/nativeApi";
import { useStore } from "~/store";
import { resolvePathLinkTarget } from "~/terminal-links";
import { DocumentShell } from "../DocumentShell";
import { DiffPanelLoadingState, PanelTab } from "../DiffPanelShell";
import { ProjectFilePreviewHeader, ProjectFilePreviewSurface } from "../ProjectFilePreviewSurface";
import { Sheet, SheetPopup } from "../ui/sheet";
import { Sidebar, SidebarProvider, SidebarRail } from "../ui/sidebar";

const FILES_PANEL_INLINE_LAYOUT_MEDIA_QUERY = "(max-width: 1280px)";
const FILES_PANEL_INLINE_DEFAULT_WIDTH = "clamp(22rem,32vw,30rem)";
const FILES_PANEL_INLINE_SIDEBAR_MIN_WIDTH = 20 * 16;
const FILES_PANEL_SIDEBAR_WIDTH_STORAGE_KEY = "chat_files_panel_sidebar_width";

const ProjectExplorerPanel = lazy(() =>
  import("./ProjectExplorerPanel").then((module) => ({
    default: module.ProjectExplorerPanel,
  })),
);

function buildGitStatusMap(files: ReadonlyArray<{ path: string; status: GitFileStatus }>) {
  return new Map(
    files.filter((file) => file.status !== "deleted").map((file) => [file.path, file.status]),
  );
}

function FilesPanelContent(props: {
  cwd: string | null;
  docPath: string | null;
  expandedDocument: boolean;
  onSelectFile: (pathValue: string) => void;
  onExpandDocument: () => void;
  showPreview?: boolean;
  useExplorerChrome?: boolean;
}) {
  const gitStatusQuery = useGitStatus(props.cwd);
  const statusByPath = useMemo(
    () => buildGitStatusMap(gitStatusQuery.data?.workingTree.files ?? []),
    [gitStatusQuery.data?.workingTree.files],
  );
  const openProjectFileInEditor = useCallback(
    (relativePath: string) => {
      const api = readNativeApi();
      if (!api || !props.cwd) {
        return;
      }
      const targetPath = resolvePathLinkTarget(relativePath, props.cwd);
      void openInPreferredEditor(api, targetPath).catch((error) => {
        console.warn("Failed to open project file in editor.", error);
      });
    },
    [props.cwd],
  );

  if ((props.showPreview ?? true) && props.docPath && !props.expandedDocument) {
    return (
      <div className="document-chrome-shell h-full min-h-0">
        <DocumentShell
          variant="side-preview"
          panelTab={
            <PanelTab
              onClick={props.onExpandDocument}
              ariaLabel="Show preview in conversation view"
              title="Show in conversation view"
              placement="outside-left"
            />
          }
          header={
            <ProjectFilePreviewHeader
              cwd={props.cwd}
              filePath={props.docPath}
              onOpenFileInEditor={openProjectFileInEditor}
            />
          }
        >
          <ProjectFilePreviewSurface
            cwd={props.cwd}
            filePath={props.docPath}
            wordWrap={false}
            showHeader={false}
            onNavigateToPath={props.onSelectFile}
            onOpenFileInEditor={openProjectFileInEditor}
          />
        </DocumentShell>
      </div>
    );
  }

  return (
    <div
      className={
        props.useExplorerChrome || props.expandedDocument
          ? "document-chrome-shell--explorer h-full min-h-0"
          : "document-chrome-shell h-full min-h-0"
      }
    >
      <DocumentShell
        variant="explorer"
        header={
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
              Project files
            </p>
          </div>
        }
      >
        <Suspense fallback={<DiffPanelLoadingState label="Loading files panel..." />}>
          <ProjectExplorerPanel
            cwd={props.cwd}
            selectedPath={props.docPath}
            statusByPath={statusByPath}
            onSelectFile={props.onSelectFile}
          />
        </Suspense>
      </DocumentShell>
    </div>
  );
}

interface FilesPanelRouteAdapterProps {
  open: boolean;
  onCloseFiles: () => void;
  onOpenFiles: () => void;
  renderContent: boolean;
  threadId: ThreadId;
  docPath: string | null;
  expandedDocument: boolean;
  onSelectFile: (pathValue: string) => void;
  onExpandDocument: () => void;
  showPreview?: boolean;
  useExplorerChrome?: boolean;
}

export function FilesPanelRouteAdapter(props: FilesPanelRouteAdapterProps) {
  const activeThread = useStore((store) =>
    store.threads.find((thread) => thread.id === props.threadId),
  );
  const activeProject = useStore((store) =>
    activeThread
      ? (store.projects.find((project) => project.id === activeThread.projectId) ?? null)
      : null,
  );
  const projectCwd = activeProject?.cwd ?? null;
  const shouldUseSheet = useMediaQuery(FILES_PANEL_INLINE_LAYOUT_MEDIA_QUERY);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        props.onOpenFiles();
        return;
      }
      props.onCloseFiles();
    },
    [props],
  );

  const panelContent = props.renderContent ? (
    <FilesPanelContent
      cwd={projectCwd}
      docPath={shouldUseSheet && props.expandedDocument ? null : props.docPath}
      expandedDocument={props.expandedDocument}
      onSelectFile={props.onSelectFile}
      onExpandDocument={props.onExpandDocument}
      {...(props.showPreview !== undefined ? { showPreview: props.showPreview } : {})}
      {...(props.useExplorerChrome !== undefined
        ? { useExplorerChrome: props.useExplorerChrome }
        : {})}
    />
  ) : null;

  if (shouldUseSheet) {
    return (
      <Sheet
        open={props.open}
        onOpenChange={(open) => {
          if (!open) {
            props.onCloseFiles();
          }
        }}
      >
        <SheetPopup
          side="right"
          showCloseButton={false}
          keepMounted
          className="w-[min(88vw,580px)] max-w-[580px] p-0"
        >
          {panelContent}
        </SheetPopup>
      </Sheet>
    );
  }

  return (
    <SidebarProvider
      defaultOpen={false}
      open={props.open}
      onOpenChange={onOpenChange}
      className="w-auto min-h-0 flex-none bg-transparent"
      style={{ "--sidebar-width": FILES_PANEL_INLINE_DEFAULT_WIDTH } as React.CSSProperties}
    >
      <Sidebar
        side="right"
        collapsible="offcanvas"
        className="border-l border-border bg-background text-foreground"
        resizable={{
          minWidth: FILES_PANEL_INLINE_SIDEBAR_MIN_WIDTH,
          storageKey: FILES_PANEL_SIDEBAR_WIDTH_STORAGE_KEY,
        }}
      >
        {panelContent}
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
}
