import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach, expect, vi } from "vitest";

vi.mock("../../processRunner", () => ({
  runProcess: vi.fn(),
}));

import { runProcess } from "../../processRunner";
import { GitHubCli } from "../Services/GitHubCli.ts";
import { GitHubCliLive } from "./GitHubCli.ts";

const mockedRunProcess = vi.mocked(runProcess);
const layer = it.layer(GitHubCliLive);

function mockForkRemoteResolution(options?: {
  branch?: string;
  branchPushRemote?: string;
  remotePushDefault?: string;
  remotes?: string;
  remoteUrl?: string;
}) {
  mockedRunProcess
    .mockResolvedValueOnce({
      stdout: `${options?.branch ?? "main"}\n`,
      stderr: "",
      code: 0,
      signal: null,
      timedOut: false,
    })
    .mockResolvedValueOnce({
      stdout: options?.branchPushRemote ? `${options.branchPushRemote}\n` : "",
      stderr: "",
      code: 0,
      signal: null,
      timedOut: false,
    })
    .mockResolvedValueOnce({
      stdout: options?.remotePushDefault ? `${options.remotePushDefault}\n` : "",
      stderr: "",
      code: 0,
      signal: null,
      timedOut: false,
    })
    .mockResolvedValueOnce({
      stdout: options?.remotes ?? "origin\nupstream\n",
      stderr: "",
      code: 0,
      signal: null,
      timedOut: false,
    })
    .mockResolvedValueOnce({
      stdout: options?.remoteUrl ?? "https://github.com/JerkyTreats/t3code-omarchy.git\n",
      stderr: "",
      code: 0,
      signal: null,
      timedOut: false,
    });
}

afterEach(() => {
  mockedRunProcess.mockReset();
});

