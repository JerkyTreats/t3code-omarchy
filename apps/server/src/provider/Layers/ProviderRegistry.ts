/**
 * ProviderRegistryLive - Aggregates provider-specific snapshot services.
 *
 * @module ProviderRegistryLive
 */
import {
  providerDriverKindFromProviderKind,
  type ProviderKind,
  type ServerProvider,
} from "@t3tools/contracts";
import { Effect, Equal, FileSystem, Layer, Path, PubSub, Ref, Stream } from "effect";

import { ServerConfig } from "../../config.ts";
import { ClaudeProviderLive } from "./ClaudeProvider.ts";
import { CodexProviderLive } from "./CodexProvider.ts";
import { CursorProviderLive } from "./CursorProvider.ts";
import { OpenCodeProviderLive } from "./OpenCodeProvider.ts";
import type { ClaudeProviderShape } from "../Services/ClaudeProvider.ts";
import { ClaudeProvider } from "../Services/ClaudeProvider.ts";
import type { CodexProviderShape } from "../Services/CodexProvider.ts";
import { CodexProvider } from "../Services/CodexProvider.ts";
import type { CursorProviderShape } from "../Services/CursorProvider.ts";
import { CursorProvider } from "../Services/CursorProvider.ts";
import type { OpenCodeProviderShape } from "../Services/OpenCodeProvider.ts";
import { OpenCodeProvider } from "../Services/OpenCodeProvider.ts";
import { ProviderRegistry, type ProviderRegistryShape } from "../Services/ProviderRegistry.ts";
import { ServerSettingsService } from "../../serverSettings.ts";
import { configuredProviderInstanceRoutes } from "../providerInstanceSettings.ts";
import {
  hydrateCachedProvider,
  mergeProviderSnapshot,
  PROVIDER_CACHE_IDS,
  orderProviderSnapshots,
  providerSnapshotKey,
  readProviderStatusCache,
  resolveProviderStatusCachePath,
  writeProviderStatusCache,
} from "../providerStatusCache.ts";

type ProviderSnapshotSource = {
  readonly provider: ProviderKind;
  readonly getSnapshot: Effect.Effect<ServerProvider>;
  readonly refresh: Effect.Effect<ServerProvider>;
  readonly streamChanges: Stream.Stream<ServerProvider>;
};

const loadProviders = (
  codexProvider: CodexProviderShape,
  claudeProvider: ClaudeProviderShape,
  openCodeProvider: OpenCodeProviderShape,
  cursorProvider: CursorProviderShape,
): Effect.Effect<readonly [ServerProvider, ServerProvider, ServerProvider, ServerProvider]> =>
  Effect.all(
    [
      codexProvider.getSnapshot,
      claudeProvider.getSnapshot,
      openCodeProvider.getSnapshot,
      cursorProvider.getSnapshot,
    ],
    {
      concurrency: "unbounded",
    },
  );

export const haveProvidersChanged = (
  previousProviders: ReadonlyArray<ServerProvider>,
  nextProviders: ReadonlyArray<ServerProvider>,
): boolean => !Equal.equals(previousProviders, nextProviders);

