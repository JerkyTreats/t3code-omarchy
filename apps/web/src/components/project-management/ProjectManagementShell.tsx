import type { ReactNode } from "react";

import { APP_DISPLAY_NAME } from "~/branding";
import { isElectron } from "~/env";
import { SidebarInset, SidebarTrigger } from "~/components/ui/sidebar";

interface ProjectManagementShellProps {
  readonly children: ReactNode;
  readonly title: string;
}

export function ProjectManagementShell({ children, title }: ProjectManagementShellProps) {
  return (
    <SidebarInset className="h-svh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground md:h-dvh">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {!isElectron ? (
          <header className="border-b border-border bg-background px-3 py-2 sm:px-5">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
              <span className="text-sm font-medium text-foreground">{title}</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {APP_DISPLAY_NAME}
              </span>
            </div>
          </header>
        ) : (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border bg-background px-5 wco:h-[env(titlebar-area-height)] wco:pl-[calc(env(titlebar-area-x)+1em)]">
            <span className="text-xs font-medium text-muted-foreground">{title}</span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
