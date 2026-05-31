import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

interface ProjectMetricCardProps {
  readonly detail?: ReactNode;
  readonly label: string;
  readonly value: ReactNode;
  readonly className?: string;
}

export function ProjectMetricCard({ className, detail, label, value }: ProjectMetricCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card px-4 py-3 shadow-sm", className)}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
      {detail ? <div className="mt-1 text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
}
