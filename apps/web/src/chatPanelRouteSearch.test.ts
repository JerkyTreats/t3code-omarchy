import { describe, expect, it } from "vitest";

import { parseChatPanelRouteSearch, stripChatPanelSearchParams } from "./chatPanelRouteSearch";

describe("parseChatPanelRouteSearch", () => {
  it("parses fullscreen plan preview mode", () => {
    expect(
      parseChatPanelRouteSearch({
        planPreview: "1",
        planThreadId: "thread-1",
        planId: "plan-1",
      }),
    ).toEqual({
      planPreview: "1",
      planThreadId: "thread-1",
      planId: "plan-1",
    });
  });

  it("drops incomplete fullscreen plan preview mode", () => {
    expect(
      parseChatPanelRouteSearch({
        planPreview: "1",
        planThreadId: "thread-1",
      }),
    ).toEqual({});
  });

  it("parses files panel document mode", () => {
    expect(
      parseChatPanelRouteSearch({
        panel: "files",
        docPath: "README.md",
        docExpanded: "1",
      }),
    ).toEqual({
      panel: "files",
      docPath: "README.md",
      docExpanded: "1",
    });
  });

  it("defaults diff view when opening diff panel", () => {
    expect(
      parseChatPanelRouteSearch({
        panel: "diff",
      }),
    ).toEqual({
      panel: "diff",
      diffView: "diff",
    });
  });
});

describe("stripChatPanelSearchParams", () => {
  it("clears fullscreen plan preview fields", () => {
    expect(
      stripChatPanelSearchParams({
        planPreview: "1",
        planThreadId: "thread-1",
        planId: "plan-1",
        keep: "value",
      }),
    ).toEqual({
      keep: "value",
      panel: undefined,
      diffTurnId: undefined,
      diffFilePath: undefined,
      diffView: undefined,
      docPath: undefined,
      docExpanded: undefined,
      planPreview: undefined,
      planThreadId: undefined,
      planId: undefined,
    });
  });
});
