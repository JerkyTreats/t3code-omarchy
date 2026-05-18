import * as NodeServices from "@effect/platform-node/NodeServices";
import type { ServerProvider } from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";
import { Effect, FileSystem } from "effect";

import {
  hydrateCachedProvider,
  orderProviderSnapshots,
  providerSnapshotKey,
  readProviderStatusCache,
  resolveProviderStatusCachePath,
  writeProviderStatusCache,
} from "./providerStatusCache.ts";

const makeProvider = (
  provider: ServerProvider["provider"],
  overrides?: Partial<ServerProvider>,
): ServerProvider => ({
  provider,
  enabled: true,
  installed: true,
  version: "1.0.0",
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt: "2026-04-11T00:00:00.000Z",
  models: [],
  slashCommands: [],
  skills: [],
  ...overrides,
});

it.layer(NodeServices.layer)("providerStatusCache", (it) => {
  it.effect("writes and reads provider status snapshots", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-provider-cache-" });
      const codexProvider = makeProvider("codex");
      const claudeProvider = makeProvider("claudeAgent", {
        status: "warning",
        auth: { status: "unknown" },
      });
      const codexPath = resolveProviderStatusCachePath({
        cacheDir: tempDir,
        provider: "codex",
      });
      const claudePath = resolveProviderStatusCachePath({
        cacheDir: tempDir,
        provider: "claudeAgent",
      });

      yield* writeProviderStatusCache({
        filePath: codexPath,
        provider: codexProvider,
      });
      yield* writeProviderStatusCache({
        filePath: claudePath,
        provider: claudeProvider,
      });

      assert.deepStrictEqual(yield* readProviderStatusCache(codexPath), {
        provider: codexProvider.provider,
        enabled: codexProvider.enabled,
        installed: codexProvider.installed,
        version: codexProvider.version,
        status: codexProvider.status,
        auth: codexProvider.auth,
        checkedAt: codexProvider.checkedAt,
        models: codexProvider.models,
        slashCommands: codexProvider.slashCommands,
        skills: codexProvider.skills,
      });
      assert.deepStrictEqual(yield* readProviderStatusCache(claudePath), {
        provider: claudeProvider.provider,
        enabled: claudeProvider.enabled,
        installed: claudeProvider.installed,
        version: claudeProvider.version,
        status: claudeProvider.status,
        auth: claudeProvider.auth,
        checkedAt: claudeProvider.checkedAt,
        models: claudeProvider.models,
        slashCommands: claudeProvider.slashCommands,
        skills: claudeProvider.skills,
      });
    }),
  );

  it("hydrates cached provider status while preserving current settings-derived models", () => {
    const cachedCodex = makeProvider("codex", {
      checkedAt: "2026-04-10T12:00:00.000Z",
      models: [
        {
          slug: "gpt-5-mini",
          name: "GPT-5 Mini",
          isCustom: false,
          capabilities: {
            reasoningEffortLevels: [],
            supportsFastMode: false,
            supportsThinkingToggle: false,
            contextWindowOptions: [],
            promptInjectedEffortLevels: [],
          },
        },
      ],
      message: "Cached message",
    });
    const fallbackCodex = makeProvider("codex", {
      models: [
        {
          slug: "gpt-5.4",
          name: "GPT-5.4",
          isCustom: false,
          capabilities: {
            reasoningEffortLevels: [],
            supportsFastMode: false,
            supportsThinkingToggle: false,
            contextWindowOptions: [],
            promptInjectedEffortLevels: [],
          },
        },
      ],
      message: "Pending refresh",
    });

    assert.deepStrictEqual(
      hydrateCachedProvider({
        cachedProvider: cachedCodex,
        fallbackProvider: fallbackCodex,
      }),
      {
        ...fallbackCodex,
        models: [
          ...fallbackCodex.models,
          {
            slug: "gpt-5-mini",
            name: "GPT-5 Mini",
            isCustom: false,
            capabilities: {
              reasoningEffortLevels: [],
              supportsFastMode: false,
              supportsThinkingToggle: false,
              contextWindowOptions: [],
              promptInjectedEffortLevels: [],
            },
          },
        ],
        installed: cachedCodex.installed,
        version: cachedCodex.version,
        status: cachedCodex.status,
        auth: cachedCodex.auth,
        checkedAt: cachedCodex.checkedAt,
        message: cachedCodex.message,
      },
    );
  });

  it("ignores stale cached enabled state when the provider is now disabled", () => {
    const cachedCodex = makeProvider("codex", {
      checkedAt: "2026-04-10T12:00:00.000Z",
      message: "Cached ready status",
    });
    const disabledFallback = makeProvider("codex", {
      enabled: false,
      installed: false,
      version: null,
      status: "disabled",
      auth: { status: "unknown" },
      message: "Codex is disabled in T3 Code settings.",
    });

    assert.deepStrictEqual(
      hydrateCachedProvider({
        cachedProvider: cachedCodex,
        fallbackProvider: disabledFallback,
      }),
      disabledFallback,
    );
  });

  it("orders and keys snapshots by instance identity", () => {
    const defaultCodex = makeProvider("codex");
    const workCodex = makeProvider("codex", {
      instanceId: "codex_work" as ServerProvider["instanceId"],
      driver: "codex" as ServerProvider["driver"],
      displayName: "Codex Work",
    });
    const claude = makeProvider("claudeAgent");

    assert.equal(providerSnapshotKey(workCodex), "codex_work");
    assert.deepStrictEqual(orderProviderSnapshots([claude, workCodex, defaultCodex]), [
      defaultCodex,
      workCodex,
      claude,
    ]);
  });
});
