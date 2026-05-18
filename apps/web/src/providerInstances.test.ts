import { describe, expect, it } from "vitest";
import { ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";

import {
  deriveProviderInstanceEntryMap,
  deriveProviderInstanceEntries,
  getProviderInstanceEntry,
  getSelectableProviderInstanceEntry,
  resolveSelectableProviderInstance,
} from "./providerInstances";

const instanceId = (value: string) => ProviderInstanceId.make(value);

function createProvider(
  provider: ServerProvider["provider"],
  overrides: Partial<ServerProvider> = {},
): ServerProvider {
  return {
    provider,
    enabled: true,
    installed: true,
    version: "1.0.0",
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-05-12T00:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
    ...overrides,
  };
}

describe("providerInstances", () => {
  it("projects each provider as a default instance entry", () => {
    const entries = deriveProviderInstanceEntries([
      createProvider("codex", { displayName: "Codex Stable" }),
      createProvider("cursor"),
    ]);

    expect(entries).toEqual([
      expect.objectContaining({
        instanceId: "codex",
        driverKind: "codex",
        displayName: "Codex Stable",
        isDefault: true,
      }),
      expect.objectContaining({
        instanceId: "cursor",
        driverKind: "cursor",
        displayName: "Cursor",
        isDefault: true,
        availability: "ready",
        isAvailable: true,
      }),
    ]);
  });

  it("falls back to the first enabled provider instance", () => {
    const providers = [createProvider("codex", { enabled: false }), createProvider("claudeAgent")];

    expect(getProviderInstanceEntry(providers, instanceId("claudeAgent"))?.instanceId).toBe(
      "claudeAgent",
    );
    expect(resolveSelectableProviderInstance(providers, instanceId("codex"))).toBe("claudeAgent");
    expect(resolveSelectableProviderInstance(providers, undefined)).toBe("claudeAgent");
  });

  it("derives canonical availability from enabled, installed, and runtime status", () => {
    const entries = deriveProviderInstanceEntries([
      createProvider("codex", { enabled: false }),
      createProvider("claudeAgent", { installed: false }),
      createProvider("cursor", { status: "warning" }),
      createProvider("opencode"),
    ]);

    expect(
      entries.map((entry) => [entry.instanceId, entry.availability, entry.isAvailable]),
    ).toEqual([
      ["codex", "disabled", false],
      ["claudeAgent", "not-installed", false],
      ["cursor", "unavailable", false],
      ["opencode", "ready", true],
    ]);
  });

  it("keeps custom instances distinct from default instances of the same driver", () => {
    const entries = deriveProviderInstanceEntries([
      createProvider("codex"),
      createProvider("codex", {
        instanceId: instanceId("codex_work"),
        driver: "codex" as ServerProvider["driver"],
        displayName: "Codex",
        accentColor: "#f97316",
      }),
    ]);

    expect(entries).toEqual([
      expect.objectContaining({
        instanceId: "codex",
        driverKind: "codex",
        displayName: "Codex",
        isDefault: true,
      }),
      expect.objectContaining({
        instanceId: "codex_work",
        driverKind: "codex",
        displayName: "Codex Work",
        accentColor: "#f97316",
        isDefault: false,
      }),
    ]);
  });

  it("exposes map and selectable entry helpers from the same projection", () => {
    const providers = [
      createProvider("codex", { enabled: false, displayName: "Codex Stable" }),
      createProvider("cursor", { status: "warning" }),
      createProvider("opencode"),
    ];

    expect(deriveProviderInstanceEntryMap(providers)[instanceId("codex")]?.displayName).toBe(
      "Codex Stable",
    );
    expect(getSelectableProviderInstanceEntry(providers, instanceId("codex"))?.instanceId).toBe(
      "cursor",
    );
    expect(getSelectableProviderInstanceEntry(providers, instanceId("cursor"))?.availability).toBe(
      "unavailable",
    );
  });
});
