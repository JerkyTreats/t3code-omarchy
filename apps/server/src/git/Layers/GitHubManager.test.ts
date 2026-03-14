import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { GitCommandError, GitHubCliError } from "../Errors.ts";
import { GitHubCli, type GitHubCliShape } from "../Services/GitHubCli.ts";
import { GitCore, type GitCoreShape } from "../Services/GitCore.ts";
import { GitHubManager } from "../Services/GitHubManager.ts";
import { GitHubManagerLive } from "./GitHubManager.ts";

function unexpectedGitHubCli(method: string): Effect.Effect<never, GitHubCliError> {
  return Effect.fail(
    new GitHubCliError({
      operation: "execute",
      detail: `Unexpected GitHubCli call: ${method}`,
    }),
  );
}

function unexpectedGitCore(method: string): Effect.Effect<never, GitCommandError> {
  return Effect.fail(
    new GitCommandError({
      operation: method,
      cwd: "/repo",
      command: "git",
      detail: `Unexpected GitCore call: ${method}`,
    }),
  );
}

function makeLayer(input?: { repoCalls?: string[]; issueCalls?: string[] }) {
  const gitHubCli: GitHubCliShape = {
    execute: () => unexpectedGitHubCli("execute"),
    listOpenPullRequests: () => unexpectedGitHubCli("listOpenPullRequests"),
    getPullRequest: () => unexpectedGitHubCli("getPullRequest"),
    getRepositoryCloneUrls: () => unexpectedGitHubCli("getRepositoryCloneUrls"),
    checkoutPullRequest: () => unexpectedGitHubCli("checkoutPullRequest"),
    createPullRequest: () => unexpectedGitHubCli("createPullRequest"),
    getDefaultBranch: () => unexpectedGitHubCli("getDefaultBranch"),
    getAuthStatus: () =>
      Effect.succeed({
        state: "success",
        active: true,
        host: "github.com",
        login: "tester",
        tokenSource: "keyring",
        scopes: ["repo"],
        gitProtocol: "https",
      }),
    loginWithBrowser: () => Effect.void,
    getRepository: (request) => {
      input?.repoCalls?.push(request.repo ?? "");
      return Effect.succeed({
        nameWithOwner: request.repo ?? "unknown/unknown",
        url: `https://github.com/${request.repo ?? "unknown/unknown"}`,
        description: null,
        defaultBranch: "main",
      });
    },
    listIssues: (request) => {
      input?.issueCalls?.push(request.repo ?? "");
      return Effect.succeed([]);
    },
    closeIssue: (request) =>
      Effect.succeed({
        number: request.issueNumber,
        state: "closed" as const,
      }),
    reopenIssue: (request) =>
      Effect.succeed({
        number: request.issueNumber,
        state: "open" as const,
      }),
  };

  const remoteUrls = new Map<string, string>([
    ["remote.upstream.url", "git@github.com:pingdotgg/t3code.git"],
    ["remote.origin.url", "git@github.com:JerkyTreats/t3code-omarchy.git"],
  ]);

  const gitCore = {
    readConfigValue: (_cwd: string, key: string) => Effect.succeed(remoteUrls.get(key) ?? null),
    status: () => unexpectedGitCore("status"),
    statusDetails: () => unexpectedGitCore("statusDetails"),
    prepareCommitContext: () => unexpectedGitCore("prepareCommitContext"),
    commit: () => unexpectedGitCore("commit"),
    pushCurrentBranch: () => unexpectedGitCore("pushCurrentBranch"),
    readRangeContext: () => unexpectedGitCore("readRangeContext"),
    getRepositoryContext: () => unexpectedGitCore("getRepositoryContext"),
    listBranches: () => unexpectedGitCore("listBranches"),
    pullCurrentBranch: () => unexpectedGitCore("pullCurrentBranch"),
    createWorktree: () => unexpectedGitCore("createWorktree"),
    fetchPullRequestBranch: () => unexpectedGitCore("fetchPullRequestBranch"),
    ensureRemote: () => unexpectedGitCore("ensureRemote"),
    fetchRemoteBranch: () => unexpectedGitCore("fetchRemoteBranch"),
    setBranchUpstream: () => unexpectedGitCore("setBranchUpstream"),
    removeWorktree: () => unexpectedGitCore("removeWorktree"),
    renameBranch: () => unexpectedGitCore("renameBranch"),
    deleteBranch: () => unexpectedGitCore("deleteBranch"),
    checkoutBranch: () => unexpectedGitCore("checkoutBranch"),
    createBranch: () => unexpectedGitCore("createBranch"),
    listLocalBranchNames: () => unexpectedGitCore("listLocalBranchNames"),
    mergeBranches: () => unexpectedGitCore("mergeBranches"),
    abortMerge: () => unexpectedGitCore("abortMerge"),
    initRepo: () => unexpectedGitCore("initRepo"),
  } as unknown as GitCoreShape;

  return GitHubManagerLive.pipe(
    Layer.provideMerge(Layer.succeed(GitHubCli, gitHubCli)),
    Layer.provideMerge(Layer.succeed(GitCore, gitCore)),
  );
}

function runManager<A>(
  layer: Layer.Layer<GitHubManager>,
  effectFn: (manager: ReturnType<typeof GitHubManager.of>) => Effect.Effect<A, GitHubCliError>,
) {
  return Effect.runPromise(
    Effect.gen(function* () {
      const manager = yield* GitHubManager;
      return yield* effectFn(manager);
    }).pipe(Effect.provide(layer)),
  );
}

describe("GitHubManager", () => {
  it("prefers the upstream repo for status metadata", async () => {
    const repoCalls: string[] = [];
    const result = await runManager(makeLayer({ repoCalls }), (manager) =>
      manager.status({ cwd: "/repo", hostname: "github.com" }),
    );

    expect(result.repo?.nameWithOwner).toBe("pingdotgg/t3code");
    expect(result.repo?.url).toBe("https://github.com/pingdotgg/t3code");
    expect(repoCalls).toEqual(["pingdotgg/t3code"]);
  });

  it("prefers the upstream repo for issue lookups", async () => {
    const repoCalls: string[] = [];
    const issueCalls: string[] = [];
    const result = await runManager(makeLayer({ repoCalls, issueCalls }), (manager) =>
      manager.listIssues({ cwd: "/repo", state: "open", limit: 10 }),
    );

    expect(result.repo?.nameWithOwner).toBe("pingdotgg/t3code");
    expect(repoCalls).toEqual(["pingdotgg/t3code"]);
    expect(issueCalls).toEqual(["pingdotgg/t3code"]);
  });
});
