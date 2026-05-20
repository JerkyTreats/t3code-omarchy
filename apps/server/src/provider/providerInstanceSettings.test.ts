import {
  DEFAULT_SERVER_SETTINGS,
  ProviderInstanceId,
  type ProviderDriverKind,
} from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import { resolveProviderInstanceRoute } from "./providerInstanceSettings.ts";

describe("resolveProviderInstanceRoute", () => {
  it("resolves default provider instance ids without a provider hint", () => {
    const route = resolveProviderInstanceRoute({
      settings: DEFAULT_SERVER_SETTINGS,
      instanceId: ProviderInstanceId.make("claudeAgent"),
    });

    expect(route).toMatchObject({
      instanceId: "claudeAgent",
      provider: "claudeAgent",
      isDefault: true,
    });
  });

  it("does not route unknown instance ids to codex without a provider hint", () => {
    const route = resolveProviderInstanceRoute({
      settings: DEFAULT_SERVER_SETTINGS,
      instanceId: ProviderInstanceId.make("customClaude"),
    });

    expect(route).toBeUndefined();
  });

  it("falls back to the requested provider default when an instance id conflicts", () => {
    const route = resolveProviderInstanceRoute({
      settings: DEFAULT_SERVER_SETTINGS,
      provider: "claudeAgent",
      instanceId: ProviderInstanceId.make("codex"),
    });

    expect(route).toMatchObject({
      instanceId: "claudeAgent",
      provider: "claudeAgent",
      isDefault: true,
    });
  });

  it("falls back to the requested provider default when a configured instance conflicts", () => {
    const route = resolveProviderInstanceRoute({
      settings: {
        ...DEFAULT_SERVER_SETTINGS,
        providerInstances: {
          [ProviderInstanceId.make("codexWork")]: {
            driver: "codex" as ProviderDriverKind,
          },
        },
      },
      provider: "claudeAgent",
      instanceId: ProviderInstanceId.make("codexWork"),
    });

    expect(route).toMatchObject({
      instanceId: "claudeAgent",
      provider: "claudeAgent",
      isDefault: true,
    });
  });
});
