import type { GitCreateWorktreeResult, GitStatusResult, ThreadId } from "@t3tools/contracts";
import { useCallback } from "react";
import { toastManager } from "~/components/ui/toast";
import { buildTemporaryWorktreeBranchName } from "~/gitWorktree";
import { readNativeApi } from "~/nativeApi";
import { discardDedicatedWorktree, releaseDedicatedWorktree } from "~/worktreeLifecycle";
import { formatWorktreePathForDisplay } from "~/worktreeCleanup";
import { buildPrimaryWorkspaceResolutionPrompt } from "./GitPanel.logic";

interface UseGitPanelWorkspaceActionsInput {
  clearActiveThreadTerminalState: () => void;
  activeServerThreadSessionStatus: string | null;
  activeThreadBranch: string | null;
  activeThreadId: ThreadId | null;
  activeWorkspaceBranch: string | null;
  deleteActiveThreadAfterTeardown: (input?: { navigateHome?: boolean }) => Promise<void>;
  focusDraftThread: (branch: string, worktreePath: string) => Promise<void>;
  focusPrimaryWorkspaceDraft: () => Promise<ThreadId | null>;
  invalidateQueries: () => Promise<void>;
  isPrimaryWorkspace: boolean;
  persistThreadWorkspaceContext: (
    branch: string | null,
    worktreePath: string | null,
  ) => Promise<void>;
  primaryWorkspaceStatus: GitStatusResult | null;
  repoCwd: string | null;
  repoRoot: string | null;
  removeWorktree: (input: { cwd: string; path: string; force: boolean }) => Promise<unknown>;
  repoWorkspaceCwd: string | null;
  createWorktree: (input: {
    cwd: string;
    branch: string;
    newBranch: string;
    path: string | null;
  }) => Promise<GitCreateWorktreeResult>;
  setPrompt: (threadId: ThreadId, prompt: string) => void;
  threadToastData: { threadId: ThreadId } | undefined;
}

