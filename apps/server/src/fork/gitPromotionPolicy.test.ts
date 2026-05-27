import { describe, expect, it } from "vitest";

import {
  choosePromotePushRemoteName,
  parseRemoteNames,
  parseRemoteRefWithRemoteNames,
} from "./gitPromotionPolicy.ts";

describe("gitPromotionPolicy", () => {
  it("parses remote names from git remote output", () => {
    expect(parseRemoteNames("origin\nupstream\n\n")).toEqual(["origin", "upstream"]);
  });

  it("parses remote refs with slash names", () => {
    expect(parseRemoteRefWithRemoteNames("fork/team/feature/test", ["fork/team", "fork"])).toEqual({
      remoteName: "fork/team",
      remoteBranch: "feature/test",
    });
  });

  it("prefers the upstream remote for backup pushes", () => {
    expect(
      choosePromotePushRemoteName({
        remoteNames: ["origin", "upstream"],
        upstreamRef: "upstream/feature/test",
        branchPushRemote: "branch-push",
        pushDefaultRemote: "push-default",
      }),
    ).toBe("upstream");
  });

  it("falls back through push config and origin", () => {
    expect(
      choosePromotePushRemoteName({
        remoteNames: ["origin", "upstream"],
        upstreamRef: null,
        branchPushRemote: "origin",
        pushDefaultRemote: "upstream",
      }),
    ).toBe("origin");

    expect(
      choosePromotePushRemoteName({
        remoteNames: ["origin", "upstream"],
        upstreamRef: null,
        branchPushRemote: null,
        pushDefaultRemote: "upstream",
      }),
    ).toBe("upstream");

    expect(
      choosePromotePushRemoteName({
        remoteNames: ["origin", "upstream"],
        upstreamRef: null,
        branchPushRemote: null,
        pushDefaultRemote: null,
      }),
    ).toBe("origin");
  });
});
