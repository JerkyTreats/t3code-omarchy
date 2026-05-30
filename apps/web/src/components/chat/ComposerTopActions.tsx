import type { RuntimeMode } from "@t3tools/contracts";
import { CameraIcon, LockIcon, LockOpenIcon, PenLineIcon, type LucideIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger } from "../ui/select";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

const runtimeModeConfig: Record<
  RuntimeMode,
  { label: string; description: string; icon: LucideIcon }
> = {
  "approval-required": {
    label: "Supervised",
    description: "Ask before commands and file changes.",
    icon: LockIcon,
  },
  "auto-accept-edits": {
    label: "Auto-accept edits",
    description: "Auto-approve edits, ask before other actions.",
    icon: PenLineIcon,
  },
  "full-access": {
    label: "Full access",
    description: "Allow commands and edits without prompts.",
    icon: LockOpenIcon,
  },
};

const runtimeModeOptions = Object.keys(runtimeModeConfig) as RuntimeMode[];

interface ComposerTopActionsProps {
  canCaptureDesktopScreenshot: boolean;
  isCapturingDesktopScreenshot: boolean;
  isScreenshotDisabled: boolean;
  runtimeMode: RuntimeMode;
  onCaptureScreenshot: () => void;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
}

export function ComposerTopActions(props: ComposerTopActionsProps) {
  const runtimeModeOption = runtimeModeConfig[props.runtimeMode];
  const RuntimeModeIcon = runtimeModeOption.icon;

  return (
    <div className="pointer-events-none absolute right-3 top-0 z-20 flex -translate-y-1/2 items-center gap-1.5 sm:right-4">
      <Select
        value={props.runtimeMode}
        onValueChange={(value) => {
          if (!value || value === props.runtimeMode) return;
          props.onRuntimeModeChange(value);
        }}
      >
        <SelectTrigger
          variant="ghost"
          size="sm"
          className="pointer-events-auto size-8 justify-center rounded-full border border-white/10 bg-slate-950/22 p-0 text-slate-200/78 shadow-[0_10px_24px_rgb(0_0_0/0.18),inset_0_1px_0_rgb(255_255_255/0.05)] backdrop-blur-md hover:border-white/16 hover:bg-slate-950/28 hover:text-slate-100/88 dark:border-white/10 dark:bg-slate-950/28 dark:text-slate-200/78 dark:hover:border-white/16 dark:hover:bg-slate-950/36 dark:hover:text-slate-100/88 [&_[data-slot=select-icon]]:hidden"
          aria-label={`Runtime mode: ${runtimeModeOption.label}`}
          title={runtimeModeOption.description}
        >
          <RuntimeModeIcon className="size-4" />
        </SelectTrigger>
        <SelectPopup alignItemWithTrigger={false}>
          {runtimeModeOptions.map((mode) => {
            const option = runtimeModeConfig[mode];
            const OptionIcon = option.icon;
            return (
              <SelectItem key={mode} value={mode} className="min-w-64 py-2">
                <div className="grid min-w-0 gap-0.5">
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                    <OptionIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    {option.label}
                  </span>
                  <span className="text-muted-foreground text-xs leading-4">
                    {option.description}
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectPopup>
      </Select>

      {props.canCaptureDesktopScreenshot ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="pointer-events-auto rounded-full border-white/8 bg-slate-200/8 text-slate-200/36 shadow-[0_10px_22px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.04)] backdrop-blur-md hover:border-white/12 hover:bg-slate-200/12 hover:text-slate-200/58 dark:border-white/8 dark:bg-slate-200/8 dark:text-slate-200/36 dark:hover:border-white/12 dark:hover:bg-slate-200/12 dark:hover:text-slate-200/58"
                disabled={props.isScreenshotDisabled}
                aria-label="Attach screenshot"
                onClick={props.onCaptureScreenshot}
              >
                <CameraIcon
                  className={cn("size-4", props.isCapturingDesktopScreenshot && "animate-pulse")}
                />
              </Button>
            }
          />
          <TooltipPopup side="top">Attach screenshot</TooltipPopup>
        </Tooltip>
      ) : null}
    </div>
  );
}
