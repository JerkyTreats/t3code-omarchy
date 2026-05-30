import { describe, expect, it } from "vitest";
import { resolveMergeDisabledReason } from "./GitSyncSection.logic";

describe("GitSyncSection.logic", () => {
  it("blocks merge when no source branch is selected", () => {
    expect(
      resolveMergeDisabledReason({
        gitStatus: {
          hasWorkingTreeChanges: false,
        } as never,
        activeWorkspaceBranch: "feature/a",
        mergeSourceBranch: "",
        hasConflicts: false,
        mergeInProgress: false,
        isMerging: false,
      }),
    ).toBe("No branches to merge");
  });

  it("blocks merge while the workspace is dirty", () => {
    expect(
      resolveMergeDisabledReason({
        gitStatus: {
          hasWorkingTreeChanges: true,
        } as never,
        activeWorkspaceBranch: "feature/a",
        mergeSourceBranch: "main",
        hasConflicts: false,
        mergeInProgress: false,
        isMerging: false,
      }),
    ).toBe("Commit changes first");
  });

  it("allows merge when the workspace is stable", () => {
    expect(
      resolveMergeDisabledReason({
        gitStatus: {
          hasWorkingTreeChanges: false,
        } as never,
        activeWorkspaceBranch: "feature/a",
        mergeSourceBranch: "main",
        hasConflicts: false,
        mergeInProgress: false,
        isMerging: false,
      }),
    ).toBeNull();
  });
});
