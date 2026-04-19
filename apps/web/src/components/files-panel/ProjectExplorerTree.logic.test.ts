import { describe, expect, it } from "vitest";

import { aggregateDirectoryGitStatus, ancestorDirectoryPaths } from "./ProjectExplorerTree.logic";

describe("ancestorDirectoryPaths", () => {
  it("returns all ancestor directories for a nested file", () => {
    expect(ancestorDirectoryPaths("apps/web/src/index.ts")).toEqual([
      "apps",
      "apps/web",
      "apps/web/src",
    ]);
  });
});

describe("aggregateDirectoryGitStatus", () => {
  it("uses the highest priority descendant state", () => {
    const statusByPath = new Map([
      ["apps/web/src/index.ts", "modified" as const],
      ["apps/web/src/app.ts", "conflicted" as const],
    ]);

    expect(aggregateDirectoryGitStatus("apps/web", statusByPath)).toBe("conflicted");
  });
});
