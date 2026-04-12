import type { ReactNode } from "react";

import { isElectron } from "../env";
import { SidebarInset, SidebarTrigger } from "./ui/sidebar";

interface ProjectPageShellProps {
  children: ReactNode;
  title: string;
}

export function ProjectPageShell({ children, title }: ProjectPageShellProps) {
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--primary)_8%,transparent),transparent_38%),radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--ring)_7%,transparent),transparent_34%)]" />

        {!isElectron ? (
          <header className="relative border-b border-border/90 bg-background/88 px-3 py-2 backdrop-blur sm:px-5">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
              <span className="text-sm font-medium text-foreground">{title}</span>
            </div>
          </header>
        ) : (
          <div className="drag-region relative flex h-[52px] shrink-0 items-center border-b border-border/90 bg-background/88 px-5 backdrop-blur">
            <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
              {title}
            </span>
          </div>
        )}

        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
