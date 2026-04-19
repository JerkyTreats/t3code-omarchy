import type { GitFileStatus } from "@t3tools/contracts";

import { cn } from "~/lib/utils";

const STATUS_CLASSES = {
  modified: "bg-amber-400/40 dark:bg-amber-400/30",
  added: "bg-emerald-400/35 dark:bg-emerald-400/25",
  renamed: "bg-sky-400/35 dark:bg-sky-400/25",
  untracked: "bg-muted-foreground/25",
  conflicted: "bg-destructive/40",
  deleted: "bg-destructive/30",
} satisfies Record<GitFileStatus, string>;

export function ExplorerStatusPip(props: { status: GitFileStatus }) {
  return (
    <span
      aria-hidden="true"
      className={cn("ml-auto size-1.5 shrink-0 rounded-full", STATUS_CLASSES[props.status])}
    />
  );
}
