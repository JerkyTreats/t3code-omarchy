import type {
  GitHubIssueMutationInput,
  GitHubIssueMutationResult,
  GitHubListIssuesInput,
  GitHubListIssuesResult,
  GitHubLoginInput,
  GitHubStatusInput,
  GitHubStatusResult,
} from "@t3tools/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { GitHubCliError } from "../Errors.ts";

export interface GitHubManagerShape {
  readonly status: (input: GitHubStatusInput) => Effect.Effect<GitHubStatusResult, GitHubCliError>;
  readonly login: (input: GitHubLoginInput) => Effect.Effect<GitHubStatusResult, GitHubCliError>;
  readonly listIssues: (
    input: GitHubListIssuesInput,
  ) => Effect.Effect<GitHubListIssuesResult, GitHubCliError>;
  readonly closeIssue: (
    input: GitHubIssueMutationInput,
  ) => Effect.Effect<GitHubIssueMutationResult, GitHubCliError>;
  readonly reopenIssue: (
    input: GitHubIssueMutationInput,
  ) => Effect.Effect<GitHubIssueMutationResult, GitHubCliError>;
}

export class GitHubManager extends ServiceMap.Service<GitHubManager, GitHubManagerShape>()(
  "t3/git/Services/GitHubManager",
) {}
