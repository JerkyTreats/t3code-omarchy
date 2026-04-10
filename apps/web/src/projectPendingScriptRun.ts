import { type ProjectId, type ThreadId } from "@t3tools/contracts";

interface PendingProjectScriptRun {
  projectId: ProjectId;
  scriptId: string;
}

const pendingRunsByThreadId = new Map<ThreadId, PendingProjectScriptRun>();

export function schedulePendingProjectScriptRun(input: {
  threadId: ThreadId;
  projectId: ProjectId;
  scriptId: string;
}) {
  pendingRunsByThreadId.set(input.threadId, {
    projectId: input.projectId,
    scriptId: input.scriptId,
  });
}

export function consumePendingProjectScriptRun(threadId: ThreadId): PendingProjectScriptRun | null {
  const pending = pendingRunsByThreadId.get(threadId) ?? null;
  pendingRunsByThreadId.delete(threadId);
  return pending;
}

export function resetPendingProjectScriptRunsForTests() {
  pendingRunsByThreadId.clear();
}
