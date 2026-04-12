import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";

interface ProjectPanelSectionProps {
  actions?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  title: string;
}

export function ProjectPanelSection({
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
  title,
}: ProjectPanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {title}
          </h3>
          {actions}
        </div>
        {children}
      </section>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground">
            {open ? (
              <ChevronDownIcon className="size-3" />
            ) : (
              <ChevronRightIcon className="size-3" />
            )}
            {title}
          </CollapsibleTrigger>
          {actions}
        </div>
        <CollapsibleContent>{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
