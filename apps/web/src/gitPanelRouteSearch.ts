export interface GitPanelRouteSearch {
  github?: "1" | undefined;
}

function isPanelOpenValue(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}

export function parseGitPanelRouteSearch(search: Record<string, unknown>): GitPanelRouteSearch {
  const github = isPanelOpenValue(search.github) ? "1" : undefined;
  return github ? { github } : {};
}

export function stripGitPanelSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "github"> {
  const { github: _github, ...rest } = params;
  return rest as Omit<T, "github">;
}
