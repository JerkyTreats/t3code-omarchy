import { describe, expect, it } from "vitest";

import { deriveWorkspacePromotionState } from "./workspacePromotionState";

describe("deriveWorkspacePromotionState", () => {
  it("returns conflicted when merge conflicts are present", () => {
    expect(
      deriveWorkspacePromotionState({
        branch: "feature/a",
        targetBranch: "main",
        isPrimaryWorkspace: false,
        hasWorkingTreeChanges: true,
        mergeInProgress: true,
        conflictedFiles: ["README.md"],
        hasUpstream: false,
        aheadCount: 2,
        behindCount: 1,
        hasOpenPr: false,
      }).state,
    ).toBe("conflicted");
  });

  it("returns draft for local edits with no branch divergence", () => {
    expect(
      deriveWorkspacePromotionState({
        branch: "feature/a",
        targetBranch: "main",
        isPrimaryWorkspace: false,
        hasWorkingTreeChanges: true,
        mergeInProgress: false,
        conflictedFiles: [],
        hasUpstream: false,
        aheadCount: 0,
        behindCount: 0,
        hasOpenPr: false,
      }).state,
    ).toBe("draft");
  });

  it("returns reviewing for a clean branch with an open PR", () => {
    expect(
      deriveWorkspacePromotionState({
        branch: "feature/a",
        targetBranch: "main",
        isPrimaryWorkspace: false,
        hasWorkingTreeChanges: false,
        mergeInProgress: false,
        conflictedFiles: [],
        hasUpstream: true,
        aheadCount: 3,
        behindCount: 0,
        hasOpenPr: true,
      }).state,
    ).toBe("reviewing");
  });

  it("returns needs-sync when the branch is behind", () => {
    expect(
      deriveWorkspacePromotionState({
        branch: "feature/a",
        targetBranch: "main",
        isPrimaryWorkspace: false,
        hasWorkingTreeChanges: false,
        mergeInProgress: false,
        conflictedFiles: [],
        hasUpstream: true,
        aheadCount: 0,
        behindCount: 2,
        hasOpenPr: false,
      }).state,
    ).toBe("needs-sync");
  });

  it("returns syncing when a merge is in progress without conflicts", () => {
    expect(
      deriveWorkspacePromotionState({
        branch: "feature/a",
        targetBranch: "main",
        isPrimaryWorkspace: false,
        hasWorkingTreeChanges: true,
        mergeInProgress: true,
        conflictedFiles: [],
        hasUpstream: true,
        aheadCount: 1,
        behindCount: 0,
        hasOpenPr: false,
      }).state,
    ).toBe("syncing");
  });
});