layer("GitHubCliLive", (it) => {
  it.effect("parses pull request view output", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify({
          number: 42,
          title: "Add PR thread creation",
          url: "https://github.com/pingdotgg/codething-mvp/pull/42",
          baseRefName: "main",
          headRefName: "feature/pr-threads",
          state: "OPEN",
          mergedAt: null,
          isCrossRepository: true,
          headRepository: {
            nameWithOwner: "octocat/codething-mvp",
          },
          headRepositoryOwner: {
            login: "octocat",
          },
        }),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.getPullRequest({
          cwd: "/repo",
          reference: "#42",
        });
      });

      assert.deepStrictEqual(result, {
        number: 42,
        title: "Add PR thread creation",
        url: "https://github.com/pingdotgg/codething-mvp/pull/42",
        baseRefName: "main",
        headRefName: "feature/pr-threads",
        state: "open",
        isCrossRepository: true,
        headRepositoryNameWithOwner: "octocat/codething-mvp",
        headRepositoryOwnerLogin: "octocat",
      });
      expect(mockedRunProcess).toHaveBeenCalledWith(
        "gh",
        [
          "pr",
          "view",
          "#42",
          "--json",
          "number,title,url,baseRefName,headRefName,state,mergedAt,isCrossRepository,headRepository,headRepositoryOwner",
        ],
        expect.objectContaining({ cwd: "/repo" }),
      );
    }),
  );

  it.effect("reads repository clone URLs", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify({
          nameWithOwner: "octocat/codething-mvp",
          url: "https://github.com/octocat/codething-mvp",
          sshUrl: "git@github.com:octocat/codething-mvp.git",
        }),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.getRepositoryCloneUrls({
          cwd: "/repo",
          repository: "octocat/codething-mvp",
        });
      });

      assert.deepStrictEqual(result, {
        nameWithOwner: "octocat/codething-mvp",
        url: "https://github.com/octocat/codething-mvp",
        sshUrl: "git@github.com:octocat/codething-mvp.git",
      });
    }),
  );

  it.effect("surfaces a friendly error when the pull request is not found", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockRejectedValueOnce(
        new Error(
          "GraphQL: Could not resolve to a PullRequest with the number of 4888. (repository.pullRequest)",
        ),
      );

      const error = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.getPullRequest({
          cwd: "/repo",
          reference: "4888",
        });
      }).pipe(Effect.flip);

      assert.equal(error.message.includes("Pull request not found"), true);
    }),
  );

  it.effect("reads GitHub auth status from gh auth status JSON", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify({
          hosts: {
            "github.com": [
              {
                state: "success",
                active: true,
                host: "github.com",
                login: "JerkyTreats",
                tokenSource: "keyring",
                scopes: "repo, workflow",
                gitProtocol: "https",
              },
            ],
          },
        }),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });
      mockForkRemoteResolution();
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify({
          nameWithOwner: "JerkyTreats/t3code-omarchy",
          url: "https://github.com/JerkyTreats/t3code-omarchy",
          description: null,
          defaultBranchRef: { name: "main" },
        }),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.getStatus({
          cwd: "/repo",
          hostname: "github.com",
        });
      });

      assert.deepStrictEqual(result, {
        installed: true,
        authenticated: true,
        hostname: "github.com",
        accountLogin: "JerkyTreats",
        gitProtocol: "https",
        tokenSource: "keyring",
        scopes: ["repo", "workflow"],
        repo: {
          nameWithOwner: "JerkyTreats/t3code-omarchy",
          url: "https://github.com/JerkyTreats/t3code-omarchy",
          description: null,
          defaultBranch: "main",
        },
      });
      expect(mockedRunProcess).toHaveBeenNthCalledWith(
        7,
        "gh",
        [
          "repo",
          "view",
          "JerkyTreats/t3code-omarchy",
          "--json",
          "nameWithOwner,url,description,defaultBranchRef",
        ],
        expect.objectContaining({ cwd: "/repo" }),
      );
    }),
  );

  it.effect("lists repository issues with normalized shape", () =>
    Effect.gen(function* () {
      mockForkRemoteResolution();
      mockedRunProcess
        .mockResolvedValueOnce({
          stdout: JSON.stringify([
            {
              number: 16,
              title: "Sync upstream changes",
              state: "OPEN",
              url: "https://github.com/JerkyTreats/t3code-omarchy/issues/16",
              body: null,
              createdAt: "2026-04-02T13:39:21Z",
              updatedAt: "2026-04-02T13:39:21Z",
              labels: [{ name: "sync", color: "abcdef" }],
              assignees: [{ login: "JerkyTreats" }],
              author: { login: "JerkyTreats" },
            },
          ]),
          stderr: "",
          code: 0,
          signal: null,
          timedOut: false,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            nameWithOwner: "JerkyTreats/t3code-omarchy",
            url: "https://github.com/JerkyTreats/t3code-omarchy",
            description: null,
            defaultBranchRef: { name: "main" },
          }),
          stderr: "",
          code: 0,
          signal: null,
          timedOut: false,
        });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.listIssues({
          cwd: "/repo",
          state: "open",
          limit: 10,
        });
      });

      assert.equal(result.repo?.nameWithOwner, "JerkyTreats/t3code-omarchy");
      assert.equal(result.issues[0]?.state, "open");
      assert.equal(result.issues[0]?.author, "JerkyTreats");
      expect(mockedRunProcess).toHaveBeenNthCalledWith(
        6,
        "gh",
        [
          "issue",
          "list",
          "--repo",
          "JerkyTreats/t3code-omarchy",
          "--state",
          "open",
          "--limit",
          "10",
          "--json",
          "number,title,state,url,body,createdAt,updatedAt,labels,assignees,author",
        ],
        expect.objectContaining({ cwd: "/repo" }),
      );
    }),
  );

  it.effect("creates an issue and reads back its normalized metadata", () =>
    Effect.gen(function* () {
      mockForkRemoteResolution();
      mockedRunProcess
        .mockResolvedValueOnce({
          stdout: "https://github.com/JerkyTreats/t3code-omarchy/issues/16\n",
          stderr: "",
          code: 0,
          signal: null,
          timedOut: false,
        })
        .mockResolvedValueOnce({
          stdout: JSON.stringify({
            number: 16,
            title: "Sync upstream changes",
            state: "OPEN",
            url: "https://github.com/JerkyTreats/t3code-omarchy/issues/16",
            body: null,
            createdAt: "2026-04-02T13:39:21Z",
            updatedAt: "2026-04-02T13:39:21Z",
            labels: [],
            assignees: [],
            author: { login: "JerkyTreats" },
          }),
          stderr: "",
          code: 0,
          signal: null,
          timedOut: false,
        });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.createIssue({
          cwd: "/repo",
          title: "Sync upstream changes",
          body: null,
        });
      });

      assert.equal(result.number, 16);
      assert.equal(result.state, "open");
      expect(mockedRunProcess).toHaveBeenNthCalledWith(
        6,
        "gh",
        [
          "issue",
          "create",
          "--repo",
          "JerkyTreats/t3code-omarchy",
          "--title",
          "Sync upstream changes",
          "--body",
          "",
        ],
        expect.objectContaining({ cwd: "/repo" }),
      );
      expect(mockedRunProcess).toHaveBeenNthCalledWith(
        7,
        "gh",
        [
          "issue",
          "view",
          "https://github.com/JerkyTreats/t3code-omarchy/issues/16",
          "--repo",
          "JerkyTreats/t3code-omarchy",
          "--json",
          "number,title,state,url,body,createdAt,updatedAt,labels,assignees,author",
        ],
        expect.objectContaining({ cwd: "/repo" }),
      );
    }),
  );

  it.effect("prefers the fork push remote over upstream when resolving repository status", () =>
    Effect.gen(function* () {
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify({
          hosts: {
            "github.com": [
              {
                state: "success",
                active: true,
                host: "github.com",
                login: "JerkyTreats",
                tokenSource: "keyring",
                scopes: "repo",
                gitProtocol: "https",
              },
            ],
          },
        }),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });
      mockForkRemoteResolution({
        branch: "feature/fork-owned",
        branchPushRemote: "origin",
      });
      mockedRunProcess.mockResolvedValueOnce({
        stdout: JSON.stringify({
          nameWithOwner: "JerkyTreats/t3code-omarchy",
          url: "https://github.com/JerkyTreats/t3code-omarchy",
          description: null,
          defaultBranchRef: { name: "main" },
        }),
        stderr: "",
        code: 0,
        signal: null,
        timedOut: false,
      });

      const result = yield* Effect.gen(function* () {
        const gh = yield* GitHubCli;
        return yield* gh.getStatus({
          cwd: "/repo",
          hostname: "github.com",
        });
      });

      assert.equal(result.repo?.nameWithOwner, "JerkyTreats/t3code-omarchy");
      expect(mockedRunProcess).toHaveBeenNthCalledWith(
        7,
        "gh",
        [
          "repo",
          "view",
          "JerkyTreats/t3code-omarchy",
          "--json",
          "nameWithOwner,url,description,defaultBranchRef",
        ],
        expect.objectContaining({ cwd: "/repo" }),
      );
    }),
  );
});
