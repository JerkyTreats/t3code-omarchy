import { BinaryIcon, FileImageIcon, FileTextIcon, ImageIcon, PencilLineIcon } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { checkpointFileQueryOptions } from "~/lib/providerReactQuery";
import { cn } from "~/lib/utils";
import { DiffPanelLoadingState } from "./DiffPanelShell";
import { DocumentMarkdownRenderer } from "./DocumentMarkdownRenderer";
import { SourceFilePreview } from "./SourceFilePreview";
import { CheckpointImageLightbox } from "./CheckpointImageLightbox";

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function PreviewStateCard(props: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center p-4">
      <div className="max-w-md rounded-3xl border border-border/60 bg-card/45 p-6 text-center shadow-[0_24px_80px_-48px_color-mix(in_srgb,var(--foreground)_42%,transparent)]">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-background/70 text-muted-foreground">
          {props.icon}
        </div>
        <h3 className="text-base font-semibold text-foreground">{props.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{props.detail}</p>
        {props.actionLabel && props.onAction ? (
          <button
            type="button"
            className="mt-4 inline-flex items-center justify-center rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background"
            onClick={props.onAction}
          >
            {props.actionLabel}
          </button>
        ) : null}
      </div>
    </div>
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
  const [imageOpen, setImageOpen] = useState(false);

  if (fileQuery.isLoading) {
    return <DiffPanelLoadingState label="Loading checkpoint file preview..." />;
  }

  if (fileQuery.error) {
    return (
      <PreviewStateCard
        icon={<FileTextIcon className="size-5" />}
        title="Preview unavailable"
        detail={
          fileQuery.error instanceof Error ? fileQuery.error.message : "Failed to load preview."
        }
        actionLabel="Open in editor"
        onAction={() => props.onOpenFileInEditor(props.filePath)}
      />
    );
  }

  const file = fileQuery.data;
  if (!file) {
    return null;
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 bg-card/50 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[11px] text-foreground/90">{file.path}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/75">
            {file.kind === "missing"
              ? file.reason
              : file.kind === "too-large" || file.kind === "binary" || file.kind === "image"
                ? `${file.mimeType} · ${formatBytes(file.byteSize)}`
                : `${file.mimeType} · ${file.language} · ${formatBytes(file.byteSize)}`}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-background"
          onClick={() => props.onOpenFileInEditor(file.path)}
        >
          <PencilLineIcon className="size-3.5" />
          Open
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {file.kind === "text" && file.isMarkdown && !file.path.toLowerCase().endsWith(".mdx") ? (
          <DocumentMarkdownRenderer
            threadId={props.threadId}
            turnCount={props.turnCount}
            filePath={file.path}
            markdown={file.text}
            onNavigateToPath={props.onNavigateToPath}
            onOpenFileInEditor={props.onOpenFileInEditor}
          />
        ) : null}
        {file.kind === "text" && (!file.isMarkdown || file.path.toLowerCase().endsWith(".mdx")) ? (
          <div className="h-full min-h-0 overflow-auto p-4">
            <SourceFilePreview
              code={file.text}
              language={file.language}
              wordWrap={props.wordWrap}
            />
          </div>
        ) : null}
        {file.kind === "image" ? (
          <div className="relative flex h-full items-center justify-center p-6">
            {imageOpen ? (
              <CheckpointImageLightbox
                images={[{ src: file.dataUrl, alt: file.path }]}
                index={0}
                onClose={() => setImageOpen(false)}
              />
            ) : null}
            <button
              type="button"
              className="group rounded-[28px] border border-border/60 bg-card/45 p-3 shadow-[0_24px_80px_-48px_color-mix(in_srgb,var(--foreground)_42%,transparent)]"
              onClick={() => setImageOpen(true)}
            >
              <img
                src={file.dataUrl}
                alt={file.path}
                className="max-h-[72vh] max-w-full rounded-[20px] object-contain"
              />
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="truncate">{file.path}</span>
                <span className={cn("shrink-0 transition-colors group-hover:text-foreground")}>
                  Click to zoom
                </span>
              </div>
            </button>
          </div>
        ) : null}
        {file.kind === "binary" ? (
          <PreviewStateCard
            icon={<BinaryIcon className="size-5" />}
            title="Binary file preview is unavailable"
            detail={`${file.mimeType} · ${formatBytes(file.byteSize)}`}
            actionLabel="Open in editor"
            onAction={() => props.onOpenFileInEditor(file.path)}
          />
        ) : null}
        {file.kind === "too-large" ? (
          <PreviewStateCard
            icon={
              file.previewKind === "image" ? (
                <FileImageIcon className="size-5" />
              ) : (
                <FileTextIcon className="size-5" />
              )
            }
            title="File is too large to preview"
            detail={`${file.mimeType} · ${formatBytes(file.byteSize)} · limit ${formatBytes(file.maxPreviewBytes)}`}
            actionLabel="Open in editor"
            onAction={() => props.onOpenFileInEditor(file.path)}
          />
        ) : null}
        {file.kind === "missing" ? (
          <PreviewStateCard
            icon={
              file.reason === "deleted" ? (
                <ImageIcon className="size-5" />
              ) : (
                <FileTextIcon className="size-5" />
              )
            }
            title={
              file.reason === "deleted"
                ? "File was deleted in this turn"
                : "File not found in checkpoint"
            }
            detail={file.path}
            actionLabel="Open in editor"
            onAction={() => props.onOpenFileInEditor(file.path)}
          />
        ) : null}
      </div>
    </div>
  );
}
