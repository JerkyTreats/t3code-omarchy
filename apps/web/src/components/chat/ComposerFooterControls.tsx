import { type ProviderInteractionMode } from "@t3tools/contracts";
import { BotIcon, ChevronDownIcon } from "lucide-react";

import { ContextWindowMeter } from "./ContextWindowMeter";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { Toggle } from "../ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

interface ComposerFooterControlsProps {
  activeContextWindow: Parameters<typeof ContextWindowMeter>[0]["usage"] | null;
  activePendingIsResponding: boolean;
  activePendingProgress: {
    canAdvance: boolean;
    isLastQuestion: boolean;
    questionIndex: number;
  } | null;
  activePendingResolvedAnswers: boolean;
  canShowChatToggle: boolean;
  composerHasSendableContent: boolean;
  interactionMode: ProviderInteractionMode;
  isConnecting: boolean;
  isPreparingWorktree: boolean;
  isSendBusy: boolean;
  onImplementPlanInNewThread: () => void;
  onInterrupt: () => void;
  onPreviousQuestion: () => void;
  onSubmit: "send" | "plan-follow-up" | "pending-progress" | "running";
  onToggleInteractionMode: () => void;
  onToggleRichDraftMode: (pressed: boolean) => void;
  pendingResolvedAnswersLabel: string;
  richDraftMode: boolean;
  showPlanFollowUpPrompt: boolean;
}

export function ComposerFooterControls(props: ComposerFooterControlsProps) {
  return (
    <>
      {props.canShowChatToggle ? (
        <Button
          variant="ghost"
          className="shrink-0 whitespace-nowrap px-2 text-muted-foreground/70 hover:text-foreground/80"
          size="sm"
          type="button"
          onClick={props.onToggleInteractionMode}
          title={
            props.interactionMode === "plan"
              ? "Plan mode — click to return to normal chat mode"
              : "Default mode — click to enter plan mode"
          }
        >
          <BotIcon />
          <span className="sr-only lg:not-sr-only">
            {props.interactionMode === "plan" ? "Plan" : "Chat"}
          </span>
        </Button>
      ) : null}

      <div
        data-chat-composer-actions="right"
        className="flex shrink-0 items-center gap-2 pr-1 pb-0.5 sm:pr-1.5"
      >
        {props.activeContextWindow ? (
          <ContextWindowMeter usage={props.activeContextWindow} />
        ) : null}
        {props.isPreparingWorktree ? (
          <span className="text-muted-foreground/70 text-xs">Preparing worktree...</span>
        ) : null}
        {props.onSubmit === "pending-progress" && props.activePendingProgress ? (
          <div className="flex items-center gap-2">
            {props.activePendingProgress.questionIndex > 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={props.onPreviousQuestion}
                disabled={props.activePendingIsResponding}
              >
                Previous
              </Button>
            ) : null}
            <Button
              type="submit"
              size="sm"
              className="rounded-full px-4"
              disabled={
                props.activePendingIsResponding ||
                (props.activePendingProgress.isLastQuestion
                  ? !props.activePendingResolvedAnswers
                  : !props.activePendingProgress.canAdvance)
              }
            >
              {props.pendingResolvedAnswersLabel}
            </Button>
          </div>
        ) : props.onSubmit === "running" ? (
          <button
            type="button"
            className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-rose-500/90 text-white transition-all duration-150 hover:bg-rose-500 hover:scale-105 sm:h-8 sm:w-8"
            onClick={props.onInterrupt}
            aria-label="Stop generation"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <rect x="2" y="2" width="8" height="8" rx="1.5" />
            </svg>
          </button>
        ) : props.onSubmit === "plan-follow-up" ? (
          <PlanFollowUpSubmit
            isConnecting={props.isConnecting}
            isSendBusy={props.isSendBusy}
            onImplementPlanInNewThread={props.onImplementPlanInNewThread}
            promptHasContent={props.composerHasSendableContent}
          />
        ) : (
          <SendControls
            canShowRichDraftToggle={props.canShowChatToggle}
            composerHasSendableContent={props.composerHasSendableContent}
            isConnecting={props.isConnecting}
            isPreparingWorktree={props.isPreparingWorktree}
            isSendBusy={props.isSendBusy}
            onToggleRichDraftMode={props.onToggleRichDraftMode}
            richDraftMode={props.richDraftMode}
          />
        )}
      </div>
    </>
  );
}

