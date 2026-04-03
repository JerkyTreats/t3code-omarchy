import { describe, expect, it, vi } from "vitest";

import {
  assertNativeApiFeature,
  createRpcGitApi,
  createRpcGitHubApi,
  getNativeApiFeatureUnavailableMessage,
  supportsNativeApiGitHub,
  supportsNativeApiGitMerge,
  resolveNativeApiCapabilities,
} from "./forkNativeApiAdapter";

describe("forkNativeApiAdapter", () => {
  it("returns reduced capabilities for the upstream RPC transport", () => {
    const capabilities = resolveNativeApiCapabilities(false);

    expect(capabilities.git.runStackedAction).toBe(true);
    expect(capabilities.git.mergeBranches).toBe(true);
    expect(capabilities.git.repositoryContext).toBe(true);
    expect(capabilities.github.status).toBe(true);
  });

  it("describes fork-level support from the shared capability selectors", () => {
    const fullCapabilities = resolveNativeApiCapabilities(true);
    const rpcCapabilities = resolveNativeApiCapabilities(false);

    expect(supportsNativeApiGitMerge(fullCapabilities)).toBe(true);
    expect(supportsNativeApiGitHub(fullCapabilities)).toBe(true);
    expect(supportsNativeApiGitMerge(rpcCapabilities)).toBe(true);
    expect(supportsNativeApiGitHub(rpcCapabilities)).toBe(true);
  });

  it("throws typed errors with the shared unsupported message", () => {
    const capabilities = {
      ...resolveNativeApiCapabilities(false),
      github: {
        ...resolveNativeApiCapabilities(false).github,
        createIssue: false,
      },
    };

    expect(() => assertNativeApiFeature(capabilities, "github.createIssue")).toThrowError(
      getNativeApiFeatureUnavailableMessage("github.createIssue"),
    );
  });

  it("forwards merge support through the RPC git adapter", async () => {
    const mergeBranches = vi.fn().mockResolvedValue({
      status: "merged",
      sourceBranch: "feature",
      targetBranch: "main",
      targetWorktreePath: "/repo",
      conflictedFiles: [],
    });
    const git = createRpcGitApi({
      rpcClient: {
        git: {
          pull: vi.fn(),
          status: vi.fn(),
          runStackedAction: vi.fn(),
          listBranches: vi.fn(),
          createWorktree: vi.fn(),
          removeWorktree: vi.fn(),
          createBranch: vi.fn(),
          mergeBranches,
          abortMerge: vi.fn(),
          checkout: vi.fn(),
          init: vi.fn(),
          resolvePullRequest: vi.fn(),
          preparePullRequestThread: vi.fn(),
          repositoryContext: vi.fn(),
        },
      } as never,
      gitActionProgressListeners: new Set(),
    });

    await expect(
      git.mergeBranches({
        cwd: "/repo",
        sourceBranch: "feature",
        targetBranch: "main",
      }),
    ).resolves.toMatchObject({
      status: "merged",
    });
    expect(mergeBranches).toHaveBeenCalledWith({
      cwd: "/repo",
      sourceBranch: "feature",
      targetBranch: "main",
    });
  });

  it("forwards github status support through the RPC adapter", async () => {
    const status = vi.fn().mockResolvedValue({
      installed: true,
      authenticated: true,
      hostname: "github.com",
      accountLogin: "JerkyTreats",
      gitProtocol: "https",
      tokenSource: "keyring",
      scopes: ["repo"],
      repo: null,
    });
    const github = createRpcGitHubApi({
      github: {
        status,
        login: vi.fn(),
        listIssues: vi.fn(),
        createIssue: vi.fn(),
        closeIssue: vi.fn(),
        reopenIssue: vi.fn(),
      },
    } as never);

    await expect(
      github.status({
        cwd: "/repo",
        hostname: "github.com",
      }),
    ).resolves.toMatchObject({
      authenticated: true,
    });
    expect(status).toHaveBeenCalledWith({
      cwd: "/repo",
      hostname: "github.com",
    });
  });
});
