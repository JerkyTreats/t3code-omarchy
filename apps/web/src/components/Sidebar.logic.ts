import type { Thread } from "../types";
import { cn } from "../lib/utils";
import {
  compareActivitiesByOrder,
  deriveActivePlanState,
  findLatestProposedPlan,
  hasActionableProposedPlan,
  isLatestTurnSettled,
  isThreadRuntimeConnecting,
  isThreadRuntimeWorking,
} from "../session-logic";

export const THREAD_SELECTION_SAFE_SELECTOR = "[data-thread-item], [data-thread-selection-safe]";
export type SidebarNewThreadEnvMode = "local" | "worktree";

export interface ThreadStatusPill {
  label: string;
  colorClass: string;
  dotClass: string;
  pulse: boolean;
}

type ThreadStatusInput = Pick<
  Thread,
  | "interactionMode"
  | "latestTurn"
  | "lastVisitedAt"
  | "proposedPlans"
  | "runtime"
  | "session"
  | "activities"
>;

export interface ThreadActivityStatusFlags {
  hasPendingApprovals: boolean;
  hasPendingUserInput: boolean;
}

function hasApprovalRequestKind(payload: Record<string, unknown> | null): boolean {
  if (!payload) {
    return false;
  }
  if (
    payload.requestKind === "command" ||
    payload.requestKind === "file-read" ||
    payload.requestKind === "file-change"
  ) {
    return true;
  }
  return (
    payload.requestType === "command_execution_approval" ||
    payload.requestType === "exec_command_approval" ||
    payload.requestType === "file_read_approval" ||
    payload.requestType === "file_change_approval" ||
    payload.requestType === "apply_patch_approval"
  );
}

export function deriveThreadActivityStatusFlags(
  activities: Thread["activities"],
): ThreadActivityStatusFlags {
  const latestApprovalStateByRequestId = new Map<string, "requested" | "resolved">();
  const latestApprovalActivityByRequestId = new Map<string, Thread["activities"][number]>();
  const latestUserInputStateByRequestId = new Map<string, "requested" | "resolved">();
  const latestUserInputActivityByRequestId = new Map<string, Thread["activities"][number]>();

  for (const activity of activities) {
    const payload =
      activity.payload && typeof activity.payload === "object"
        ? (activity.payload as Record<string, unknown>)
        : null;
    const requestId = typeof payload?.requestId === "string" ? payload.requestId : null;
    const detail = typeof payload?.detail === "string" ? payload.detail : null;

    if (activity.kind === "approval.requested" && requestId && hasApprovalRequestKind(payload)) {
      const previousActivity = latestApprovalActivityByRequestId.get(requestId);
      if (!previousActivity || compareActivitiesByOrder(activity, previousActivity) > 0) {
        latestApprovalActivityByRequestId.set(requestId, activity);
        latestApprovalStateByRequestId.set(requestId, "requested");
      }
      continue;
    }

    if (activity.kind === "approval.resolved" && requestId) {
      const previousActivity = latestApprovalActivityByRequestId.get(requestId);
      if (!previousActivity || compareActivitiesByOrder(activity, previousActivity) > 0) {
        latestApprovalActivityByRequestId.set(requestId, activity);
        latestApprovalStateByRequestId.set(requestId, "resolved");
      }
      continue;
    }

    if (
      activity.kind === "provider.approval.respond.failed" &&
      requestId &&
      detail?.includes("Unknown pending permission request")
    ) {
      const previousActivity = latestApprovalActivityByRequestId.get(requestId);
      if (!previousActivity || compareActivitiesByOrder(activity, previousActivity) > 0) {
        latestApprovalActivityByRequestId.set(requestId, activity);
        latestApprovalStateByRequestId.set(requestId, "resolved");
      }
      continue;
    }

    if (
      activity.kind === "user-input.requested" &&
      requestId &&
      Array.isArray(payload?.questions)
    ) {
      const previousActivity = latestUserInputActivityByRequestId.get(requestId);
      if (!previousActivity || compareActivitiesByOrder(activity, previousActivity) > 0) {
        latestUserInputActivityByRequestId.set(requestId, activity);
        latestUserInputStateByRequestId.set(requestId, "requested");
      }
      continue;
    }

    if (activity.kind === "user-input.resolved" && requestId) {
      const previousActivity = latestUserInputActivityByRequestId.get(requestId);
      if (!previousActivity || compareActivitiesByOrder(activity, previousActivity) > 0) {
        latestUserInputActivityByRequestId.set(requestId, activity);
        latestUserInputStateByRequestId.set(requestId, "resolved");
      }
    }
  }

  return {
    hasPendingApprovals: [...latestApprovalStateByRequestId.values()].some(
      (state) => state === "requested",
    ),
    hasPendingUserInput: [...latestUserInputStateByRequestId.values()].some(
      (state) => state === "requested",
    ),
  };
}

function deriveActivePlanProgress(thread: ThreadStatusInput): {
  completedAllSteps: boolean;
  currentStepNumber: number;
  totalSteps: number;
} | null {
  const activePlan = deriveActivePlanState(
    thread.activities,
    thread.latestTurn?.turnId ?? undefined,
  );
  if (!activePlan) {
    return null;
  }

  let completedCount = 0;
  let currentStepNumber = -1;
  let totalSteps = 0;

  for (const step of activePlan.steps) {
    totalSteps += 1;
    if (step.status === "completed") {
      completedCount += 1;
      continue;
    }
    if (step.status === "inProgress" && currentStepNumber < 0) {
      currentStepNumber = totalSteps;
    }
  }

  if (completedCount >= totalSteps) {
    return {
      completedAllSteps: true,
      currentStepNumber: totalSteps,
      totalSteps,
    };
  }

  return {
    completedAllSteps: false,
    currentStepNumber: currentStepNumber > 0 ? currentStepNumber : completedCount + 1,
    totalSteps,
  };
}

