import type { GitHubIssueLink, GitStatusResult } from "@t3tools/contracts";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { GitPanelSection } from "./GitPanelSection";

interface GitHubLinkedIssueSectionProps {
  visible: boolean;
  issueLink: GitHubIssueLink | null;
  activePr: GitStatusResult["pr"] | null;
  canMarkIssueResolved: boolean;
  isClosingIssue: boolean;
  isReopeningIssue: boolean;
  onOpenIssue: (url: string) => void;
  onOpenPullRequest: (url: string) => void;
  onCloseIssue: () => void;
  onReopenIssue: () => void;
}

export function GitHubLinkedIssueSection({
  visible,
  issueLink,
  activePr,
  canMarkIssueResolved,
  isClosingIssue,
  isReopeningIssue,
  onOpenIssue,
  onOpenPullRequest,
  onCloseIssue,
  onReopenIssue,
}: GitHubLinkedIssueSectionProps) {
  if (!visible || !issueLink) {
    return null;
  }

  const prUrl = activePr?.url ?? null;

  return (
    <GitPanelSection title="Current issue" defaultOpen>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">
            #{issueLink.number} {issueLink.title}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {issueLink.repoNameWithOwner}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {issueLink.state === "open" ? "Open" : "Closed"}
            </Badge>
            {activePr?.state === "open" && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                PR open
              </Badge>
            )}
            {activePr?.state === "merged" && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                PR merged
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            size="xs"
            variant="outline"
            className="h-6"
            onClick={() => onOpenIssue(issueLink.url)}
          >
            Open issue
          </Button>
          {prUrl && (
            <Button
              size="xs"
              variant="outline"
              className="h-6"
              onClick={() => onOpenPullRequest(prUrl)}
            >
              Open PR
            </Button>
          )}
          {issueLink.state === "open" && canMarkIssueResolved && (
            <Button size="xs" className="h-6" disabled={isClosingIssue} onClick={onCloseIssue}>
              {isClosingIssue ? "Resolving..." : "Mark resolved"}
            </Button>
          )}
          {issueLink.state === "closed" && (
            <Button
              size="xs"
              variant="outline"
              className="h-6"
              disabled={isReopeningIssue}
              onClick={onReopenIssue}
            >
              {isReopeningIssue ? "Reopening..." : "Reopen issue"}
            </Button>
          )}
        </div>
      </div>
    </GitPanelSection>
  );
}
