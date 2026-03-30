import { describe, expect, it } from "vitest";

import { selectStorageConfig } from "./storageConfig";

describe("selectStorageConfig", () => {
  it("prefers explicit home directories over legacy state directories", () => {
    expect(
      selectStorageConfig({
        cliHomeDir: "/tmp/cli-home",
        envHomeDir: "/tmp/env-home",
        legacyStateDir: "/tmp/legacy-home/userdata",
        bootstrapHomeDir: "/tmp/bootstrap-home",
      }),
    ).toEqual({
      kind: "baseDir",
      value: "/tmp/cli-home",
    });

    expect(
      selectStorageConfig({
        envHomeDir: "/tmp/env-home",
        cliHomeDir: undefined,
        legacyStateDir: "/tmp/legacy-home/userdata",
        bootstrapHomeDir: "/tmp/bootstrap-home",
      }),
    ).toEqual({
      kind: "baseDir",
      value: "/tmp/env-home",
    });
  });

  it("prefers legacy state directories over bootstrap home defaults", () => {
    expect(
      selectStorageConfig({
        cliHomeDir: undefined,
        envHomeDir: undefined,
        legacyStateDir: "/tmp/legacy-home/userdata",
        bootstrapHomeDir: "/tmp/bootstrap-home",
      }),
    ).toEqual({
      kind: "legacyStateDir",
      value: "/tmp/legacy-home/userdata",
    });
  });

  it("falls back to bootstrap home when nothing else is configured", () => {
    expect(
      selectStorageConfig({
        cliHomeDir: undefined,
        envHomeDir: undefined,
        legacyStateDir: undefined,
        bootstrapHomeDir: "/tmp/bootstrap-home",
      }),
    ).toEqual({
      kind: "baseDir",
      value: "/tmp/bootstrap-home",
    });
  });
});
