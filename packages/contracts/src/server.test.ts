import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ServerProvider } from "./server.ts";

const decodeServerProvider = Schema.decodeUnknownSync(ServerProvider);

describe("ServerProvider", () => {
  it("defaults capability arrays when decoding legacy snapshots", () => {
    const parsed = decodeServerProvider({
      provider: "codex",
      enabled: true,
      installed: true,
      version: "1.0.0",
      status: "ready",
      auth: {
        status: "authenticated",
      },
      checkedAt: "2026-04-10T00:00:00.000Z",
      models: [],
    });

    expect(parsed.slashCommands).toEqual([]);
    expect(parsed.skills).toEqual([]);
  });

  it("decodes instance-aware provider snapshots", () => {
    const parsed = decodeServerProvider({
      provider: "codex",
      instanceId: "codex_work",
      driver: "codex",
      displayName: "Codex Work",
      accentColor: "#f97316",
      continuation: { groupKey: "codex:work" },
      availability: "available",
      enabled: true,
      installed: true,
      version: "1.0.0",
      status: "ready",
      auth: {
        status: "authenticated",
      },
      checkedAt: "2026-04-10T00:00:00.000Z",
      models: [],
    });

    expect(parsed.instanceId).toBe("codex_work");
    expect(parsed.driver).toBe("codex");
    expect(parsed.displayName).toBe("Codex Work");
    expect(parsed.continuation?.groupKey).toBe("codex:work");
  });
});
