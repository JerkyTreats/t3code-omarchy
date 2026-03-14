import type {
  GitHubIssueLink,
  GitRunStackedActionResult,
  GitStackedAction,
  GitStatusResult,
  ThreadId,
} from "@t3tools/contracts";
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { toastManager } from "~/components/ui/toast";
import { readNativeApi } from "~/nativeApi";
import {
  buildGitActionProgressStages,
  type DefaultBranchConfirmableAction,
  requiresDefaultBranchConfirmation,
  summarizeGitResult,
} from "../GitActionsControl.logic";

export interface PendingDefaultBranchAction {
  action: DefaultBranchConfirmableAction;
  branchName: string;
  includesCommit: boolean;
  commitMessage?: string;
  forcePushOnlyProgress: boolean;
  issueLink?: GitHubIssueLink | null;
  onConfirmed?: () => void;
}

type GitActionToastId = ReturnType<typeof toastManager.add>;

interface RunGitActionWithToastInput {
  action: GitStackedAction;
  commitMessage?: string;
  forcePushOnlyProgress?: boolean;
  onConfirmed?: () => void;
  skipDefaultBranchPrompt?: boolean;
  statusOverride?: GitStatusResult | null;
  featureBranch?: boolean;
  isDefaultBranchOverride?: boolean;
  progressToastId?: GitActionToastId;
  targetBranch?: string;
  issueLink?: GitHubIssueLink | null;
}

interface UseGitPanelStackedActionsInput {
  gitStatusForActions: GitStatusResult | null;
  isDefaultBranch: boolean;
  issueLink: GitHubIssueLink | null;
  onCloseIssue?: (issueLink: GitHubIssueLink) => Promise<void>;
  pendingDefaultBranchAction: PendingDefaultBranchAction | null;
  runImmediateGitAction: (input: {
    action: GitStackedAction;
    commitMessage?: string;
    featureBranch?: boolean;
    targetBranch?: string;
    issueLink?: GitHubIssueLink | null;
  }) => Promise<GitRunStackedActionResult>;
  setPendingDefaultBranchAction: Dispatch<SetStateAction<PendingDefaultBranchAction | null>>;
  threadToastData: { threadId: ThreadId } | undefined;
}

