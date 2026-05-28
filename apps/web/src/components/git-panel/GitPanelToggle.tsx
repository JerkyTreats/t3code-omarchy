import { GitHubIcon } from "../Icons";
import { Toggle } from "~/components/ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

interface GitPanelToggleProps {
  gitCwd: string | null;
  open: boolean;
  onToggle: () => void;
}

export function GitPanelToggle({ gitCwd, open, onToggle }: GitPanelToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            className="shrink-0"
            pressed={open}
            onPressedChange={onToggle}
            aria-label="Toggle GitHub panel"
            variant="outline"
            size="xs"
            disabled={!gitCwd}
          >
            <GitHubIcon className="size-3.5" />
          </Toggle>
        }
      />
      <TooltipPopup side="bottom">{open ? "Close GitHub panel" : "Open GitHub panel"}</TooltipPopup>
    </Tooltip>
  );
}
