import { describe, expect, it } from "vitest";
import {
  resolveCreateWorktreeDisabledReason,
  resolvePrimaryWorkspaceNeedsAttention,
  resolveSyncFromTargetDisabledReason,
} from "./GitWorkspaceSection.logic";

describe("GitWorkspaceSection.logic", () => {
  describe("resolveCreateWorktreeDisabledReason", () => {
    it("returns null for non primary workspaces", () => {
      expect(
        resolveCreateWorktreeDisabledReason({
          isPrimaryWorkspace: false,
          activeProjectId: null,
          gitStatus: null,
          repoCwd: null,
          activeWorkspaceBranch: null,
          isCreating: false,
        }),
      ).toBeNull();
    });

    it("requires a clean checked out branch before creating", () => {
      expect(
        resolveCreateWorktreeDisabledReason({
          isPrimaryWorkspace: true,
          activeProjectId: "project-1",
          gitStatus: {
            hasWorkingTreeChanges: true,
          } as never,
          repoCwd: "/repo",
          activeWorkspaceBranch: "feature/a",
          isCreating: false,
        }),
      ).toBe("Commit changes first");
    });
  });

  describe("resolveSyncFromTargetDisabledReason", () => {
    it("blocks when the target is already active", () => {
      expect(
        resolveSyncFromTargetDisabledReason({
          activeTargetBranch: "main",
          activeWorkspaceBranch: "main",
          gitStatus: {
            hasWorkingTreeChanges: false,
          } as never,
          hasConflicts: false,
          mergeInProgress: false,
          isMerging: false,
        }),
      ).toBe("Already on target branch");
    });

    it("allows sync when the workspace is stable", () => {
      expect(
        resolveSyncFromTargetDisabledReason({
          activeTargetBranch: "main",
          activeWorkspaceBranch: "feature/a",
          gitStatus: {
            hasWorkingTreeChanges: false,
          } as never,
          hasConflicts: false,
          mergeInProgress: false,
          isMerging: false,
        }),
      ).toBeNull();
    });
  });

  describe("resolvePrimaryWorkspaceNeedsAttention", () => {
    it("flags merge conflicts", () => {
      expect(
        resolvePrimaryWorkspaceNeedsAttention({
          merge: {
            conflictedFiles: ["src/app.ts"],
            inProgress: false,
          },
          hasWorkingTreeChanges: false,
        } as never),
      ).toBe(true);
    });

    it("returns false for a clean primary workspace", () => {
      expect(
        resolvePrimaryWorkspaceNeedsAttention({
          merge: {
            conflictedFiles: [],
            inProgress: false,
          },
          hasWorkingTreeChanges: false,
        } as never),
      ).toBe(false);
    });
  });
});
