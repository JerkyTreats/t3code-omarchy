import { Button } from "../ui/button";

import type { ComposerRichDraftFormat } from "~/composerRichDraft";

interface ComposerRichDraftToolbarProps {
  disabled: boolean;
  onApplyFormat: (format: ComposerRichDraftFormat) => void;
}

export function ComposerRichDraftToolbar(props: ComposerRichDraftToolbarProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 rounded-2xl border border-border/60 bg-muted/18 p-1 shadow-xs/5">
      <span className="px-2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground/55 uppercase">
        Draft
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-xl px-2.5 font-semibold text-foreground/85 hover:bg-muted/45"
        onClick={() => props.onApplyFormat("bold")}
        disabled={props.disabled}
        aria-label="Apply bold formatting"
      >
        B
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-xl px-2.5 text-[15px] font-serif italic text-foreground/85 hover:bg-muted/45"
        onClick={() => props.onApplyFormat("italic")}
        disabled={props.disabled}
        aria-label="Apply italic formatting"
      >
        i
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-xl px-2.5 text-foreground/80 hover:bg-muted/45"
        onClick={() => props.onApplyFormat("bullet-list")}
        disabled={props.disabled}
        aria-label="Apply list formatting"
      >
        • List
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-xl px-2.5 text-foreground/80 hover:bg-muted/45"
        onClick={() => props.onApplyFormat("link")}
        disabled={props.disabled}
        aria-label="Insert link formatting"
      >
        Link
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-xl px-2.5 font-mono text-[13px] text-foreground/80 hover:bg-muted/45"
        onClick={() => props.onApplyFormat("code")}
        disabled={props.disabled}
        aria-label="Apply code formatting"
      >
        {"</>"}
      </Button>
    </div>
  );
}
