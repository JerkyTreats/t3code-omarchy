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
      mockedRunProcess
        .mockResolvedValueOnce({
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
    }),
  );

  it.effect("lists repository issues with normalized shape", () =>
    Effect.gen(function* () {
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
    }),
  );

  it.effect("creates an issue and reads back its normalized metadata", () =>
    Effect.gen(function* () {
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
        1,
        "gh",
        ["issue", "create", "--title", "Sync upstream changes", "--body", ""],
        expect.objectContaining({ cwd: "/repo" }),
      );
    }),
  );
});
