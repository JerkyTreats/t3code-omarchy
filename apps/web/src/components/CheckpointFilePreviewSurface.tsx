import { FileTextIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { checkpointFileQueryOptions } from "~/lib/providerReactQuery";
import { DiffPanelLoadingState } from "./DiffPanelShell";
import { FilePreviewSurface } from "./FilePreviewSurface";

function ResolvedCheckpointMarkdownImage(props: {
  threadId: string;
  turnCount: number;
  relativePath: string;
  alt: string;
  onOpen: (src: string, alt: string) => void;
}) {
  const assetQuery = useQuery(
    checkpointFileQueryOptions({
      threadId: props.threadId as never,
      turnCount: props.turnCount,
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

export function CheckpointFilePreviewSurface(props: {
  threadId: string;
  turnCount: number;
  filePath: string;
  wordWrap: boolean;
  onNavigateToPath: (relativePath: string, hash?: string) => void;
  onOpenFileInEditor: (relativePath: string) => void;
}) {
  const fileQuery = useQuery(
    checkpointFileQueryOptions({
      threadId: props.threadId as never,
      turnCount: props.turnCount,
      relativePath: props.filePath,
    }),
  );

  if (fileQuery.isLoading) {
    return <DiffPanelLoadingState label="Loading checkpoint file preview..." />;
  }

  if (fileQuery.error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="max-w-md rounded-3xl border border-border/60 bg-card/45 p-6 text-center shadow-[0_24px_80px_-48px_color-mix(in_srgb,var(--foreground)_42%,transparent)]">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-background/70 text-muted-foreground">
            <FileTextIcon className="size-5" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Preview unavailable</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {fileQuery.error instanceof Error ? fileQuery.error.message : "Failed to load preview."}
          </p>
        </div>
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
      renderResolvedImage={({ relativePath, alt, onOpen }) => (
        <ResolvedCheckpointMarkdownImage
          threadId={props.threadId}
          turnCount={props.turnCount}
          relativePath={relativePath}
          alt={alt}
          onOpen={onOpen}
        />
      )}
    />
  );
}