function PlanFollowUpSubmit(props: {
  isConnecting: boolean;
  isSendBusy: boolean;
  onImplementPlanInNewThread: () => void;
  promptHasContent: boolean;
}) {
  if (props.promptHasContent) {
    return (
      <Button
        type="submit"
        size="sm"
        className="h-9 rounded-full px-4 sm:h-8"
        disabled={props.isSendBusy || props.isConnecting}
      >
        {props.isConnecting || props.isSendBusy ? "Sending..." : "Refine"}
      </Button>
    );
  }

  return (
    <div className="flex items-center">
      <Button
        type="submit"
        size="sm"
        className="h-9 rounded-l-full rounded-r-none px-4 sm:h-8"
        disabled={props.isSendBusy || props.isConnecting}
      >
        {props.isConnecting || props.isSendBusy ? "Sending..." : "Implement"}
      </Button>
      <Menu>
        <MenuTrigger
          render={
            <Button
              size="sm"
              variant="default"
              className="h-9 rounded-l-none rounded-r-full border-l-white/12 px-2 sm:h-8"
              aria-label="Implementation actions"
              disabled={props.isSendBusy || props.isConnecting}
            />
          }
        >
          <ChevronDownIcon className="size-3.5" />
        </MenuTrigger>
        <MenuPopup align="end" side="top">
          <MenuItem
            disabled={props.isSendBusy || props.isConnecting}
            onClick={props.onImplementPlanInNewThread}
          >
            Implement in a new thread
          </MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}

function SendControls(props: {
  canShowRichDraftToggle: boolean;
  composerHasSendableContent: boolean;
  isConnecting: boolean;
  isPreparingWorktree: boolean;
  isSendBusy: boolean;
  onToggleRichDraftMode: (pressed: boolean) => void;
  richDraftMode: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {props.canShowRichDraftToggle ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                pressed={props.richDraftMode}
                onPressedChange={props.onToggleRichDraftMode}
                aria-label={
                  props.richDraftMode ? "Disable rich draft mode" : "Enable rich draft mode"
                }
                variant="outline"
                size="xs"
                className="rounded-full border-border/60 bg-background/80 px-2.5 text-muted-foreground/80 shadow-xs/5 hover:bg-background hover:text-foreground data-pressed:border-primary/35 data-pressed:bg-primary/10 data-pressed:text-foreground"
              >
                <span aria-hidden="true" className="font-serif text-[16px] leading-none italic">
                  a
                </span>
              </Toggle>
            }
          />
          <TooltipPopup side="top">
            {props.richDraftMode
              ? "Rich draft on — Enter adds a new line"
              : "Rich draft off — Enter sends"}
          </TooltipPopup>
        </Tooltip>
      ) : null}
      <button
        type="submit"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/90 text-primary-foreground transition-all duration-150 hover:bg-primary hover:scale-105 disabled:opacity-30 disabled:hover:scale-100 sm:h-8 sm:w-8"
        disabled={props.isSendBusy || props.isConnecting || !props.composerHasSendableContent}
        aria-label={
          props.isConnecting
            ? "Connecting"
            : props.isPreparingWorktree
              ? "Preparing worktree"
              : props.isSendBusy
                ? "Sending"
                : "Send message"
        }
      >
        {props.isConnecting || props.isSendBusy ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="animate-spin"
            aria-hidden="true"
          >
            <circle
              cx="7"
              cy="7"
              r="5.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="20 12"
            />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
