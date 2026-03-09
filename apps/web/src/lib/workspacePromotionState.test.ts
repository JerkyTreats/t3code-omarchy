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
        hasConflicts: true,
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
        hasConflicts: false,
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
        hasConflicts: false,
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
        hasConflicts: false,
        hasUpstream: true,
        aheadCount: 0,
        behindCount: 2,
        hasOpenPr: false,
      }).state,
    ).toBe("needs-sync");
  });
});
