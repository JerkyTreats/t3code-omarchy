import type { EnvironmentId } from "@t3tools/contracts";
import { useCallback } from "react";

import { openInPreferredEditor } from "~/editorPreferences";
import { readLocalApi } from "~/localApi";
import { resolvePathLinkTarget } from "~/terminal-links";
import { DocumentShell } from "../DocumentShell";
import { PanelTab } from "../DiffPanelShell";
import { ProjectFilePreviewHeader, ProjectFilePreviewSurface } from "../ProjectFilePreviewSurface";

export function FilesConversationDocument(props: {
  environmentId: EnvironmentId;
  cwd: string | null;
  docPath: string;
  onCollapseDocument: () => void;
}) {
  const openProjectFileInEditor = useCallback(
    (relativePath: string) => {
      const api = readLocalApi();
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

  return (
    <DocumentShell
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
          environmentId={props.environmentId}
          cwd={props.cwd}
          filePath={props.docPath}
          onOpenFileInEditor={openProjectFileInEditor}
        />
      }
    >
      <ProjectFilePreviewSurface
        environmentId={props.environmentId}
        cwd={props.cwd}
        filePath={props.docPath}
        wordWrap
        showHeader={false}
        onOpenFileInEditor={openProjectFileInEditor}
      />
    </DocumentShell>
  );
}
