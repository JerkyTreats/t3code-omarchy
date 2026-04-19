import { describe, expect, it } from "vitest";

import { parseChatPanelRouteSearch } from "./chatPanelRouteSearch";

describe("parseChatPanelRouteSearch", () => {
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
