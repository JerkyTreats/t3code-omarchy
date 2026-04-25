import { ThreadId, TurnId, type OrchestrationProposedPlanId } from "@t3tools/contracts";

export interface ChatPanelRouteSearch {
  panel?: "diff" | "git" | "files" | undefined;
  diffTurnId?: TurnId | undefined;
  diffFilePath?: string | undefined;
  diffView?: "preview" | "diff" | undefined;
  docPath?: string | undefined;
  docExpanded?: "1" | undefined;
  planPreview?: "1" | undefined;
  planThreadId?: ThreadId | undefined;
  planId?: OrchestrationProposedPlanId | undefined;
}

function isPanelOpenValue(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}

function normalizeSearchString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function stripChatPanelSearchParams<T extends Record<string, unknown>>(
  params: T,
): T & ChatPanelRouteSearch {
  const {
    panel: _panel,
    diffTurnId: _diffTurnId,
    diffFilePath: _diffFilePath,
    diffView: _diffView,
    docPath: _docPath,
    docExpanded: _docExpanded,
    planPreview: _planPreview,
    planThreadId: _planThreadId,
    planId: _planId,
    ...rest
  } = params;
  return {
    ...rest,
    panel: undefined,
    diffTurnId: undefined,
    diffFilePath: undefined,
    diffView: undefined,
    docPath: undefined,
    docExpanded: undefined,
    planPreview: undefined,
    planThreadId: undefined,
    planId: undefined,
  } as T & ChatPanelRouteSearch;
}

export function parseChatPanelRouteSearch(search: Record<string, unknown>): ChatPanelRouteSearch {
  const planThreadIdRaw = normalizeSearchString(search.planThreadId);
  const planIdRaw = normalizeSearchString(search.planId);
  if (isPanelOpenValue(search.planPreview) && planThreadIdRaw && planIdRaw) {
    return {
      planPreview: "1",
      planThreadId: ThreadId.makeUnsafe(planThreadIdRaw),
      planId: planIdRaw as OrchestrationProposedPlanId,
    };
  }

  const panelRaw = normalizeSearchString(search.panel);
  const panel =
    panelRaw === "diff" || panelRaw === "git" || panelRaw === "files" ? panelRaw : undefined;

  if (!panel) {
    return {};
  }

  if (panel === "git") {
    return { panel };
  }

  if (panel === "files") {
    const docPath = normalizeSearchString(search.docPath);
    const docExpanded = docPath && isPanelOpenValue(search.docExpanded) ? "1" : undefined;
    return {
      panel,
      ...(docPath ? { docPath } : {}),
      ...(docExpanded ? { docExpanded } : {}),
    };
  }

  const diffTurnIdRaw = normalizeSearchString(search.diffTurnId);
  const diffTurnId = diffTurnIdRaw ? TurnId.makeUnsafe(diffTurnIdRaw) : undefined;
  const diffFilePath = diffTurnId ? normalizeSearchString(search.diffFilePath) : undefined;
  const diffViewRaw = normalizeSearchString(search.diffView);
  const diffView =
    diffViewRaw === "preview" || diffViewRaw === "diff"
      ? diffViewRaw
      : diffFilePath
        ? "preview"
        : "diff";

  return {
    panel,
    ...(diffTurnId ? { diffTurnId } : {}),
    ...(diffFilePath ? { diffFilePath } : {}),
    ...(diffView ? { diffView } : {}),
  };
}
