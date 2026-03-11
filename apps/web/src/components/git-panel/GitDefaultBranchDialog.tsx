import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";

interface GitDefaultBranchDialogCopy {
  title?: string;
  description?: string;
  continueLabel?: string;
}

interface GitDefaultBranchDialogProps {
  open: boolean;
  copy: GitDefaultBranchDialogCopy | null;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  onCreateBranch: () => void;
}

export function GitDefaultBranchDialog({
  open,
  copy,
  onOpenChange,
  onContinue,
  onCreateBranch,
}: GitDefaultBranchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy?.title ?? "Continue on default branch?"}</DialogTitle>
          <DialogDescription>{copy?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" size="sm" onClick={onContinue}>
            {copy?.continueLabel ?? "Continue"}
          </Button>
          <Button size="sm" onClick={onCreateBranch}>
            Feature branch
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
