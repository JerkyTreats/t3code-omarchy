import { CameraIcon, LockIcon, LockOpenIcon } from "lucide-react";

import { type RuntimeMode } from "@t3tools/contracts";

import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

interface ComposerTopActionsProps {
  canCaptureDesktopScreenshot: boolean;
  runtimeMode: RuntimeMode;
  onCaptureScreenshot: () => void;
  onToggleRuntimeMode: () => void;
}

export function ComposerTopActions(props: ComposerTopActionsProps) {
  return (
    <div className="pointer-events-none absolute top-0 right-3 z-20 flex -translate-y-1/2 items-center gap-1.5 sm:right-4">
      <Button
        variant="outline"
        className="pointer-events-auto rounded-full border-border/85 bg-background/96 text-foreground/88 shadow-sm backdrop-blur-md hover:border-border hover:bg-background hover:text-foreground"
        size="icon-sm"
        type="button"
        onClick={props.onToggleRuntimeMode}
        title={
          props.runtimeMode === "full-access"
            ? "Full access — click to require approvals"
            : "Approval required — click for full access"
        }
      >
        {props.runtimeMode === "full-access" ? <LockOpenIcon /> : <LockIcon />}
      </Button>
      {props.canCaptureDesktopScreenshot ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                className="pointer-events-auto rounded-full border-border/85 bg-background/96 text-foreground/92 shadow-sm backdrop-blur-md hover:border-border hover:bg-background hover:text-foreground"
                onClick={props.onCaptureScreenshot}
                aria-label="Capture screenshot and attach to draft"
              >
                <CameraIcon />
              </Button>
            }
          />
          <TooltipPopup side="top">Capture screenshot and attach to draft</TooltipPopup>
        </Tooltip>
      ) : null}
    </div>
  );
}
