import { useQuery } from "@tanstack/react-query";

import { projectReadFileQueryOptions } from "~/lib/projectReactQuery";
import { DiffPanelLoadingState } from "./DiffPanelShell";
import { FilePreviewHeaderContent, FilePreviewSurface } from "./FilePreviewSurface";

function ResolvedProjectMarkdownImage(props: {
  cwd: string;
  relativePath: string;
  alt: string;
  onOpen: (src: string, alt: string) => void;
}) {
  const assetQuery = useQuery(
    projectReadFileQueryOptions({
      cwd: props.cwd,
      relativePath: props.relativePath,
    }),
  );

  if (assetQuery.isLoading) {
    return <div className="document-image-placeholder">Loading image...</div>;
  }

  if (assetQuery.data?.kind !== "image") {
    return <div className="document-image-placeholder">Image unavailable.</div>;
  }
  const imageData = assetQuery.data;
  if (!imageData || imageData.kind !== "image") {
    return <div className="document-image-placeholder">Image unavailable.</div>;
  }

  return (
    <figure className="document-image-figure">
      <button
        type="button"
        className="w-full"
        onClick={() => props.onOpen(imageData.dataUrl, props.alt)}
      >
        <img
          src={imageData.dataUrl}
          alt={props.alt}
          className="document-image"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </button>
      {props.alt.length > 0 ? (
        <figcaption className="document-image-caption">{props.alt}</figcaption>
      ) : null}
    </figure>
  );
}

export function ProjectFilePreviewSurface(props: {
  cwd: string | null;
  filePath: string | null;
  wordWrap: boolean;
  onNavigateToPath: (relativePath: string, hash?: string) => void;
  onOpenFileInEditor: (relativePath: string) => void;
  showHeader?: boolean;
}) {
  const fileQuery = useQuery(
    projectReadFileQueryOptions({
      cwd: props.cwd,
      relativePath: props.filePath,
      enabled: props.cwd !== null && props.filePath !== null,
    }),
  );

  if (fileQuery.isLoading) {
    return <DiffPanelLoadingState label="Loading workspace file preview..." />;
  }

  if (fileQuery.error) {
    return (
      <div className="flex h-full items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
        {fileQuery.error instanceof Error ? fileQuery.error.message : "Failed to load preview."}
      </div>
    );
  }

  if (!fileQuery.data) {
    return null;
  }

  return (
    <FilePreviewSurface
      file={fileQuery.data}
      wordWrap={props.wordWrap}
      onNavigateToPath={props.onNavigateToPath}
      onOpenFileInEditor={props.onOpenFileInEditor}
      renderResolvedImage={({ relativePath, alt, onOpen }) =>
        props.cwd ? (
          <ResolvedProjectMarkdownImage
            cwd={props.cwd}
            relativePath={relativePath}
            alt={alt}
            onOpen={onOpen}
          />
        ) : (
          <div className="document-image-placeholder">Image unavailable.</div>
        )
      }
      {...(props.showHeader !== undefined ? { showHeader: props.showHeader } : {})}
    />
  );
}

export function ProjectFilePreviewHeader(props: {
  cwd: string | null;
  filePath: string | null;
  onOpenFileInEditor: (relativePath: string) => void;
}) {
  const fileQuery = useQuery(
    projectReadFileQueryOptions({
      cwd: props.cwd,
      relativePath: props.filePath,
      enabled: props.cwd !== null && props.filePath !== null,
    }),
  );

  if (!fileQuery.data) {
    return <span className="text-xs text-muted-foreground">Loading preview...</span>;
  }

  return (
    <FilePreviewHeaderContent file={fileQuery.data} onOpenFileInEditor={props.onOpenFileInEditor} />
  );
}
