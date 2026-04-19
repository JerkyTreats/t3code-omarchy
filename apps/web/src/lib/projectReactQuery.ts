import type { ProjectListDirectoryResult, ProjectSearchEntriesResult } from "@t3tools/contracts";
import { queryOptions } from "@tanstack/react-query";
import { ensureNativeApi } from "~/nativeApi";

export const projectQueryKeys = {
  all: ["projects"] as const,
  listDirectory: (cwd: string | null, directoryPath: string | null, limit: number) =>
    ["projects", "list-directory", cwd, directoryPath, limit] as const,
  readFile: (cwd: string | null, relativePath: string | null) =>
    ["projects", "read-file", cwd, relativePath] as const,
  searchEntries: (cwd: string | null, query: string, limit: number) =>
    ["projects", "search-entries", cwd, query, limit] as const,
};

const DEFAULT_DIRECTORY_LIST_LIMIT = 200;
const DEFAULT_SEARCH_ENTRIES_LIMIT = 80;
const DEFAULT_PROJECT_READ_FILE_STALE_TIME = 5_000;
const DEFAULT_SEARCH_ENTRIES_STALE_TIME = 15_000;
const EMPTY_DIRECTORY_LIST_RESULT: ProjectListDirectoryResult = {
  entries: [],
  truncated: false,
};
const EMPTY_SEARCH_ENTRIES_RESULT: ProjectSearchEntriesResult = {
  entries: [],
  truncated: false,
};
export function projectListDirectoryQueryOptions(input: {
  cwd: string | null;
  directoryPath: string | null;
  enabled?: boolean;
  limit?: number;
  staleTime?: number;
}) {
  const limit = input.limit ?? DEFAULT_DIRECTORY_LIST_LIMIT;
  return queryOptions({
    queryKey: projectQueryKeys.listDirectory(input.cwd, input.directoryPath, limit),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) {
        throw new Error("Workspace directory listing is unavailable.");
      }
      return api.projects.listDirectory({
        cwd: input.cwd,
        directoryPath: input.directoryPath,
        limit,
      });
    },
    enabled: (input.enabled ?? true) && input.cwd !== null,
    staleTime: input.staleTime ?? DEFAULT_SEARCH_ENTRIES_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_DIRECTORY_LIST_RESULT,
  });
}

export function projectReadFileQueryOptions(input: {
  cwd: string | null;
  relativePath: string | null;
  enabled?: boolean;
  staleTime?: number;
}) {
  return queryOptions({
    queryKey: projectQueryKeys.readFile(input.cwd, input.relativePath),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd || !input.relativePath) {
        throw new Error("Workspace file preview is unavailable.");
      }
      return api.projects.readFile({
        cwd: input.cwd,
        relativePath: input.relativePath,
      });
    },
    enabled:
      (input.enabled ?? true) &&
      input.cwd !== null &&
      typeof input.relativePath === "string" &&
      input.relativePath.trim().length > 0,
    staleTime: input.staleTime ?? DEFAULT_PROJECT_READ_FILE_STALE_TIME,
  });
}

export function projectSearchEntriesQueryOptions(input: {
  cwd: string | null;
  query: string;
  enabled?: boolean;
  limit?: number;
  staleTime?: number;
}) {
  const limit = input.limit ?? DEFAULT_SEARCH_ENTRIES_LIMIT;
  return queryOptions({
    queryKey: projectQueryKeys.searchEntries(input.cwd, input.query, limit),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) {
        throw new Error("Workspace entry search is unavailable.");
      }
      return api.projects.searchEntries({
        cwd: input.cwd,
        query: input.query,
        limit,
      });
    },
    enabled: (input.enabled ?? true) && input.cwd !== null && input.query.length > 0,
    staleTime: input.staleTime ?? DEFAULT_SEARCH_ENTRIES_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_SEARCH_ENTRIES_RESULT,
  });
}
