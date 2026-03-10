export type WorkspacePromotionState =
  | "seeded"
  | "draft"
  | "committed"
  | "needs-sync"
  | "syncing"
  | "conflicted"
  | "published"
  | "reviewing"
  | "ready";

export interface WorkspacePromotionStateInput {
  branch: string | null;
  targetBranch: string | null;
  isPrimaryWorkspace: boolean;
  hasWorkingTreeChanges: boolean;
  mergeInProgress: boolean;
  conflictedFiles: readonly string[];
  hasUpstream: boolean;
  aheadCount: number;
  behindCount: number;
  hasOpenPr: boolean;
}

export interface WorkspacePromotionStateResult {
  state: WorkspacePromotionState;
  label: string;
  nextAction: string;
  detail: string;
  guidanceTitle: string;
  guidanceBody: string;
}

export function deriveWorkspacePromotionState(
  input: WorkspacePromotionStateInput,
): WorkspacePromotionStateResult {
  if (input.conflictedFiles.length > 0) {
    return {
      state: "conflicted",
      label: "Conflicted",
      nextAction: "Resolve conflicts",
      detail: "Complete conflict resolution in this workspace before continuing.",
      guidanceTitle: "Conflict blocks promotion",
      guidanceBody:
        "Resolve the conflicted files in this workspace, then finish or abort the merge before publishing or merging.",
    };
  }

  if (!input.branch) {
    return {
      state: "seeded",
      label: "Detached",
      nextAction: "Checkout a branch",
      detail: "Promotion tracking starts after a branch is selected.",
      guidanceTitle: "Select a branch first",
      guidanceBody: "Checkout a branch before using promotion actions in this workspace.",
    };
  }

  if (input.mergeInProgress) {
    return {
      state: "syncing",
      label: "Syncing",
      nextAction: "Finish active merge",
      detail: "A merge is already in progress in this workspace.",
      guidanceTitle: "Finish the active merge",
      guidanceBody: "Complete or abort the active merge before committing, publishing, or starting another sync.",
    };
  }

  if (input.behindCount > 0) {
    return {
      state: "needs-sync",
      label: "Needs sync",
      nextAction: input.isPrimaryWorkspace ? "Pull latest" : "Sync from target",
      detail: input.targetBranch
        ? `Bring ${input.targetBranch} into this workspace before promotion.`
        : "Bring the target branch into this workspace before promotion.",
      guidanceTitle: "Sync before promotion",
      guidanceBody: input.targetBranch
        ? `Bring ${input.targetBranch} into this workspace before pushing, opening a PR, or merging.`
        : "Bring the target branch into this workspace before pushing, opening a PR, or merging.",
    };
  }

  if (input.hasWorkingTreeChanges && input.aheadCount === 0) {
    return {
      state: "draft",
      label: "Draft",
      nextAction: "Commit changes",
      detail: "Local edits exist only in this workspace.",
      guidanceTitle: "Shape the proposal",
      guidanceBody: "Keep editing until the change set is coherent, then commit it to promote the workspace beyond draft.",
    };
  }

  if (input.hasWorkingTreeChanges && input.aheadCount > 0) {
    return {
      state: "committed",
      label: "Committed",
      nextAction: "Finish the next commit",
      detail: "This workspace has committed progress plus new local edits.",
      guidanceTitle: "Complete the current round",
      guidanceBody: "Finish the new local edits, then commit again before publishing or merging this workspace.",
    };
  }

  if (input.hasOpenPr) {
    return {
      state: "reviewing",
      label: "Reviewing",
      nextAction: "Monitor review",
      detail: input.targetBranch
        ? `An open PR is carrying this branch toward ${input.targetBranch}.`
        : "An open PR is carrying this branch through review.",
      guidanceTitle: "Review is active",
      guidanceBody: "Track the open PR, respond to review, and sync again if the target branch moves.",
    };
  }

  if (input.hasUpstream && input.aheadCount > 0) {
    return {
      state: "published",
      label: "Published",
      nextAction: "Create PR",
      detail: "The branch is published and ready for review or merge.",
      guidanceTitle: "Promote to review",
      guidanceBody: "Open a PR or merge through your chosen review path so this workspace can move toward shared truth.",
    };
  }

  if (input.aheadCount > 0) {
    return {
      state: "ready",
      label: "Ready",
      nextAction: input.isPrimaryWorkspace ? "Push branch" : "Merge or publish",
      detail: input.targetBranch
        ? `This workspace is clean and ahead of ${input.targetBranch}.`
        : "This workspace is clean and ahead of its promotion target.",
      guidanceTitle: "Close the loop",
      guidanceBody: input.targetBranch
        ? `Merge into ${input.targetBranch} or publish a PR, then retire the workspace after shared truth is updated.`
        : "Publish or merge this branch, then retire the workspace after shared truth is updated.",
    };
  }

  return {
    state: "seeded",
    label: "Seeded",
    nextAction: input.isPrimaryWorkspace ? "Create dedicated workspace" : "Start editing",
    detail: input.targetBranch
      ? `No divergence from ${input.targetBranch} yet.`
      : "No promotion divergence yet.",
    guidanceTitle: "Begin the change",
    guidanceBody: input.isPrimaryWorkspace
      ? "Create a dedicated workspace when this thread needs isolated changes."
      : "Start editing in this workspace to begin a new promotion loop.",
  };
}
