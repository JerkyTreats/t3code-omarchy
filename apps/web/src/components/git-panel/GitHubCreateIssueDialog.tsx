import { useEffect, useState } from "react";

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
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

interface GitHubCreateIssueDialogProps {
  open: boolean;
  repoNameWithOwner: string | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { title: string; body: string }) => void;
}

export function GitHubCreateIssueDialog({
  open,
  repoNameWithOwner,
  isSubmitting,
  errorMessage,
  onOpenChange,
  onSubmit,
}: GitHubCreateIssueDialogProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open) {
      setTitle("");
      setBody("");
    }
  }, [open]);

  const normalizedTitle = title.trim();
  const normalizedBody = body.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Create issue</DialogTitle>
          <DialogDescription>
            {repoNameWithOwner
              ? `Create a new GitHub issue in ${repoNameWithOwner}.`
              : "Create a new GitHub issue for the current repository."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-medium">Title</p>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Brief summary"
              size="sm"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">Description optional</p>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Add context, repro steps, or acceptance notes"
              size="sm"
            />
          </div>
          {errorMessage && <p className="text-xs text-destructive-foreground">{errorMessage}</p>}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={isSubmitting || normalizedTitle.length === 0}
            onClick={() => onSubmit({ title: normalizedTitle, body: normalizedBody })}
          >
            {isSubmitting ? "Creating..." : "Create issue"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