const ProviderRegistryLiveBase = Layer.effect(
  ProviderRegistry,
  Effect.gen(function* () {
    const codexProvider = yield* CodexProvider;
    const claudeProvider = yield* ClaudeProvider;
    const openCodeProvider = yield* OpenCodeProvider;
    const cursorProvider = yield* CursorProvider;
    const config = yield* ServerConfig;
    const serverSettings = yield* ServerSettingsService;
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const providerSources = [
      {
        provider: "codex",
        getSnapshot: codexProvider.getSnapshot,
        refresh: codexProvider.refresh,
        streamChanges: codexProvider.streamChanges,
      },
      {
        provider: "claudeAgent",
        getSnapshot: claudeProvider.getSnapshot,
        refresh: claudeProvider.refresh,
        streamChanges: claudeProvider.streamChanges,
      },
      {
        provider: "opencode",
        getSnapshot: openCodeProvider.getSnapshot,
        refresh: openCodeProvider.refresh,
        streamChanges: openCodeProvider.streamChanges,
      },
      {
        provider: "cursor",
        getSnapshot: cursorProvider.getSnapshot,
        refresh: cursorProvider.refresh,
        streamChanges: cursorProvider.streamChanges,
      },
    ] satisfies ReadonlyArray<ProviderSnapshotSource>;
    const activeProviders = PROVIDER_CACHE_IDS;
    const changesPubSub = yield* Effect.acquireRelease(
      PubSub.unbounded<ReadonlyArray<ServerProvider>>(),
      PubSub.shutdown,
    );
    const fallbackProviders = yield* loadProviders(
      codexProvider,
      claudeProvider,
      openCodeProvider,
      cursorProvider,
    );
    const cachePathByProvider = new Map(
      activeProviders.map(
        (provider) =>
          [
            provider,
            resolveProviderStatusCachePath({
              cacheDir: config.providerStatusCacheDir,
              provider,
            }),
          ] as const,
      ),
    );
    const fallbackByProvider = new Map(
      fallbackProviders.map((provider) => [provider.provider, provider] as const),
    );

    const expandConfiguredProviderSnapshots = Effect.fn("expandConfiguredProviderSnapshots")(
      function* (baseProviders: ReadonlyArray<ServerProvider>) {
        const settings = yield* serverSettings.getSettings;
        const baseByProvider = new Map(
          baseProviders.map((provider) => [provider.provider, provider] as const),
        );
        return configuredProviderInstanceRoutes(settings)
          .filter((route) => !route.isDefault)
          .flatMap((route) => {
            const base = baseByProvider.get(route.provider);
            if (!base) return [];
            return [
              {
                ...base,
                instanceId: route.instanceId,
                driver: providerDriverKindFromProviderKind(route.provider),
                ...(route.displayName ? { displayName: route.displayName } : {}),
                ...(route.accentColor ? { accentColor: route.accentColor } : {}),
                enabled: route.enabled,
                status: route.enabled ? base.status : "disabled",
                continuation: {
                  groupKey: `${route.provider}:instance:${route.instanceId}`,
                },
              } satisfies ServerProvider,
            ];
          });
      },
    );

    const cachedProviders = yield* Effect.forEach(
      activeProviders,
      (provider) => {
        const filePath = cachePathByProvider.get(provider)!;
        const fallbackProvider = fallbackByProvider.get(provider)!;
        return readProviderStatusCache(filePath).pipe(
          Effect.provideService(FileSystem.FileSystem, fileSystem),
          Effect.map((cachedProvider) =>
            cachedProvider === undefined
              ? fallbackProvider
              : hydrateCachedProvider({
                  cachedProvider,
                  fallbackProvider,
                }),
          ),
        );
      },
      { concurrency: "unbounded" },
    ).pipe(
      Effect.flatMap((providers) =>
        expandConfiguredProviderSnapshots(fallbackProviders).pipe(
          Effect.map((configuredProviders) =>
            orderProviderSnapshots([
              ...providers.filter((provider): provider is ServerProvider => provider !== undefined),
              ...configuredProviders,
            ]),
          ),
        ),
      ),
    );
    const providersRef = yield* Ref.make<ReadonlyArray<ServerProvider>>(cachedProviders);

    const persistProvider = (provider: ServerProvider) =>
      writeProviderStatusCache({
        filePath:
          provider.instanceId !== undefined
            ? resolveProviderStatusCachePath({
                cacheDir: config.providerStatusCacheDir,
                instanceId: provider.instanceId,
              })
            : cachePathByProvider.get(provider.provider)!,
        provider,
      }).pipe(
        Effect.provideService(FileSystem.FileSystem, fileSystem),
        Effect.provideService(Path.Path, path),
        Effect.tapError(Effect.logError),
        Effect.ignore,
      );

    const upsertProviders = Effect.fn("upsertProviders")(function* (
      nextProviders: ReadonlyArray<ServerProvider>,
      options?: {
        readonly publish?: boolean;
      },
    ) {
      const [previousProviders, providers] = yield* Ref.modify(
        providersRef,
        (previousProviders) => {
          const mergedProviders = new Map(
            previousProviders.map((provider) => [providerSnapshotKey(provider), provider] as const),
          );

          for (const provider of nextProviders) {
            const key = providerSnapshotKey(provider);
            mergedProviders.set(key, mergeProviderSnapshot(mergedProviders.get(key), provider));
          }

          const providers = orderProviderSnapshots([...mergedProviders.values()]);
          return [[previousProviders, providers] as const, providers];
        },
      );

      if (haveProvidersChanged(previousProviders, providers)) {
        yield* Effect.forEach(nextProviders, persistProvider, {
          concurrency: "unbounded",
          discard: true,
        });
        if (options?.publish !== false) {
          yield* PubSub.publish(changesPubSub, providers);
        }
      }

      return providers;
    });

    const syncProvider = Effect.fn("syncProvider")(function* (
      provider: ServerProvider,
      options?: {
        readonly publish?: boolean;
      },
    ) {
      return yield* upsertProviders([provider], options);
    });

    const refresh = Effect.fn("refresh")(function* (provider?: ProviderKind) {
      switch (provider) {
        case "codex":
          return yield* codexProvider.refresh.pipe(
            Effect.flatMap((nextProvider) => syncProvider(nextProvider)),
          );
        case "claudeAgent":
          return yield* claudeProvider.refresh.pipe(
            Effect.flatMap((nextProvider) => syncProvider(nextProvider)),
          );
        case "opencode":
          return yield* openCodeProvider.refresh.pipe(
            Effect.flatMap((nextProvider) => syncProvider(nextProvider)),
          );
        case "cursor":
          return yield* cursorProvider.refresh.pipe(
            Effect.flatMap((nextProvider) => syncProvider(nextProvider)),
          );
        default:
          break;
      }

      yield* Effect.forEach(
        providerSources,
        (providerSource) => providerSource.refresh.pipe(Effect.flatMap(syncProvider)),
        {
          concurrency: "unbounded",
          discard: true,
        },
      );
      const baseProviders = yield* Ref.get(providersRef);
      const configuredProviders = yield* expandConfiguredProviderSnapshots(baseProviders);
      if (configuredProviders.length > 0) {
        yield* upsertProviders(configuredProviders);
      }
      return yield* Ref.get(providersRef);
    });

    yield* Stream.runForEach(codexProvider.streamChanges, (provider) =>
      syncProvider(provider),
    ).pipe(Effect.forkScoped);
    yield* Stream.runForEach(claudeProvider.streamChanges, (provider) =>
      syncProvider(provider),
    ).pipe(Effect.forkScoped);
    yield* Stream.runForEach(openCodeProvider.streamChanges, (provider) =>
      syncProvider(provider),
    ).pipe(Effect.forkScoped);
    yield* Stream.runForEach(cursorProvider.streamChanges, (provider) =>
      syncProvider(provider),
    ).pipe(Effect.forkScoped);
    yield* Stream.runForEach(serverSettings.streamChanges, () => refresh()).pipe(Effect.forkScoped);
    yield* Effect.yieldNow;

    return {
      getProviders: Ref.get(providersRef),
      refresh: (provider?: ProviderKind) =>
        refresh(provider).pipe(
          Effect.tapError(Effect.logError),
          Effect.orElseSucceed(() => [] as ReadonlyArray<ServerProvider>),
        ),
      get streamChanges() {
        return Stream.fromPubSub(changesPubSub);
      },
    } satisfies ProviderRegistryShape;
  }),
);

export const ProviderRegistryLive = ProviderRegistryLiveBase.pipe(
  Layer.provideMerge(CodexProviderLive),
  Layer.provideMerge(ClaudeProviderLive),
  Layer.provideMerge(OpenCodeProviderLive),
  Layer.provideMerge(CursorProviderLive),
);
