import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import { describe, expect, it } from "vitest";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";

import { readClientSettings } from "./clientPersistence.ts";

describe("readClientSettings", () => {
  it("fills defaults for legacy partial client settings", () => {
    const directory = FS.mkdtempSync(Path.join(OS.tmpdir(), "t3code-client-settings-"));
    const settingsPath = Path.join(directory, "settings.json");

    try {
      FS.writeFileSync(
        settingsPath,
        JSON.stringify({
          settings: {
            confirmThreadArchive: true,
          },
        }),
        "utf8",
      );

      expect(readClientSettings(settingsPath)).toEqual({
        ...DEFAULT_CLIENT_SETTINGS,
        confirmThreadArchive: true,
      });
    } finally {
      FS.rmSync(directory, { recursive: true, force: true });
    }
  });
});
