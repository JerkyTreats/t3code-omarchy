import type { ThreadId } from "@t3tools/contracts";
import { FolderIcon, GitForkIcon } from "lucide-react";

import { useComposerDraftStore } from "../composerDraftStore";
import { useStore } from "../store";
import { resolveEffectiveEnvMode, type EnvMode } from "./BranchToolbar.logic";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "./ui/select";

const envModeItems = [
  { value: "local", label: "Local" },
  { value: "worktree", label: "New worktree" },
] as const;

interface ThreadEnvModeBadgeProps {
  threadId: ThreadId;
  envLocked: boolean;
  onEnvModeChange: (mode: EnvMode) => void;
}

export function ThreadEnvModeBadge({
  threadId,
  envLocked,
  onEnvModeChange,
}: ThreadEnvModeBadgeProps) {
  const threads = useStore((store) => store.threads);
  const draftThread = useComposerDraftStore((store) => store.getDraftThread(threadId));

  const serverThread = threads.find((thread) => thread.id === threadId);
  const activeWorktreePath = serverThread?.worktreePath ?? draftThread?.worktreePath ?? null;
  const hasServerThread = serverThread !== undefined;
  const effectiveEnvMode = resolveEffectiveEnvMode({
    activeWorktreePath,
    hasServerThread,
    draftThreadEnvMode: draftThread?.envMode,
  });

  if (envLocked || activeWorktreePath) {
    return (
      <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border/85 bg-background/96 px-3 text-foreground/90 text-xs font-medium shadow-sm backdrop-blur-md">
        {activeWorktreePath ? (
          <>
            <GitForkIcon className="size-3" />
            Worktree
          </>
        ) : (
          <>
            <FolderIcon className="size-3" />
            Local
          </>
        )}
      </span>
    );
  }

  return (
    <Select
      value={effectiveEnvMode}
      onValueChange={(value) => onEnvModeChange(value as EnvMode)}
      items={envModeItems}
    >
      <SelectTrigger
        size="xs"
        className="min-h-8 min-w-0 gap-1.5 rounded-full border-border/85 bg-background/96 px-3 text-foreground/90 text-xs font-medium shadow-sm backdrop-blur-md hover:border-border hover:bg-background hover:text-foreground [&_svg]:opacity-85"
      >
        {effectiveEnvMode === "worktree" ? (
          <GitForkIcon className="size-3" />
        ) : (
          <FolderIcon className="size-3" />
        )}
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        <SelectItem value="local">
          <span className="inline-flex items-center gap-1.5">
            <FolderIcon className="size-3" />
            Local
          </span>
        </SelectItem>
        <SelectItem value="worktree">
          <span className="inline-flex items-center gap-1.5">
            <GitForkIcon className="size-3" />
            New worktree
          </span>
        </SelectItem>
      </SelectPopup>
    </Select>
  );
}
