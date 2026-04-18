import type { NativeApi } from "@t3tools/contracts";
import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  discardDedicatedWorktree,
  releaseDedicatedWorktree,
  stopThreadRuntimeAndTerminal,
} from "./worktreeLifecycle";

const THREAD_ID = ThreadId.makeUnsafe("thread-1");

function createApiMock(): Pick<NativeApi, "git" | "orchestration" | "terminal"> {
  return {
    git: {
      checkout: vi.fn(async () => undefined),
      status: vi.fn(async () => ({ branch: "main" })),
    },
    orchestration: {
      dispatchCommand: vi.fn(async () => ({ sequence: 1 })),
    },
    terminal: {
      close: vi.fn(async () => undefined),
    },
  } as unknown as Pick<NativeApi, "git" | "orchestration" | "terminal">;
}

describe("worktreeLifecycle", () => {
  it("stops the thread session and closes the terminal", async () => {
    const api = createApiMock();
    const clearTerminalState = vi.fn();

    await stopThreadRuntimeAndTerminal({
      api,
      clearTerminalState,
      deleteTerminalHistory: true,
      sessionStatus: "running",
      threadId: THREAD_ID,
    });

    expect(api.orchestration.dispatchCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "thread.session.stop",
        threadId: THREAD_ID,
      }),
    );
    expect(api.terminal.close).toHaveBeenCalledWith({
      threadId: THREAD_ID,
      deleteHistory: true,
    });
    expect(clearTerminalState).toHaveBeenCalledTimes(1);
  });

  it("releases a dedicated worktree into the primary checkout", async () => {
    const api = createApiMock();
    const invalidateQueries = vi.fn(async () => undefined);
    const persistThreadWorkspaceContext = vi.fn(async () => undefined);
    const removeWorktree = vi.fn(async () => undefined);

    const result = await releaseDedicatedWorktree({
      api,
      desiredBranch: "feature/issue-123",
      invalidateQueries,
      persistThreadWorkspaceContext,
      removeWorktree,
      repoCwd: "/repo",
      repoRoot: "/repo",
      sessionStatus: "running",
      threadId: THREAD_ID,
      worktreePath: "/repo/.worktrees/issue-123",
    });

    expect(removeWorktree).toHaveBeenCalledWith({
      cwd: "/repo",
      path: "/repo/.worktrees/issue-123",
      force: false,
    });
    expect(api.git.checkout).toHaveBeenCalledWith({
      cwd: "/repo",
      branch: "feature/issue-123",
    });
    expect(persistThreadWorkspaceContext).toHaveBeenCalledWith("feature/issue-123", null);
    expect(result).toEqual({
      branchActivatedInPrimary: true,
      nextPrimaryBranch: "feature/issue-123",
      nextThreadBranch: "feature/issue-123",
    });
  });

  it("falls back to the active primary branch when release cannot switch branches", async () => {
    const api = createApiMock();
    vi.mocked(api.git.checkout).mockRejectedValueOnce(new Error("dirty primary"));
    const persistThreadWorkspaceContext = vi.fn(async () => undefined);

    const result = await releaseDedicatedWorktree({
      api,
      desiredBranch: "feature/issue-123",
      invalidateQueries: vi.fn(async () => undefined),
      persistThreadWorkspaceContext,
      removeWorktree: vi.fn(async () => undefined),
      repoCwd: "/repo",
      repoRoot: "/repo",
      sessionStatus: null,
      threadId: THREAD_ID,
      worktreePath: "/repo/.worktrees/issue-123",
    });

    expect(api.git.status).toHaveBeenCalledWith({ cwd: "/repo" });
    expect(persistThreadWorkspaceContext).toHaveBeenCalledWith("main", null);
    expect(result).toEqual({
      branchActivatedInPrimary: false,
      nextPrimaryBranch: "main",
      nextThreadBranch: "main",
    });
  });

  it("discards a dedicated worktree and deletes the thread", async () => {
    const api = createApiMock();
    const removeWorktree = vi.fn(async () => undefined);
    const deleteThreadAfterTeardown = vi.fn(async () => undefined);

    await discardDedicatedWorktree({
      api,
      deleteThreadAfterTeardown,
      invalidateQueries: vi.fn(async () => undefined),
      removeWorktree,
      repoCwd: "/repo",
      sessionStatus: "running",
      threadId: THREAD_ID,
      worktreePath: "/repo/.worktrees/issue-123",
    });

    expect(removeWorktree).toHaveBeenCalledWith({
      cwd: "/repo",
      path: "/repo/.worktrees/issue-123",
      force: true,
    });
    expect(deleteThreadAfterTeardown).toHaveBeenCalledTimes(1);
  });
});
