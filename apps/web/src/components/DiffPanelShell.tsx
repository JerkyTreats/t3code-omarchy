import { Code2Icon } from "lucide-react";
import { type ReactNode } from "react";

import { isElectron } from "~/env";
import { cn } from "~/lib/utils";
import { useDiffPanelExpanded } from "./DiffPanelExpandedContext";

import { Skeleton } from "./ui/skeleton";

export type DiffPanelMode = "conversation" | "inline" | "sheet" | "sidebar";

function getDiffPanelHeaderRowClassName(mode: DiffPanelMode) {
  const shouldUseDragRegion = isElectron && mode !== "sheet";
  return cn(
    "flex items-center justify-between gap-2 px-4",
    shouldUseDragRegion ? "drag-region h-[52px] border-b border-border" : "h-12",
  );
}

function PanelTab(props: {
  onClick: () => void;
  ariaLabel: string;
  title: string;
  placement: "flush-left" | "outside-left";
}) {
  return (
    <button
      type="button"
      className={cn(
        "[-webkit-app-region:no-drag] absolute left-0 top-1/2 z-10 flex h-24 w-5 -translate-y-1/2 cursor-pointer items-center justify-center border border-border/70 bg-background/90 text-muted-foreground shadow-sm transition-colors hover:border-border hover:text-foreground",
        props.placement === "outside-left"
          ? "-translate-x-full rounded-l-md border-r-0"
          : "rounded-r-md border-l-0",
      )}
      onClick={props.onClick}
      aria-label={props.ariaLabel}
      title={props.title}
    >
      <Code2Icon className="size-3.5" />
    </button>
  );
}

export function DiffPanelShell(props: {
  mode: DiffPanelMode;
  header: ReactNode;
  children: ReactNode;
  showPanelTab?: boolean | undefined;
}) {
  const canExpand = props.mode === "sidebar" || props.mode === "inline";
  const isConversationMode = props.mode === "conversation";
  const shouldUseDragRegion = isElectron && props.mode !== "sheet";
  const { setPanelExpanded } = useDiffPanelExpanded();
  const showPanelTab = props.showPanelTab ?? true;

  const headerRow = (
    <div className={getDiffPanelHeaderRowClassName(props.mode)}>{props.header}</div>
  );

  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col",
        isConversationMode
          ? "h-full"
          : cn(
              "bg-background",
              "h-full",
              props.mode === "inline"
                ? "w-[42vw] min-w-[360px] max-w-[560px] shrink-0 border-l border-border"
                : "w-full",
            ),
      )}
    >
      {canExpand && showPanelTab ? (
        <PanelTab
          onClick={() => setPanelExpanded(true)}
          ariaLabel="Show preview in conversation view"
          title="Show in conversation view"
          placement="outside-left"
        />
      ) : null}
      {isConversationMode && showPanelTab ? (
        <PanelTab
          onClick={() => setPanelExpanded(false)}
          ariaLabel="Return preview to side panel"
          title="Return to side panel"
          placement="flush-left"
        />
      ) : null}

      {shouldUseDragRegion ? headerRow : <div className="border-b border-border">{headerRow}</div>}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {props.children}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent",
            isConversationMode ? "h-24 from-background" : "h-16 from-background",
          )}
        />
      </div>
    </div>
  );
}

export function DiffPanelHeaderSkeleton() {
  return (
    <>
      <div className="relative min-w-0 flex-1">
        <Skeleton className="absolute left-0 top-1/2 size-6 -translate-y-1/2 rounded-md border border-border/50" />
        <Skeleton className="absolute right-0 top-1/2 size-6 -translate-y-1/2 rounded-md border border-border/50" />
        <div className="flex gap-1 overflow-hidden px-8 py-0.5">
          <Skeleton className="h-6 w-16 shrink-0 rounded-md" />
          <Skeleton className="h-6 w-24 shrink-0 rounded-md" />
          <Skeleton className="h-6 w-24 shrink-0 rounded-md max-sm:hidden" />
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </>
  );
}

export function DiffPanelLoadingState(props: { label: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-2">
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/60 bg-card/25"
        role="status"
        aria-live="polite"
        aria-label={props.label}
      >
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="ml-auto h-4 w-20 rounded-full" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-3 py-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-10/12 rounded-full" />
            <Skeleton className="h-3 w-11/12 rounded-full" />
            <Skeleton className="h-3 w-9/12 rounded-full" />
          </div>
          <span className="sr-only">{props.label}</span>
        </div>
      </div>
    </div>
  );
}
