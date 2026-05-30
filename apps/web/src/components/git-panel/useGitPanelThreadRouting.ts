import type { ProjectId, ScopedProjectRef, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import { useCallback } from "react";
import { newCommandId, newThreadId } from "~/lib/utils";
import { ensureEnvironmentApi } from "~/environmentApi";
import { resolveDraftEnvModeAfterBranchChange } from "../BranchToolbar.logic";

interface DraftThreadLookupResult {
  threadId: ThreadId;
  worktreePath: string | null;
}

interface DraftThreadContextInput {
  branch: string | null;
  worktreePath: string | null;
  envMode: "local" | "worktree";
}

interface UseGitPanelThreadRoutingInput {
  activeDraftThreadProjectId: ProjectId | null;
  activeDraftThreadWorktreePath: string | null;
  activeProjectId: ProjectId | null;
  activeProjectRef: ScopedProjectRef | null;
  activeServerThread: boolean;
  activeThreadId: ThreadId | null;
  activeThreadRef: ScopedThreadRef | null;
  activeThreadBranch: string | null;
  activeWorkspaceBranch: string | null;
  activeWorktreePath: string | null;
  effectiveEnvMode: "local" | "worktree";
  getDraftThreadByProjectRef: (projectRef: ScopedProjectRef) => DraftThreadLookupResult | null;
  hasServerThread: boolean;
  navigateToThread: (threadId: ThreadId) => Promise<void>;
  setDraftThreadContext: (threadRef: ScopedThreadRef, input: DraftThreadContextInput) => void;
  setProjectDraftThreadId: (
    projectRef: ScopedProjectRef,
    threadId: ThreadId,
    input: DraftThreadContextInput,
  ) => void;
  setThreadBranchAction: (
    threadRef: ScopedThreadRef,
    branch: string | null,
    worktreePath: string | null,
  ) => void;
}

export function useGitPanelThreadRouting({
  activeDraftThreadProjectId,
  activeDraftThreadWorktreePath,
  activeProjectId,
  activeProjectRef,
  activeServerThread,
  activeThreadId,
  activeThreadRef,
  activeThreadBranch,
  activeWorkspaceBranch,
  activeWorktreePath,
  effectiveEnvMode,
  getDraftThreadByProjectRef,
  hasServerThread,
  navigateToThread,
  setDraftThreadContext,
  setProjectDraftThreadId,
  setThreadBranchAction,
}: UseGitPanelThreadRoutingInput) {
  const focusDraftThread = useCallback(
    async (branch: string, worktreePath: string) => {
      if (!activeProjectId) {
        return;
      }

      if (
        !activeServerThread &&
        activeThreadRef &&
        activeThreadId &&
        activeDraftThreadProjectId === activeProjectId
      ) {
        setDraftThreadContext(activeThreadRef, {
          branch,
          worktreePath,
          envMode: "worktree",
        });
        return;
      }

      if (!activeProjectRef) return;
      const existingDraftThread = getDraftThreadByProjectRef(activeProjectRef);
      const targetThreadId = existingDraftThread?.threadId ?? newThreadId();
      setProjectDraftThreadId(activeProjectRef, targetThreadId, {
        branch,
        worktreePath,
        envMode: "worktree",
      });
      if (targetThreadId !== activeThreadId) {
        await navigateToThread(targetThreadId);
      }
    },
    [
      activeDraftThreadProjectId,
      activeProjectId,
      activeProjectRef,
      activeServerThread,
      activeThreadId,
      activeThreadRef,
      getDraftThreadByProjectRef,
      navigateToThread,
      setDraftThreadContext,
      setProjectDraftThreadId,
    ],
  );

  const focusPrimaryWorkspaceDraft = useCallback(async () => {
    if (!activeProjectId || !activeProjectRef) {
      return null;
    }

    const existingDraftThread = getDraftThreadByProjectRef(activeProjectRef);
    const canReuseActiveDraft =
      !activeServerThread &&
      activeThreadId !== null &&
      activeDraftThreadProjectId === activeProjectId &&
      activeDraftThreadWorktreePath === null;
    const targetThreadId = canReuseActiveDraft
      ? activeThreadId
      : existingDraftThread?.worktreePath === null
        ? existingDraftThread.threadId
        : newThreadId();

    if (!targetThreadId) {
      return null;
    }

    setProjectDraftThreadId(activeProjectRef, targetThreadId, {
      branch: activeThreadBranch ?? activeWorkspaceBranch ?? null,
      worktreePath: null,
      envMode: "local",
    });

    if (targetThreadId !== activeThreadId) {
      await navigateToThread(targetThreadId);
    }

    return targetThreadId;
  }, [
    activeDraftThreadProjectId,
    activeDraftThreadWorktreePath,
    activeProjectId,
    activeProjectRef,
    activeServerThread,
    activeThreadBranch,
    activeThreadId,
    activeWorkspaceBranch,
    getDraftThreadByProjectRef,
    navigateToThread,
    setProjectDraftThreadId,
  ]);

  const persistThreadWorkspaceContext = useCallback(
    async (branch: string | null, worktreePath: string | null) => {
      if (!activeThreadId || !activeThreadRef) {
        return;
      }

      const api = ensureEnvironmentApi(activeThreadRef.environmentId);
      if (hasServerThread) {
        await api.orchestration.dispatchCommand({
          type: "thread.meta.update",
          commandId: newCommandId(),
          threadId: activeThreadId,
          branch,
          worktreePath,
        });
      }

      if (hasServerThread) {
        setThreadBranchAction(activeThreadRef, branch, worktreePath);
        return;
      }

      const nextDraftEnvMode = resolveDraftEnvModeAfterBranchChange({
        nextWorktreePath: worktreePath,
        currentWorktreePath: activeWorktreePath,
        effectiveEnvMode,
      });
      setDraftThreadContext(activeThreadRef, {
        branch,
        worktreePath,
        envMode: nextDraftEnvMode,
      });
    },
    [
      activeThreadId,
      activeThreadRef,
      activeWorktreePath,
      effectiveEnvMode,
      hasServerThread,
      setDraftThreadContext,
      setThreadBranchAction,
    ],
  );

  return {
    focusDraftThread,
    focusPrimaryWorkspaceDraft,
    persistThreadWorkspaceContext,
  };
}
