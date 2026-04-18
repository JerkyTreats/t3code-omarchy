import type { NativeApi, ThreadId } from "@t3tools/contracts";

import { newCommandId } from "./lib/utils";

interface StopThreadRuntimeInput {
  api: Pick<NativeApi, "orchestration" | "terminal">;
  clearTerminalState?: (() => void) | undefined;
  deleteTerminalHistory: boolean;
  sessionStatus: string | null;
  threadId: ThreadId;
}

export async function stopThreadRuntimeAndTerminal({
  api,
  clearTerminalState,
  deleteTerminalHistory,
  sessionStatus,
  threadId,
}: StopThreadRuntimeInput): Promise<void> {
  if (sessionStatus && sessionStatus !== "closed") {
    await api.orchestration
      .dispatchCommand({
        type: "thread.session.stop",
        commandId: newCommandId(),
        threadId,
        createdAt: new Date().toISOString(),
      })
      .catch(() => undefined);
  }

  try {
    await api.terminal.close({
      threadId,
      deleteHistory: deleteTerminalHistory,
    });
  } catch {
    // Terminal may already be closed or unavailable.
  }

  clearTerminalState?.();
}

interface ReleaseDedicatedWorktreeInput {
  api: Pick<NativeApi, "git" | "orchestration" | "terminal">;
  clearTerminalState?: (() => void) | undefined;
  desiredBranch: string | null;
  invalidateQueries: () => Promise<void>;
  persistThreadWorkspaceContext: (
    branch: string | null,
    worktreePath: string | null,
  ) => Promise<void>;
  removeWorktree: (input: { cwd: string; path: string; force: boolean }) => Promise<unknown>;
  repoCwd: string;
  repoRoot: string;
  sessionStatus: string | null;
  threadId: ThreadId;
  worktreePath: string;
}

export interface ReleaseDedicatedWorktreeResult {
  branchActivatedInPrimary: boolean;
  nextPrimaryBranch: string | null;
  nextThreadBranch: string | null;
}

export async function releaseDedicatedWorktree({
  api,
  clearTerminalState,
  desiredBranch,
  invalidateQueries,
  persistThreadWorkspaceContext,
  removeWorktree,
  repoCwd,
  repoRoot,
  sessionStatus,
  threadId,
  worktreePath,
}: ReleaseDedicatedWorktreeInput): Promise<ReleaseDedicatedWorktreeResult> {
  await stopThreadRuntimeAndTerminal({
    api,
    clearTerminalState,
    deleteTerminalHistory: false,
    sessionStatus,
    threadId,
  });

  await removeWorktree({
    cwd: repoCwd,
    path: worktreePath,
    force: false,
  });

  let nextPrimaryBranch = desiredBranch;
  let branchActivatedInPrimary = false;

  if (desiredBranch) {
    try {
      await api.git.checkout({ cwd: repoRoot, branch: desiredBranch });
      branchActivatedInPrimary = true;
    } catch {
      const fallbackPrimaryStatus = await api.git.status({ cwd: repoRoot }).catch(() => null);
      nextPrimaryBranch = fallbackPrimaryStatus?.branch ?? null;
    }
  }

  await invalidateQueries();
  await persistThreadWorkspaceContext(nextPrimaryBranch, null);

  return {
    branchActivatedInPrimary,
    nextPrimaryBranch,
    nextThreadBranch: nextPrimaryBranch,
  };
}

interface DiscardDedicatedWorktreeInput {
  api: Pick<NativeApi, "orchestration" | "terminal">;
  clearTerminalState?: (() => void) | undefined;
  deleteThreadAfterTeardown: () => Promise<void>;
  invalidateQueries: () => Promise<void>;
  removeWorktree: (input: { cwd: string; path: string; force: boolean }) => Promise<unknown>;
  repoCwd: string;
  sessionStatus: string | null;
  threadId: ThreadId;
  worktreePath: string;
}

export async function discardDedicatedWorktree({
  api,
  clearTerminalState,
  deleteThreadAfterTeardown,
  invalidateQueries,
  removeWorktree,
  repoCwd,
  sessionStatus,
  threadId,
  worktreePath,
}: DiscardDedicatedWorktreeInput): Promise<void> {
  await stopThreadRuntimeAndTerminal({
    api,
    clearTerminalState,
    deleteTerminalHistory: true,
    sessionStatus,
    threadId,
  });

  await removeWorktree({
    cwd: repoCwd,
    path: worktreePath,
    force: true,
  });

  await invalidateQueries();
  await deleteThreadAfterTeardown();
}
