import type { SidebarProjectSortOrder, SidebarThreadSortOrder } from "@t3tools/contracts/settings";
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
type SidebarProject = {
  id: string;
  name: string;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};
type SidebarThreadSortInput = Pick<Thread, "createdAt" | "updatedAt" | "messages">;

export interface ThreadStatusPill {
  label: string;
  colorClass: string;
  dotClass: string;
  pulse: boolean;
}

const THREAD_STATUS_PRIORITY: Record<ThreadStatusPill["label"], number> = {
  "Pending Approval": 5,
  "Awaiting Input": 4,
  Working: 3,
  Connecting: 3,
  "Plan Ready": 2,
  Completed: 1,
};

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
      return {
        label: activePlanProgress.completedAllSteps
          ? `${activePlanProgress.totalSteps}/${activePlanProgress.totalSteps}`
          : `${activePlanProgress.currentStepNumber}/${activePlanProgress.totalSteps}`,
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

export function resolveProjectStatusIndicator(
  statuses: ReadonlyArray<ThreadStatusPill | null>,
): ThreadStatusPill | null {
  let highestPriorityStatus: ThreadStatusPill | null = null;

  for (const status of statuses) {
    if (status === null) continue;
    const statusPriority = THREAD_STATUS_PRIORITY[status.label] ?? 0;
    const currentPriority =
      highestPriorityStatus === null
        ? -1
        : (THREAD_STATUS_PRIORITY[highestPriorityStatus.label] ?? 0);
    if (highestPriorityStatus === null || statusPriority > currentPriority) {
      highestPriorityStatus = status;
    }
  }

  return highestPriorityStatus;
}

export function getVisibleThreadsForProject(input: {
  threads: readonly Thread[];
  activeThreadId: Thread["id"] | undefined;
  isThreadListExpanded: boolean;
  previewLimit: number;
}): {
  hasHiddenThreads: boolean;
  visibleThreads: Thread[];
} {
  const { activeThreadId, isThreadListExpanded, previewLimit, threads } = input;
  const hasHiddenThreads = threads.length > previewLimit;

  if (!hasHiddenThreads || isThreadListExpanded) {
    return {
      hasHiddenThreads,
      visibleThreads: [...threads],
    };
  }

  const previewThreads = threads.slice(0, previewLimit);
  if (!activeThreadId || previewThreads.some((thread) => thread.id === activeThreadId)) {
    return {
      hasHiddenThreads: true,
      visibleThreads: previewThreads,
    };
  }

  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  if (!activeThread) {
    return {
      hasHiddenThreads: true,
      visibleThreads: previewThreads,
    };
  }

  const visibleThreadIds = new Set([...previewThreads, activeThread].map((thread) => thread.id));

  return {
    hasHiddenThreads: true,
    visibleThreads: threads.filter((thread) => visibleThreadIds.has(thread.id)),
  };
}

function toSortableTimestamp(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function getLatestUserMessageTimestamp(thread: SidebarThreadSortInput): number {
  let latestUserMessageTimestamp: number | null = null;

  for (const message of thread.messages) {
    if (message.role !== "user") continue;
    const messageTimestamp = toSortableTimestamp(message.createdAt);
    if (messageTimestamp === null) continue;
    latestUserMessageTimestamp =
      latestUserMessageTimestamp === null
        ? messageTimestamp
        : Math.max(latestUserMessageTimestamp, messageTimestamp);
  }

  if (latestUserMessageTimestamp !== null) {
    return latestUserMessageTimestamp;
  }

  return toSortableTimestamp(thread.updatedAt ?? thread.createdAt) ?? Number.NEGATIVE_INFINITY;
}

function getThreadSortTimestamp(
  thread: SidebarThreadSortInput,
  sortOrder: SidebarThreadSortOrder | Exclude<SidebarProjectSortOrder, "manual">,
): number {
  if (sortOrder === "created_at") {
    return toSortableTimestamp(thread.createdAt) ?? Number.NEGATIVE_INFINITY;
  }
  return getLatestUserMessageTimestamp(thread);
}

export function sortThreadsForSidebar<
  T extends Pick<Thread, "id" | "createdAt" | "updatedAt" | "messages">,
>(threads: readonly T[], sortOrder: SidebarThreadSortOrder): T[] {
  return threads.toSorted((left, right) => {
    const rightTimestamp = getThreadSortTimestamp(right, sortOrder);
    const leftTimestamp = getThreadSortTimestamp(left, sortOrder);
    const byTimestamp =
      rightTimestamp === leftTimestamp ? 0 : rightTimestamp > leftTimestamp ? 1 : -1;
    if (byTimestamp !== 0) return byTimestamp;
    return right.id.localeCompare(left.id);
  });
}

export function getFallbackThreadIdAfterDelete<
  T extends Pick<Thread, "id" | "projectId" | "createdAt" | "updatedAt" | "messages">,
>(input: {
  threads: readonly T[];
  deletedThreadId: T["id"];
  sortOrder: SidebarThreadSortOrder;
  deletedThreadIds?: ReadonlySet<T["id"]>;
}): T["id"] | null {
  const { deletedThreadId, deletedThreadIds, sortOrder, threads } = input;
  const deletedThread = threads.find((thread) => thread.id === deletedThreadId);
  if (!deletedThread) {
    return null;
  }

  return (
    sortThreadsForSidebar(
      threads.filter(
        (thread) =>
          thread.projectId === deletedThread.projectId &&
          thread.id !== deletedThreadId &&
          !deletedThreadIds?.has(thread.id),
      ),
      sortOrder,
    )[0]?.id ?? null
  );
}

export function getProjectSortTimestamp(
  project: SidebarProject,
  projectThreads: readonly SidebarThreadSortInput[],
  sortOrder: Exclude<SidebarProjectSortOrder, "manual">,
): number {
  if (projectThreads.length > 0) {
    return projectThreads.reduce(
      (latest, thread) => Math.max(latest, getThreadSortTimestamp(thread, sortOrder)),
      Number.NEGATIVE_INFINITY,
    );
  }

  if (sortOrder === "created_at") {
    return toSortableTimestamp(project.createdAt) ?? Number.NEGATIVE_INFINITY;
  }
  return toSortableTimestamp(project.updatedAt ?? project.createdAt) ?? Number.NEGATIVE_INFINITY;
}

export function sortProjectsForSidebar<TProject extends SidebarProject, TThread extends Thread>(
  projects: readonly TProject[],
  threads: readonly TThread[],
  sortOrder: SidebarProjectSortOrder,
): TProject[] {
  if (sortOrder === "manual") {
    return [...projects];
  }

  const threadsByProjectId = new Map<string, TThread[]>();
  for (const thread of threads) {
    const existing = threadsByProjectId.get(thread.projectId) ?? [];
    existing.push(thread);
    threadsByProjectId.set(thread.projectId, existing);
  }

  return [...projects].toSorted((left, right) => {
    const rightTimestamp = getProjectSortTimestamp(
      right,
      threadsByProjectId.get(right.id) ?? [],
      sortOrder,
    );
    const leftTimestamp = getProjectSortTimestamp(
      left,
      threadsByProjectId.get(left.id) ?? [],
      sortOrder,
    );
    const byTimestamp =
      rightTimestamp === leftTimestamp ? 0 : rightTimestamp > leftTimestamp ? 1 : -1;
    if (byTimestamp !== 0) return byTimestamp;
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
  });
}
