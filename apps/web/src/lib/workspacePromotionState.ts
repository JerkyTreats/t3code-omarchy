export type WorkspacePromotionState =
  | "seeded"
  | "draft"
  | "committed"
  | "needs-sync"
  | "conflicted"
  | "published"
  | "reviewing"
  | "ready";

export interface WorkspacePromotionStateInput {
  branch: string | null;
  targetBranch: string | null;
  isPrimaryWorkspace: boolean;
  hasWorkingTreeChanges: boolean;
  hasConflicts: boolean;
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
}

export function deriveWorkspacePromotionState(
  input: WorkspacePromotionStateInput,
): WorkspacePromotionStateResult {
  if (input.hasConflicts) {
    return {
      state: "conflicted",
      label: "Conflicted",
      nextAction: "Resolve conflicts",
      detail: "Complete conflict resolution in this workspace before continuing.",
    };
  }

  if (!input.branch) {
    return {
      state: "seeded",
      label: "Detached",
      nextAction: "Checkout a branch",
      detail: "Promotion tracking starts after a branch is selected.",
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
    };
  }

  if (input.hasWorkingTreeChanges && input.aheadCount === 0) {
    return {
      state: "draft",
      label: "Draft",
      nextAction: "Commit changes",
      detail: "Local edits exist only in this workspace.",
    };
  }

  if (input.hasWorkingTreeChanges && input.aheadCount > 0) {
    return {
      state: "committed",
      label: "Committed",
      nextAction: "Finish the next commit",
      detail: "This workspace has committed progress plus new local edits.",
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
    };
  }

  if (input.hasUpstream && input.aheadCount > 0) {
    return {
      state: "published",
      label: "Published",
      nextAction: "Create PR",
      detail: "The branch is published and ready for review or merge.",
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
    };
  }

  return {
    state: "seeded",
    label: "Seeded",
    nextAction: input.isPrimaryWorkspace ? "Create dedicated workspace" : "Start editing",
    detail: input.targetBranch
      ? `No divergence from ${input.targetBranch} yet.`
      : "No promotion divergence yet.",
  };
}
