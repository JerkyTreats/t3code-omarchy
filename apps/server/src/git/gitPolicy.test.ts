import { describe, expect, it } from "vitest";

import {
  buildBlockedPullDetail,
  buildBlockedPushDetail,
  isProtectedRemoteName,
  resolvePublishRemoteName,
  selectPrimaryRemoteName,
} from "./gitPolicy";

describe("gitPolicy", () => {
  describe("isProtectedRemoteName", () => {
    it("treats upstream as protected", () => {
      expect(isProtectedRemoteName("upstream")).toBe(true);
      expect(isProtectedRemoteName(" UpStream ")).toBe(true);
    });

    it("does not treat fork remotes as protected", () => {
      expect(isProtectedRemoteName("origin")).toBe(false);
      expect(isProtectedRemoteName("fork-seed")).toBe(false);
      expect(isProtectedRemoteName(null)).toBe(false);
    });
  });

  describe("selectPrimaryRemoteName", () => {
    it("prefers origin when present", () => {
      expect(selectPrimaryRemoteName(["fork", "origin", "upstream"])).toBe("origin");
    });

    it("falls back to the first remote when origin is absent", () => {
      expect(selectPrimaryRemoteName(["fork", "backup"])).toBe("fork");
    });

    it("returns null when no remotes exist", () => {
      expect(selectPrimaryRemoteName([])).toBeNull();
    });
  });

  describe("resolvePublishRemoteName", () => {
    it("prefers branch push remote over other candidates", () => {
      expect(
        resolvePublishRemoteName({
          branchPushRemote: "fork-branch",
          pushDefaultRemote: "fork-default",
          primaryRemoteName: "origin",
        }),
      ).toBe("fork-branch");
    });

    it("falls back to remote.pushDefault before the primary remote", () => {
      expect(
        resolvePublishRemoteName({
          branchPushRemote: null,
          pushDefaultRemote: "fork-default",
          primaryRemoteName: "origin",
        }),
      ).toBe("fork-default");
    });

    it("falls back to the primary remote when config is absent", () => {
      expect(
        resolvePublishRemoteName({
          branchPushRemote: "",
          pushDefaultRemote: null,
          primaryRemoteName: "origin",
        }),
      ).toBe("origin");
    });
  });

  it("keeps protected remote copy stable", () => {
    expect(buildBlockedPushDetail()).toBe(
      "Push to the upstream remote is blocked. Push to the fork remote instead.",
    );
    expect(buildBlockedPullDetail()).toBe(
      "Pull from the upstream remote is blocked in the Git UI. Use the upstream sync workflow instead.",
    );
  });
});
