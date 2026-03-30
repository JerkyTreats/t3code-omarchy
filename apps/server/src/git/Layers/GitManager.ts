import { Effect, Layer } from "effect";

import { ForkGitDomain } from "../Services/ForkGitDomain.ts";
import { GitManager, type GitManagerShape } from "../Services/GitManager.ts";

export const makeGitManager = Effect.gen(function* () {
  const forkGitDomain = yield* ForkGitDomain;

  return {
    status: (input) => forkGitDomain.status(input),
    pull: (input) => forkGitDomain.pull(input),
    repositoryContext: (input) => forkGitDomain.repositoryContext(input),
    resolvePullRequest: (input) => forkGitDomain.resolvePullRequest(input),
    preparePullRequestThread: (input) => forkGitDomain.preparePullRequestThread(input),
    runStackedAction: (input, options) => forkGitDomain.runStackedAction(input, options),
  } satisfies GitManagerShape;
});

export const GitManagerLive = Layer.effect(GitManager, makeGitManager);
