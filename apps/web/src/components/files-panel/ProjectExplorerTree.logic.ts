import type { GitFileStatus } from "@t3tools/contracts";

export type ExplorerDirectoryStatus = GitFileStatus | "clean";

const DIRECTORY_STATUS_PRIORITY: readonly ExplorerDirectoryStatus[] = [
  "conflicted",
  "modified",
  "added",
  "renamed",
  "untracked",
  "clean",
] as const;

export function ancestorDirectoryPaths(pathValue: string): string[] {
  const segments = pathValue.split("/").filter((segment) => segment.length > 0);
  if (segments.length <= 1) {
    return [];
  }

  const paths: string[] = [];
  for (let index = 1; index < segments.length; index += 1) {
    paths.push(segments.slice(0, index).join("/"));
  }
  return paths;
}

export function aggregateDirectoryGitStatus(
  directoryPath: string,
  statusByPath: ReadonlyMap<string, GitFileStatus>,
): ExplorerDirectoryStatus {
  let bestStatus: ExplorerDirectoryStatus = "clean";
  let bestPriority = DIRECTORY_STATUS_PRIORITY.indexOf(bestStatus);

  for (const [pathValue, status] of statusByPath) {
    if (!pathValue.startsWith(`${directoryPath}/`)) {
      continue;
    }
    const nextPriority = DIRECTORY_STATUS_PRIORITY.indexOf(status);
    if (nextPriority !== -1 && nextPriority < bestPriority) {
      bestStatus = status;
      bestPriority = nextPriority;
      if (bestPriority === 0) {
        return bestStatus;
      }
    }
  }

  return bestStatus;
}
