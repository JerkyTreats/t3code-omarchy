import type { GitHubIssue, GitHubIssueLink, GitStatusResult, ThreadId } from "@t3tools/contracts";

import type { Thread } from "./types";

export interface GitHubIssueWorkflowBadge {
  readonly label: string;
  readonly tone: "neutral" | "success" | "info";
}

export type GitHubIssueWorkflowAction =
  | { readonly kind: "resolve" }
  | { readonly kind: "continue"; readonly threadId: ThreadId }
  | { readonly kind: "current" }
  | { readonly kind: "open_pr"; readonly url: string }
  | { readonly kind: "view" };

export interface GitHubIssueWorkflowState {
  readonly action: GitHubIssueWorkflowAction;
  readonly badges: ReadonlyArray<GitHubIssueWorkflowBadge>;
  readonly linkedThreadCount: number;
}

function matchesIssueLink(
  issueLink: GitHubIssueLink | null,
  repoNameWithOwner: string | null,
  issueNumber: number,
): boolean {
  if (!issueLink || !repoNameWithOwner) {
    return false;
  }
  return issueLink.repoNameWithOwner === repoNameWithOwner && issueLink.number === issueNumber;
}

function resolvePrimaryLinkedThread(input: {
  threads: readonly Thread[];
  repoNameWithOwner: string | null;
  issueNumber: number;
  activeThreadId: ThreadId | null;
}): readonly Thread[] {
  const linkedThreads = input.threads
    .filter((thread) =>
      matchesIssueLink(thread.issueLink, input.repoNameWithOwner, input.issueNumber),
    )
    .toSorted((left, right) => {
      if (left.id === input.activeThreadId) return -1;
      if (right.id === input.activeThreadId) return 1;
      return (
        Date.parse(right.lastVisitedAt ?? right.createdAt) -
        Date.parse(left.lastVisitedAt ?? left.createdAt)
      );
    });
  return linkedThreads;
}

export function resolveGitHubIssueWorkflowState(input: {
  issue: Pick<GitHubIssue, "number" | "state">;
  repoNameWithOwner: string | null;
  threads: readonly Thread[];
  activeThreadId: ThreadId | null;
  activeIssueLink: GitHubIssueLink | null;
  activePr: GitStatusResult["pr"] | null;
}): GitHubIssueWorkflowState {
  const linkedThreads = resolvePrimaryLinkedThread({
    threads: input.threads,
    repoNameWithOwner: input.repoNameWithOwner,
    issueNumber: input.issue.number,
    activeThreadId: input.activeThreadId,
  });
  const primaryThread = linkedThreads[0] ?? null;
  const isActiveIssue = matchesIssueLink(
    input.activeIssueLink,
    input.repoNameWithOwner,
    input.issue.number,
  );
  const openPrUrl =
    isActiveIssue && input.activePr?.state === "open" ? (input.activePr.url ?? null) : null;

  const badges: GitHubIssueWorkflowBadge[] = [];
  if (linkedThreads.length > 0) {
    badges.push({
      label: primaryThread?.id === input.activeThreadId ? "Current" : "Thread",
      tone: "info",
    });
  }
  if (linkedThreads.length > 1) {
    badges.push({ label: `${linkedThreads.length} threads`, tone: "neutral" });
  }
  if (openPrUrl) {
    badges.push({ label: "PR open", tone: "success" });
  }
  if (input.issue.state === "closed") {
    badges.push({ label: "Closed", tone: "neutral" });
  }

  if (openPrUrl) {
    return {
      action: { kind: "open_pr", url: openPrUrl },
      badges,
      linkedThreadCount: linkedThreads.length,
    };
  }
  if (primaryThread && primaryThread.id !== input.activeThreadId) {
    return {
      action: { kind: "continue", threadId: primaryThread.id },
      badges,
      linkedThreadCount: linkedThreads.length,
    };
  }
  if (primaryThread) {
    return {
      action: { kind: "current" },
      badges,
      linkedThreadCount: linkedThreads.length,
    };
  }
  if (input.issue.state === "open") {
    return {
      action: { kind: "resolve" },
      badges,
      linkedThreadCount: 0,
    };
  }

  return {
    action: { kind: "view" },
    badges,
    linkedThreadCount: 0,
  };
}
