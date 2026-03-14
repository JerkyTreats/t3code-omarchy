import type { GitHubIssue, GitHubIssueListState, ThreadId } from "@t3tools/contracts";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { GitHubIssueWorkflowState } from "~/githubIssueWorkflow";
import { GitPanelSection } from "./GitPanelSection";
import { GitStatusDot } from "./GitStatusDot";

function formatGitHubTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

interface GitHubIssuesSectionProps {
  visible: boolean;
  issueState: GitHubIssueListState;
  onIssueStateChange: (state: GitHubIssueListState) => void;
  isLoading: boolean;
  isFetching: boolean;
  issuesDisabled: boolean;
  errorMessage: string | null;
  issues: readonly GitHubIssue[];
  workflowsByIssueNumber: ReadonlyMap<number, GitHubIssueWorkflowState>;
  onOpenIssue: (url: string) => void;
  onContinueIssueThread: (threadId: ThreadId) => void;
  onOpenPullRequest: (url: string) => void;
  onResolveIssue: (issue: GitHubIssue) => void;
  resolvingIssueNumber: number | null;
}

export function GitHubIssuesSection({
  visible,
  issueState,
  onIssueStateChange,
  isLoading,
  isFetching,
  issuesDisabled,
  errorMessage,
  issues,
  workflowsByIssueNumber,
  onOpenIssue,
  onContinueIssueThread,
  onOpenPullRequest,
  onResolveIssue,
  resolvingIssueNumber,
}: GitHubIssuesSectionProps) {
  if (!visible) {
    return null;
  }

  return (
    <GitPanelSection
      title="Issues"
      collapsible
      defaultOpen={false}
      actions={
        <div className="flex gap-0.5">
          {(["open", "closed", "all"] as const).map((state) => (
            <Button
              key={state}
              variant={issueState === state ? "secondary" : "ghost"}
              size="xs"
              onClick={() => onIssueStateChange(state)}
              className="h-5 px-1.5 text-[10px]"
            >
              {state.charAt(0).toUpperCase() + state.slice(1)}
            </Button>
          ))}
        </div>
      }
    >
      {isLoading || isFetching ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : issuesDisabled ? (
        <p className="text-xs text-muted-foreground">Issues disabled for this repo</p>
      ) : errorMessage ? (
        <p className="text-xs text-destructive-foreground">{errorMessage}</p>
      ) : issues.length > 0 ? (
        <div className="space-y-1">
          {issues.map((issue) => {
            const workflow = workflowsByIssueNumber.get(issue.number);
            const action = workflow?.action ?? { kind: "resolve" as const };
            const actionLabel =
              action.kind === "continue"
                ? "Continue"
                : action.kind === "current"
                  ? "Current"
                  : action.kind === "open_pr"
                    ? "Open PR"
                    : action.kind === "view"
                      ? "View"
                      : "Resolve";
            const actionDisabled =
              action.kind === "current" ||
              (action.kind === "resolve" && resolvingIssueNumber !== null);

            return (
              <div
                key={issue.number}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  onClick={() => onOpenIssue(issue.url)}
                >
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    #{issue.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{issue.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {issue.author && <span>@{issue.author}</span>}
                      <span>{formatGitHubTimestamp(issue.updatedAt)}</span>
                    </div>
                    {workflow && workflow.badges.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {workflow.badges.map((badge) => (
                          <Badge
                            key={`${issue.number}-${badge.label}`}
                            variant={badge.tone === "success" ? "secondary" : "outline"}
                            className="h-5 px-1.5 text-[10px]"
                          >
                            {badge.label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <GitStatusDot
                    level={issue.state === "open" ? "success" : "neutral"}
                    className="mt-1.5"
                  />
                </button>
                <Button
                  size="xs"
                  variant="outline"
                  className="h-6 shrink-0"
                  disabled={actionDisabled}
                  onClick={() => {
                    if (action.kind === "continue") {
                      onContinueIssueThread(action.threadId);
                      return;
                    }
                    if (action.kind === "open_pr") {
                      onOpenPullRequest(action.url);
                      return;
                    }
                    if (action.kind === "view") {
                      onOpenIssue(issue.url);
                      return;
                    }
                    if (action.kind === "resolve") {
                      onResolveIssue(issue);
                    }
                  }}
                >
                  {resolvingIssueNumber === issue.number && action.kind === "resolve"
                    ? "Starting..."
                    : actionLabel}
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No issues</p>
      )}
    </GitPanelSection>
  );
}
