import type { GitStatusResult } from "@t3tools/contracts";
import { useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
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
import { ScrollArea } from "~/components/ui/scroll-area";
import { Textarea } from "~/components/ui/textarea";

const COMMIT_DIALOG_TITLE = "Commit changes";
const COMMIT_DIALOG_DESCRIPTION =
  "Review and confirm your commit. Leave the message blank to auto-generate one.";

interface GitCommitDialogProps {
  open: boolean;
  branchName: string | null;
  isDefaultBranch: boolean;
  workingTree: GitStatusResult["workingTree"] | null;
  onOpenChange: (open: boolean) => void;
  onOpenFile: (filePath: string) => void;
  onSubmit: (commitMessage: string) => void;
  onSubmitNewBranch: (commitMessage: string) => void;
}

export function GitCommitDialog({
  open,
  branchName,
  isDefaultBranch,
  workingTree,
  onOpenChange,
  onOpenFile,
  onSubmit,
  onSubmitNewBranch,
}: GitCommitDialogProps) {
  const [commitMessage, setCommitMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setCommitMessage("");
    }
  }, [open]);

  const normalizedCommitMessage = commitMessage.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{COMMIT_DIALOG_TITLE}</DialogTitle>
          <DialogDescription>{COMMIT_DIALOG_DESCRIPTION}</DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="space-y-3 rounded-lg border border-input bg-muted/40 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Branch</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">{branchName ?? "(detached)"}</span>
                {isDefaultBranch && (
                  <Badge variant="warning" size="sm">
                    default
                  </Badge>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Files</p>
              {!workingTree || workingTree.files.length === 0 ? (
                <p className="font-medium">No changes</p>
              ) : (
                <div className="space-y-2">
                  <ScrollArea className="h-40 rounded-md border border-input bg-background">
                    <div className="space-y-0.5 p-1">
                      {workingTree.files.map((file) => (
                        <button
                          type="button"
                          key={file.path}
                          className="flex w-full items-center justify-between gap-3 rounded px-2 py-1 font-mono text-left transition-colors hover:bg-accent/50"
                          onClick={() => onOpenFile(file.path)}
                        >
                          <span className="truncate">{file.path}</span>
                          <span className="shrink-0 tabular-nums">
                            <span className="text-success-foreground">+{file.insertions}</span>
                            <span className="mx-0.5 text-border">/</span>
                            <span className="text-destructive-foreground">-{file.deletions}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="flex justify-end font-mono tabular-nums">
                    <span className="text-success-foreground">+{workingTree.insertions}</span>
                    <span className="mx-1 text-border">/</span>
                    <span className="text-destructive-foreground">-{workingTree.deletions}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">Commit message optional</p>
            <Textarea
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              placeholder="Leave empty to auto-generate"
              size="sm"
            />
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSubmitNewBranch(normalizedCommitMessage)}
          >
            New branch
          </Button>
          <Button size="sm" onClick={() => onSubmit(normalizedCommitMessage)}>
            Commit
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
