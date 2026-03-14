import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { resolveGitHubRepositorySelector } from "./gitHubRepository.ts";

describe("resolveGitHubRepositorySelector", () => {
  it("prefers the fork origin over upstream", async () => {
    const config = new Map<string, string>([
      ["branch.statemachine.remote", "origin"],
      ["remote.origin.url", "git@github.com:octocat/codething-mvp.git"],
      ["remote.upstream.url", "git@github.com:pingdotgg/codething-mvp.git"],
    ]);

    const selector = await Effect.runPromise(
      resolveGitHubRepositorySelector("/tmp/repo", {
        readConfigValue: (_cwd, key) => Effect.succeed(config.get(key) ?? null),
      }),
    );

    expect(selector).toBe("octocat/codething-mvp");
  });

  it("falls back to origin when upstream is missing", async () => {
    const config = new Map<string, string>([
      ["branch.statemachine.remote", "origin"],
      ["remote.origin.url", "git@github.com:octocat/codething-mvp.git"],
    ]);

    const selector = await Effect.runPromise(
      resolveGitHubRepositorySelector("/tmp/repo", {
        readConfigValue: (_cwd, key) => Effect.succeed(config.get(key) ?? null),
      }),
    );

    expect(selector).toBe("octocat/codething-mvp");
  });
});