export function useGitPanelWorkspaceActions({
  clearActiveThreadTerminalState,
  activeServerThreadSessionStatus,
  activeThreadBranch,
  activeThreadId,
  activeWorkspaceBranch,
  deleteActiveThreadAfterTeardown,
  focusDraftThread,
  focusPrimaryWorkspaceDraft,
  invalidateQueries,
  isPrimaryWorkspace,
  persistThreadWorkspaceContext,
  primaryWorkspaceStatus,
  repoCwd,
  repoRoot,
  removeWorktree,
  repoWorkspaceCwd,
  createWorktree,
  setPrompt,
  threadToastData,
}: UseGitPanelWorkspaceActionsInput) {
  const createDedicatedWorkspace = useCallback(async () => {
    if (!repoCwd || !activeWorkspaceBranch) {
      return;
    }

    try {
      const result = await createWorktree({
        cwd: repoCwd,
        branch: activeWorkspaceBranch,
        newBranch: buildTemporaryWorktreeBranchName(),
        path: null,
      });
      await focusDraftThread(result.worktree.branch, result.worktree.path);
      toastManager.add({
        type: "success",
        title: "Workspace created",
        description: formatWorktreePathForDisplay(result.worktree.path),
        data: threadToastData,
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Failed to create workspace",
        description: error instanceof Error ? error.message : "An error occurred.",
        data: threadToastData,
      });
    }
  }, [activeWorkspaceBranch, createWorktree, focusDraftThread, repoCwd, threadToastData]);

  const closeDedicatedWorkspace = useCallback(
    async (discardChanges: boolean) => {
      if (!repoWorkspaceCwd || isPrimaryWorkspace || !repoCwd || !repoRoot || !activeThreadId) {
        return;
      }

      const api = readNativeApi();
      if (!api) {
        toastManager.add({
          type: "error",
          title: "Workspace controls unavailable",
          data: threadToastData,
        });
        return;
      }

      if (discardChanges) {
        const confirmed = await api.dialogs.confirm(
          [
            "Discard this dedicated workspace?",
            formatWorktreePathForDisplay(repoWorkspaceCwd),
            "",
            "Uncommitted changes will be lost and this thread will be removed.",
            "Committed branch history will still be kept.",
          ].join("\n"),
        );
        if (!confirmed) {
          return;
        }
      }

      try {
        if (discardChanges) {
          await discardDedicatedWorktree({
            api,
            clearTerminalState: clearActiveThreadTerminalState,
            deleteThreadAfterTeardown: () =>
              deleteActiveThreadAfterTeardown({ navigateHome: false }),
            invalidateQueries,
            removeWorktree,
            repoCwd,
            sessionStatus: activeServerThreadSessionStatus,
            threadId: activeThreadId,
            worktreePath: repoWorkspaceCwd,
          });
          await focusPrimaryWorkspaceDraft();
          toastManager.add({
            type: "success",
            title: "Workspace discarded",
            description: "The dedicated workspace and thread were removed.",
            data: threadToastData,
          });
          return;
        }

        const releaseResult = await releaseDedicatedWorktree({
          api,
          clearTerminalState: clearActiveThreadTerminalState,
          desiredBranch: activeThreadBranch ?? activeWorkspaceBranch ?? null,
          invalidateQueries,
          persistThreadWorkspaceContext,
          removeWorktree,
          repoCwd,
          repoRoot,
          sessionStatus: activeServerThreadSessionStatus,
          threadId: activeThreadId,
          worktreePath: repoWorkspaceCwd,
        });
        toastManager.add({
          type:
            releaseResult.branchActivatedInPrimary || !activeThreadBranch ? "success" : "warning",
          title: "Workspace closed",
          description:
            releaseResult.branchActivatedInPrimary && releaseResult.nextPrimaryBranch
              ? `Branch ${releaseResult.nextPrimaryBranch} is active in the primary checkout.`
              : activeThreadBranch
                ? `Branch ${activeThreadBranch} was released. Clean the primary checkout before switching back to it.`
                : "The primary checkout is active again.",
          data: threadToastData,
        });
      } catch (error) {
        toastManager.add({
          type: "error",
          title: discardChanges ? "Failed to discard workspace" : "Failed to close workspace",
          description: error instanceof Error ? error.message : "An error occurred.",
          data: threadToastData,
        });
      }
    },
    [
      activeServerThreadSessionStatus,
      activeThreadBranch,
      activeThreadId,
      activeWorkspaceBranch,
      clearActiveThreadTerminalState,
      deleteActiveThreadAfterTeardown,
      focusPrimaryWorkspaceDraft,
      invalidateQueries,
      isPrimaryWorkspace,
      persistThreadWorkspaceContext,
      removeWorktree,
      repoCwd,
      repoRoot,
      repoWorkspaceCwd,
      threadToastData,
    ],
  );

  const openPrimaryWorkspaceResolutionDraft = useCallback(async () => {
    if (!repoRoot) {
      return;
    }
    const targetThreadId = await focusPrimaryWorkspaceDraft();
    if (!targetThreadId) {
      return;
    }
    setPrompt(
      targetThreadId,
      buildPrimaryWorkspaceResolutionPrompt({
        workspacePath: repoRoot,
        takeoverBranch: activeThreadBranch ?? activeWorkspaceBranch ?? null,
        conflictedFiles: primaryWorkspaceStatus?.merge?.conflictedFiles ?? [],
        changedFiles: primaryWorkspaceStatus?.workingTree.files.map((file) => file.path) ?? [],
      }),
    );
    toastManager.add({
      type: "success",
      title: "Primary checkout opened",
      description: "The composer is prefilled with the blocking checkout details.",
      data: threadToastData,
    });
  }, [
    activeThreadBranch,
    activeWorkspaceBranch,
    focusPrimaryWorkspaceDraft,
    primaryWorkspaceStatus?.merge?.conflictedFiles,
    primaryWorkspaceStatus?.workingTree.files,
    repoRoot,
    setPrompt,
    threadToastData,
  ]);

  return {
    closeDedicatedWorkspace,
    createDedicatedWorkspace,
    openPrimaryWorkspaceResolutionDraft,
  };
}
