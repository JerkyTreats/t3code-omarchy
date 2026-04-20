import { type ThreadId } from "@t3tools/contracts";
import { useCallback, useMemo } from "react";

import { useComposerDraftStore } from "~/composerDraftStore";
import { openInPreferredEditor } from "~/editorPreferences";
import { readNativeApi } from "~/nativeApi";
import { useStore } from "~/store";
import { resolvePathLinkTarget } from "~/terminal-links";
import { DocumentShell } from "../DocumentShell";
import { PanelTab } from "../DiffPanelShell";
import { ProjectFilePreviewHeader, ProjectFilePreviewSurface } from "../ProjectFilePreviewSurface";
import { resolveFilesPanelProject } from "./resolveFilesPanelProject";

export function FilesConversationDocument(props: {
  threadId: ThreadId;
  docPath: string;
  onNavigateToPath: (relativePath: string, hash?: string) => void;
  onCollapseDocument: () => void;
}) {
  const activeThread = useStore((store) =>
    store.threads.find((thread) => thread.id === props.threadId),
  );
  const activeDraftThread = useComposerDraftStore((store) => store.getDraftThread(props.threadId));
  const projects = useStore((store) => store.projects);
  const activeProject = useMemo(
    () =>
      resolveFilesPanelProject({
        activeDraftThread,
        activeThread: activeThread ?? null,
        projects,
      }),
    [activeDraftThread, activeThread, projects],
  );
  const projectCwd = activeProject?.cwd ?? null;

  const openProjectFileInEditor = useCallback(
    (relativePath: string) => {
      const api = readNativeApi();
      if (!api || !projectCwd) {
        return;
      }
      const targetPath = resolvePathLinkTarget(relativePath, projectCwd);
      void openInPreferredEditor(api, targetPath).catch((error) => {
        console.warn("Failed to open project file in editor.", error);
      });
    },
    [projectCwd],
  );

  return (
    <DocumentShell
      variant="main"
      panelTab={
        <PanelTab
          onClick={props.onCollapseDocument}
          ariaLabel="Return preview to side panel"
          title="Return to side panel"
          placement="flush-left"
        />
      }
      header={
        <ProjectFilePreviewHeader
          cwd={projectCwd}
          filePath={props.docPath}
          onOpenFileInEditor={openProjectFileInEditor}
        />
      }
    >
      <ProjectFilePreviewSurface
        cwd={projectCwd}
        filePath={props.docPath}
        wordWrap={false}
        showHeader={false}
        onNavigateToPath={props.onNavigateToPath}
        onOpenFileInEditor={openProjectFileInEditor}
      />
    </DocumentShell>
  );
}
