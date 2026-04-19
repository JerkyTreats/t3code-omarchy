import { BinaryIcon, FileImageIcon, FileTextIcon, ImageIcon, PencilLineIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { ProjectReadFileResult } from "@t3tools/contracts";
import { cn } from "~/lib/utils";
import {
  DocumentMarkdownRenderer,
  type RenderResolvedDocumentImageInput,
} from "./DocumentMarkdownRenderer";
import { SourceFilePreview } from "./SourceFilePreview";
import { CheckpointImageLightbox } from "./CheckpointImageLightbox";

export function formatPreviewBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function PreviewStateCard(props: {
  icon: ReactNode;
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

export function FilePreviewHeaderContent(props: {
  file: ProjectReadFileResult;
  onOpenFileInEditor: (relativePath: string) => void;
}) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[11px] text-foreground/90">{props.file.path}</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/75">
          {props.file.kind === "missing"
            ? props.file.reason
            : props.file.kind === "too-large" ||
                props.file.kind === "binary" ||
                props.file.kind === "image"
              ? `${props.file.mimeType} · ${formatPreviewBytes(props.file.byteSize)}`
              : `${props.file.mimeType} · ${props.file.language} · ${formatPreviewBytes(props.file.byteSize)}`}
        </p>
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-background"
        onClick={() => props.onOpenFileInEditor(props.file.path)}
      >
        <PencilLineIcon className="size-3.5" />
        Open
      </button>
    </>
  );
}

export function FilePreviewSurface(props: {
  file: ProjectReadFileResult;
  wordWrap: boolean;
  onNavigateToPath: (relativePath: string, hash?: string) => void;
  onOpenFileInEditor: (relativePath: string) => void;
  renderResolvedImage?: (input: RenderResolvedDocumentImageInput) => ReactNode;
  showHeader?: boolean;
}) {
  const [imageOpen, setImageOpen] = useState(false);

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {props.showHeader !== false ? (
        <div className="flex items-center gap-2 border-b border-border/60 bg-card/50 px-4 py-2.5">
          <FilePreviewHeaderContent
            file={props.file}
            onOpenFileInEditor={props.onOpenFileInEditor}
          />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {props.file.kind === "text" &&
        props.file.isMarkdown &&
        !props.file.path.toLowerCase().endsWith(".mdx") ? (
          <DocumentMarkdownRenderer
            filePath={props.file.path}
            markdown={props.file.text}
            onNavigateToPath={props.onNavigateToPath}
            onOpenFileInEditor={props.onOpenFileInEditor}
            {...(props.renderResolvedImage
              ? { renderResolvedImage: props.renderResolvedImage }
              : {})}
          />
        ) : null}
        {props.file.kind === "text" &&
        (!props.file.isMarkdown || props.file.path.toLowerCase().endsWith(".mdx")) ? (
          <div className="h-full min-h-0 overflow-auto p-4">
            <SourceFilePreview
              code={props.file.text}
              language={props.file.language}
              wordWrap={props.wordWrap}
            />
          </div>
        ) : null}
        {props.file.kind === "image" ? (
          <div className="relative flex h-full items-center justify-center p-6">
            {imageOpen ? (
              <CheckpointImageLightbox
                images={[{ src: props.file.dataUrl, alt: props.file.path }]}
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
                src={props.file.dataUrl}
                alt={props.file.path}
                className="max-h-[72vh] max-w-full rounded-[20px] object-contain"
              />
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="truncate">{props.file.path}</span>
                <span className={cn("shrink-0 transition-colors group-hover:text-foreground")}>
                  Click to zoom
                </span>
              </div>
            </button>
          </div>
        ) : null}
        {props.file.kind === "binary" ? (
          <PreviewStateCard
            icon={<BinaryIcon className="size-5" />}
            title="Binary file preview is unavailable"
            detail={`${props.file.mimeType} · ${formatPreviewBytes(props.file.byteSize)}`}
            actionLabel="Open in editor"
            onAction={() => props.onOpenFileInEditor(props.file.path)}
          />
        ) : null}
        {props.file.kind === "too-large" ? (
          <PreviewStateCard
            icon={
              props.file.previewKind === "image" ? (
                <FileImageIcon className="size-5" />
              ) : (
                <FileTextIcon className="size-5" />
              )
            }
            title="File is too large to preview"
            detail={`${props.file.mimeType} · ${formatPreviewBytes(props.file.byteSize)} · limit ${formatPreviewBytes(props.file.maxPreviewBytes)}`}
            actionLabel="Open in editor"
            onAction={() => props.onOpenFileInEditor(props.file.path)}
          />
        ) : null}
        {props.file.kind === "missing" ? (
          <PreviewStateCard
            icon={
              props.file.reason === "deleted" ? (
                <ImageIcon className="size-5" />
              ) : (
                <FileTextIcon className="size-5" />
              )
            }
            title={
              props.file.reason === "deleted" ? "File was deleted in this turn" : "File not found"
            }
            detail={props.file.path}
            actionLabel="Open in editor"
            onAction={() => props.onOpenFileInEditor(props.file.path)}
          />
        ) : null}
      </div>
    </div>
  );
}
