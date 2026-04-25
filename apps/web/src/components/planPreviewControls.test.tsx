import { TurnId } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./ChatMarkdown", () => ({
  default: () => <div data-testid="chat-markdown" />,
}));

vi.mock("~/hooks/useTheme", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

import { DocumentMarkdownRenderer } from "./DocumentMarkdownRenderer";
import PlanSidebar from "./PlanSidebar";
import { ProposedPlanCard } from "./chat/ProposedPlanCard";

describe("plan preview controls", () => {
  it("renders a markdown preview action on proposed plan cards", () => {
    const markup = renderToStaticMarkup(
      <ProposedPlanCard
        planMarkdown="# Ship it\n\n- Step one"
        cwd={undefined}
        workspaceRoot={undefined}
        onOpenMarkdownPreview={() => undefined}
      />,
    );

    expect(markup).toContain("Open in Markdown Preview");
  });

  it("renders a markdown preview action in the plan sidebar", () => {
    const markup = renderToStaticMarkup(
      <PlanSidebar
        activePlan={null}
        activeProposedPlan={{
          id: "plan-1",
          turnId: TurnId.makeUnsafe("turn-1"),
          planMarkdown: "# Ship it\n\n- Step one",
          implementedAt: null,
          implementationThreadId: null,
          createdAt: "2026-02-23T00:00:01.000Z",
          updatedAt: "2026-02-23T00:00:02.000Z",
        }}
        markdownCwd={undefined}
        workspaceRoot={undefined}
        timestampFormat="locale"
        onOpenMarkdownPreview={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(markup).toContain("Open in Markdown Preview");
  });

  it("hides the source footer for virtual markdown documents", () => {
    const markup = renderToStaticMarkup(
      <DocumentMarkdownRenderer
        filePath="plan.md"
        markdown="# Ship it\n\n- Step one"
        showSourceFooter={false}
        workspaceCwd={undefined}
        onNavigateToPath={() => undefined}
        onOpenFileInEditor={() => undefined}
      />,
    );

    expect(markup).not.toContain("Open source in editor");
  });
});
