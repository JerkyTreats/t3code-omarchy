import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";

interface ProjectPanelProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  header?: ReactNode;
  variant?: "page" | "sidepanel";
}

export function ProjectPanel({
  children,
  className,
  contentClassName,
  header,
  variant = "page",
}: ProjectPanelProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden",
        variant === "page"
          ? "min-h-[42rem] border-border bg-card"
          : "h-full min-h-0 rounded-none border-0 bg-transparent shadow-none before:hidden",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-full min-h-0 flex-col text-foreground",
          variant === "page" ? "bg-card" : "bg-transparent",
        )}
      >
        {header ? <div className="shrink-0">{header}</div> : null}
        <ScrollArea className="min-h-0 flex-1">
          <div className={cn("space-y-4 p-4", contentClassName)}>{children}</div>
        </ScrollArea>
      </div>
    </Card>
  );
}
