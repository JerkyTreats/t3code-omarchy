import type { GitHubIssue } from "@t3tools/contracts";
import { buildManagedWorktreeBranchName, resolveUniqueBranchName } from "@t3tools/shared/git";

import { truncateTitle } from "./truncateTitle";

const MAX_ISSUE_BODY_PROMPT_LENGTH = 8_000;

function trimIssueBody(body: string | null): string | null {
  const trimmed = body?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length <= MAX_ISSUE_BODY_PROMPT_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_ISSUE_BODY_PROMPT_LENGTH).trimEnd()}\n\n[Issue body truncated for brevity.]`;
}

export function buildIssueWorkspaceBranchName(
  issue: Pick<GitHubIssue, "number" | "title">,
  existingBranchNames: readonly string[],
): string {
  return resolveUniqueBranchName(
    existingBranchNames,
    buildManagedWorktreeBranchName(issue.title, `issue-${issue.number}`),
  );
}

export function buildIssueThreadTitle(issue: Pick<GitHubIssue, "number" | "title">): string {
  return truncateTitle(`#${issue.number} ${issue.title}`);
}

export function buildIssueResolutionPrompt(input: {
  issue: GitHubIssue;
  baseBranch: string | null;
  repoNameWithOwner: string | null;
}) {
  const { issue } = input;
  const trimmedBody = trimIssueBody(issue.body);
  const labels = issue.labels.map((label) => label.name);
  const assignees = issue.assignees.map((assignee) => assignee.login);

  return [
    `Resolve GitHub issue #${issue.number}: ${issue.title}`,
    input.repoNameWithOwner ? `Repository: ${input.repoNameWithOwner}` : null,
    input.baseBranch ? `Base branch: ${input.baseBranch}` : null,
    `Issue URL: ${issue.url}`,
    `Issue state: ${issue.state}`,
    issue.author ? `Issue author: @${issue.author}` : null,
    labels.length > 0 ? `Labels: ${labels.join(", ")}` : null,
    assignees.length > 0 ? `Assignees: ${assignees.map((login) => `@${login}`).join(", ")}` : null,
    `Created at: ${issue.createdAt}`,
    `Updated at: ${issue.updatedAt}`,
    "",
    "Issue details:",
    trimmedBody ?? "No issue description was provided.",
    "",
    "Investigate the codebase, implement the smallest correct fix in this workspace, and update tests or docs if needed.",
    "Summarize the root cause, the changes you made, and any follow up risks before finishing.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
