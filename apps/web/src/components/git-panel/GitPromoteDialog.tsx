import { ArrowRightIcon, GitBranchIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";

interface GitPromoteDialogProps {
  open: boolean;
  sourceBranch: string | null;
  targetBranch: string | null;
  hasWorkingTreeChanges: boolean;
  onOpenChange: (open: boolean) => void;
  onPromote: () => void;
}

export function GitPromoteDialog({
  open,
  sourceBranch,
  targetBranch,
  hasWorkingTreeChanges,
  onOpenChange,
  onPromote,
}: GitPromoteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Promote to {targetBranch ?? "target"}?</DialogTitle>
          <DialogDescription>
            This will merge{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              {sourceBranch ?? "current branch"}
            </code>{" "}
            into{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              {targetBranch ?? "target"}
            </code>
            , push, and delete the feature branch. This bypasses pull request review.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <GitBranchIcon className="size-4 text-muted-foreground" />
            <span className="font-mono">{sourceBranch}</span>
            <ArrowRightIcon className="size-4 text-muted-foreground" />
            <span className="font-mono font-medium">{targetBranch}</span>
          </div>
          {hasWorkingTreeChanges && (
            <p className="text-xs text-muted-foreground">
              Uncommitted changes will be committed first.
            </p>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={onPromote}>
            Promote
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