export function useGitPanelStackedActions({
  gitStatusForActions,
  isDefaultBranch,
  issueLink,
  onCloseIssue,
  pendingDefaultBranchAction,
  runImmediateGitAction,
  setPendingDefaultBranchAction,
  threadToastData,
}: UseGitPanelStackedActionsInput) {
  const runGitActionWithToast = useCallback(
    async ({
      action,
      commitMessage,
      forcePushOnlyProgress = false,
      onConfirmed,
      skipDefaultBranchPrompt = false,
      statusOverride,
      featureBranch = false,
      isDefaultBranchOverride,
      progressToastId,
      targetBranch,
      issueLink: issueLinkOverride,
    }: RunGitActionWithToastInput) => {
      const actionStatus = statusOverride ?? gitStatusForActions;
      const actionBranch = actionStatus?.branch ?? null;
      const resolvedIssueLink = issueLinkOverride ?? issueLink;
      const actionIsDefaultBranch =
        isDefaultBranchOverride ?? (featureBranch ? false : isDefaultBranch);
      const includesCommit =
        !forcePushOnlyProgress && (action === "commit" || !!actionStatus?.hasWorkingTreeChanges);
      if (
        !skipDefaultBranchPrompt &&
        requiresDefaultBranchConfirmation(action, actionIsDefaultBranch) &&
        actionBranch
      ) {
        if (action !== "commit_push" && action !== "commit_push_pr") {
          return;
        }
        setPendingDefaultBranchAction({
          action,
          branchName: actionBranch,
          includesCommit,
          ...(commitMessage ? { commitMessage } : {}),
          forcePushOnlyProgress,
          ...(resolvedIssueLink ? { issueLink: resolvedIssueLink } : {}),
          ...(onConfirmed ? { onConfirmed } : {}),
        });
        return;
      }
      onConfirmed?.();

      const progressStages = buildGitActionProgressStages({
        action,
        hasCustomCommitMessage: !!commitMessage?.trim(),
        hasWorkingTreeChanges: !!actionStatus?.hasWorkingTreeChanges,
        forcePushOnly: forcePushOnlyProgress,
        featureBranch,
        ...(targetBranch ? { targetBranch } : {}),
      });
      const resolvedProgressToastId =
        progressToastId ??
        toastManager.add({
          type: "loading",
          title: progressStages[0] ?? "Running...",
          timeout: 0,
          data: threadToastData,
        });

      if (progressToastId) {
        toastManager.update(progressToastId, {
          type: "loading",
          title: progressStages[0] ?? "Running...",
          timeout: 0,
          data: threadToastData,
        });
      }

      let stageIndex = 0;
      const stageInterval = setInterval(() => {
        stageIndex = Math.min(stageIndex + 1, progressStages.length - 1);
        toastManager.update(resolvedProgressToastId, {
          title: progressStages[stageIndex] ?? "Running...",
          type: "loading",
          timeout: 0,
          data: threadToastData,
        });
      }, 1100);

      const stopProgressUpdates = () => {
        clearInterval(stageInterval);
      };

      try {
        const result = await runImmediateGitAction({
          action,
          ...(commitMessage ? { commitMessage } : {}),
          ...(featureBranch ? { featureBranch } : {}),
          ...(targetBranch ? { targetBranch } : {}),
          ...(resolvedIssueLink ? { issueLink: resolvedIssueLink } : {}),
        });
        stopProgressUpdates();
        const resultToast = summarizeGitResult(result);

        const existingOpenPrUrl =
          actionStatus?.pr?.state === "open" ? actionStatus.pr.url : undefined;
        const prUrl = result.pr.url ?? existingOpenPrUrl;
        const shouldOfferPushCta = action === "commit" && result.commit.status === "created";
        const shouldOfferOpenPrCta =
          (action === "commit_push" || action === "commit_push_pr") &&
          !!prUrl &&
          (!actionIsDefaultBranch ||
            result.pr.status === "created" ||
            result.pr.status === "opened_existing");
        const shouldOfferCreatePrCta =
          action === "commit_push" &&
          !prUrl &&
          result.push.status === "pushed" &&
          !actionIsDefaultBranch;
        const shouldOfferCloseIssueCta =
          result.promote.status === "promoted" &&
          !!resolvedIssueLink &&
          resolvedIssueLink.state === "open" &&
          actionStatus?.pr?.state !== "open" &&
          !!onCloseIssue;
        const closeResultToast = () => {
          toastManager.close(resolvedProgressToastId);
        };

        toastManager.update(resolvedProgressToastId, {
          type: "success",
          title: resultToast.title,
          description: resultToast.description,
          timeout: 0,
          data: {
            ...threadToastData,
            dismissAfterVisibleMs: 10_000,
          },
          ...(shouldOfferCloseIssueCta
            ? {
                actionProps: {
                  children: "Close issue",
                  onClick: () => {
                    if (!resolvedIssueLink || !onCloseIssue) return;
                    closeResultToast();
                    void onCloseIssue(resolvedIssueLink);
                  },
                },
              }
            : shouldOfferPushCta
              ? {
                  actionProps: {
                    children: "Push",
                    onClick: () => {
                      void runGitActionWithToast({
                        action: "commit_push",
                        forcePushOnlyProgress: true,
                        onConfirmed: closeResultToast,
                        statusOverride: actionStatus,
                        isDefaultBranchOverride: actionIsDefaultBranch,
                        ...(resolvedIssueLink ? { issueLink: resolvedIssueLink } : {}),
                      });
                    },
                  },
                }
              : shouldOfferOpenPrCta
                ? {
                    actionProps: {
                      children: "Open PR",
                      onClick: () => {
                        const api = readNativeApi();
                        if (!api) return;
                        closeResultToast();
                        void api.shell.openExternal(prUrl);
                      },
                    },
                  }
                : shouldOfferCreatePrCta
                  ? {
                      actionProps: {
                        children: "Create PR",
                        onClick: () => {
                          closeResultToast();
                          void runGitActionWithToast({
                            action: "commit_push_pr",
                            forcePushOnlyProgress: true,
                            statusOverride: actionStatus,
                            isDefaultBranchOverride: actionIsDefaultBranch,
                            ...(resolvedIssueLink ? { issueLink: resolvedIssueLink } : {}),
                          });
                        },
                      },
                    }
                  : {}),
        });
      } catch (err) {
        stopProgressUpdates();
        toastManager.update(resolvedProgressToastId, {
          type: "error",
          title: "Action failed",
          description: err instanceof Error ? err.message : "An error occurred.",
          data: threadToastData,
        });
      }
    },
    [
      gitStatusForActions,
      isDefaultBranch,
      issueLink,
      onCloseIssue,
      runImmediateGitAction,
      setPendingDefaultBranchAction,
      threadToastData,
    ],
  );

  const continuePendingDefaultBranchAction = useCallback(() => {
    if (!pendingDefaultBranchAction) return;
    const { action, commitMessage, forcePushOnlyProgress, issueLink, onConfirmed } =
      pendingDefaultBranchAction;
    setPendingDefaultBranchAction(null);
    void runGitActionWithToast({
      action,
      ...(commitMessage ? { commitMessage } : {}),
      forcePushOnlyProgress,
      ...(issueLink ? { issueLink } : {}),
      ...(onConfirmed ? { onConfirmed } : {}),
      skipDefaultBranchPrompt: true,
    });
  }, [pendingDefaultBranchAction, runGitActionWithToast, setPendingDefaultBranchAction]);

  const checkoutNewBranchAndRunAction = useCallback(
    (actionParams: {
      action: GitStackedAction;
      commitMessage?: string;
      forcePushOnlyProgress?: boolean;
      issueLink?: GitHubIssueLink | null;
      onConfirmed?: () => void;
    }) => {
      void runGitActionWithToast({
        ...actionParams,
        featureBranch: true,
        skipDefaultBranchPrompt: true,
      });
    },
    [runGitActionWithToast],
  );

  const checkoutFeatureBranchAndContinuePendingAction = useCallback(() => {
    if (!pendingDefaultBranchAction) return;
    const { action, commitMessage, forcePushOnlyProgress, issueLink, onConfirmed } =
      pendingDefaultBranchAction;
    setPendingDefaultBranchAction(null);
    checkoutNewBranchAndRunAction({
      action,
      ...(commitMessage ? { commitMessage } : {}),
      forcePushOnlyProgress,
      ...(issueLink ? { issueLink } : {}),
      ...(onConfirmed ? { onConfirmed } : {}),
    });
  }, [checkoutNewBranchAndRunAction, pendingDefaultBranchAction, setPendingDefaultBranchAction]);

  return {
    checkoutFeatureBranchAndContinuePendingAction,
    checkoutNewBranchAndRunAction,
    continuePendingDefaultBranchAction,
    runGitActionWithToast,
  };
}
