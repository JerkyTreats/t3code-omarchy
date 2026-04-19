import { type ReactNode } from "react";

import { cn } from "~/lib/utils";

export type DocumentShellVariant = "main" | "side-preview" | "explorer";

export function DocumentShell(props: {
  variant: DocumentShellVariant;
  header: ReactNode;
  children: ReactNode;
  panelTab?: ReactNode;
}) {
  return (
    <div className="relative flex h-full min-w-0 flex-col">
      {props.panelTab}
      <div className="border-b border-border">
        <div className="flex h-12 items-center justify-between gap-2 px-4">{props.header}</div>
      </div>
      <div className="document-viewport relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {props.children}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background to-transparent",
            props.variant === "main" ? "h-24" : "h-16",
          )}
        />
      </div>
    </div>
  );
}