export function hasUnseenCompletion(thread: ThreadStatusInput): boolean {
  if (!thread.latestTurn?.completedAt) return false;
  const completedAt = Date.parse(thread.latestTurn.completedAt);
  if (Number.isNaN(completedAt)) return false;
  if (!thread.lastVisitedAt) return true;

  const lastVisitedAt = Date.parse(thread.lastVisitedAt);
  if (Number.isNaN(lastVisitedAt)) return true;
  return completedAt > lastVisitedAt;
}

export function shouldClearThreadSelectionOnMouseDown(target: HTMLElement | null): boolean {
  if (target === null) return true;
  return !target.closest(THREAD_SELECTION_SAFE_SELECTOR);
}

export function resolveSidebarNewThreadEnvMode(input: {
  requestedEnvMode?: SidebarNewThreadEnvMode;
  defaultEnvMode: SidebarNewThreadEnvMode;
}): SidebarNewThreadEnvMode {
  return input.requestedEnvMode ?? input.defaultEnvMode;
}

export function resolveThreadRowClassName(input: {
  isActive: boolean;
  isSelected: boolean;
}): string {
  const baseClassName =
    "h-7 w-full translate-x-0 cursor-pointer justify-start px-2 text-left select-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring";

  if (input.isSelected && input.isActive) {
    return cn(
      baseClassName,
      "bg-primary/22 text-foreground font-medium hover:bg-primary/26 hover:text-foreground dark:bg-primary/30 dark:hover:bg-primary/36",
    );
  }

  if (input.isSelected) {
    return cn(
      baseClassName,
      "bg-primary/15 text-foreground hover:bg-primary/19 hover:text-foreground dark:bg-primary/22 dark:hover:bg-primary/28",
    );
  }

  if (input.isActive) {
    return cn(
      baseClassName,
      "bg-accent/85 text-foreground font-medium hover:bg-accent hover:text-foreground dark:bg-accent/55 dark:hover:bg-accent/70",
    );
  }

  return cn(baseClassName, "text-muted-foreground hover:bg-accent hover:text-foreground");
}

export function resolveThreadStatusPill(input: {
  thread: ThreadStatusInput;
  hasPendingApprovals: boolean;
  hasPendingUserInput: boolean;
}): ThreadStatusPill | null {
  const { hasPendingApprovals, hasPendingUserInput, thread } = input;

  if (hasPendingApprovals) {
    return {
      label: "Pending Approval",
      colorClass: "text-amber-600 dark:text-amber-300/90",
      dotClass: "bg-amber-500 dark:bg-amber-300/90",
      pulse: false,
    };
  }

  if (hasPendingUserInput) {
    return {
      label: "Awaiting Input",
      colorClass: "text-indigo-600 dark:text-indigo-300/90",
      dotClass: "bg-indigo-500 dark:bg-indigo-300/90",
      pulse: false,
    };
  }

  const activePlanProgress = deriveActivePlanProgress(thread);

  if (thread.runtime?.turnStatus === "pending") {
    return {
      label: "Working",
      colorClass: "text-sky-600 dark:text-sky-300/80",
      dotClass: "bg-sky-500 dark:bg-sky-300/80",
      pulse: true,
    };
  }

  if (thread.runtime?.turnStatus === "running" || isThreadRuntimeWorking(thread.runtime)) {
    if (activePlanProgress) {
      if (activePlanProgress.completedAllSteps) {
        return {
          label: "Completed",
          colorClass: "text-emerald-600 dark:text-emerald-300/90",
          dotClass: "bg-emerald-500 dark:bg-emerald-300/90",
          pulse: false,
        };
      }
      return {
        label: `${activePlanProgress.currentStepNumber}/${activePlanProgress.totalSteps}`,
        colorClass: "text-sky-600 dark:text-sky-300/80",
        dotClass: "bg-sky-500 dark:bg-sky-300/80",
        pulse: true,
      };
    }
    return {
      label: "Working",
      colorClass: "text-sky-600 dark:text-sky-300/80",
      dotClass: "bg-sky-500 dark:bg-sky-300/80",
      pulse: true,
    };
  }

  if (isThreadRuntimeConnecting(thread.runtime)) {
    return {
      label: "Connecting",
      colorClass: "text-sky-600 dark:text-sky-300/80",
      dotClass: "bg-sky-500 dark:bg-sky-300/80",
      pulse: true,
    };
  }

  const hasPlanReadyPrompt =
    !hasPendingUserInput &&
    thread.interactionMode === "plan" &&
    isLatestTurnSettled(thread.latestTurn, thread.session) &&
    hasActionableProposedPlan(
      findLatestProposedPlan(thread.proposedPlans, thread.latestTurn?.turnId ?? null),
    );
  if (hasPlanReadyPrompt) {
    return {
      label: "Plan Ready",
      colorClass: "text-violet-600 dark:text-violet-300/90",
      dotClass: "bg-violet-500 dark:bg-violet-300/90",
      pulse: false,
    };
  }

  if (hasUnseenCompletion(thread)) {
    return {
      label: "Completed",
      colorClass: "text-emerald-600 dark:text-emerald-300/90",
      dotClass: "bg-emerald-500 dark:bg-emerald-300/90",
      pulse: false,
    };
  }

  return null;
}
