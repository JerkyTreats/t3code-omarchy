import type {
  ModelCapabilities,
  OpenCodeSettings,
  ServerProvider,
  ServerSettingsError,
} from "@t3tools/contracts";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { Effect, Equal, Layer, Option, Result, Stream } from "effect";

import { ServerSettingsService } from "../../serverSettings.ts";
import { makeManagedServerProvider } from "../makeManagedServerProvider.ts";
import { OpenCodeProvider } from "../Services/OpenCodeProvider.ts";
import {
  buildServerProvider,
  detailFromResult,
  isCommandMissingCause,
  parseGenericCliVersion,
  providerModelsFromSettings,
  spawnAndCollect,
} from "../providerSnapshot.ts";

const PROVIDER = "opencode" as const;
const OPEN_CODE_REFRESH_INTERVAL = "15 minutes";
const EMPTY_CAPABILITIES: ModelCapabilities = {
  reasoningEffortLevels: [],
  supportsFastMode: false,
  supportsThinkingToggle: false,
  contextWindowOptions: [],
  promptInjectedEffortLevels: [],
};

function buildInitialOpenCodeProviderSnapshot(settings: OpenCodeSettings): ServerProvider {
  const checkedAt = new Date().toISOString();
  const models = providerModelsFromSettings(
    [],
    PROVIDER,
    settings.customModels,
    EMPTY_CAPABILITIES,
  );

  if (!settings.enabled) {
    return buildServerProvider({
      provider: PROVIDER,
      enabled: false,
      checkedAt,
      models,
      probe: {
        installed: false,
        version: null,
        status: "warning",
        auth: { status: "unknown" },
        message: "OpenCode is disabled in T3 Code settings.",
      },
    });
  }

  return buildServerProvider({
    provider: PROVIDER,
    enabled: true,
    checkedAt,
    models,
    probe: {
      installed: true,
      version: null,
      status: "warning",
      auth: { status: "unknown" },
      message: "Checking OpenCode availability...",
    },
  });
}

const runOpenCodeCommand = Effect.fn("runOpenCodeCommand")(function* (
  settings: OpenCodeSettings,
  args: ReadonlyArray<string>,
) {
  const command = ChildProcess.make(settings.binaryPath, [...args], {
    shell: process.platform === "win32",
    env: {
      ...process.env,
      ...(settings.serverUrl ? { OPENCODE_SERVER_URL: settings.serverUrl } : {}),
      ...(settings.serverPassword ? { OPENCODE_SERVER_PASSWORD: settings.serverPassword } : {}),
    },
  });
  return yield* spawnAndCollect(settings.binaryPath, command);
});

export const checkOpenCodeProviderStatus = Effect.fn("checkOpenCodeProviderStatus")(
  function* (): Effect.fn.Return<
    ServerProvider,
    ServerSettingsError,
    ChildProcessSpawner.ChildProcessSpawner | ServerSettingsService
  > {
    const serverSettings = yield* ServerSettingsService;
    const openCodeSettings = yield* serverSettings.getSettings.pipe(
      Effect.map((settings) => settings.providers.opencode),
    );
    const checkedAt = new Date().toISOString();
    const models = providerModelsFromSettings(
      [],
      PROVIDER,
      openCodeSettings.customModels,
      EMPTY_CAPABILITIES,
    );

    if (!openCodeSettings.enabled) {
      return buildServerProvider({
        provider: PROVIDER,
        enabled: false,
        checkedAt,
        models,
        probe: {
          installed: false,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "OpenCode is disabled in T3 Code settings.",
        },
      });
    }

    const versionProbe = yield* runOpenCodeCommand(openCodeSettings, ["--version"]).pipe(
      Effect.timeoutOption("4 seconds"),
      Effect.result,
    );

    if (Result.isFailure(versionProbe)) {
      return buildServerProvider({
        provider: PROVIDER,
        enabled: true,
        checkedAt,
        models,
        probe: {
          installed: !isCommandMissingCause(versionProbe.failure),
          version: null,
          status: "error",
          auth: { status: "unknown" },
          message: isCommandMissingCause(versionProbe.failure)
            ? "OpenCode CLI is not installed or not on PATH."
            : `Failed to execute OpenCode health check: ${versionProbe.failure instanceof Error ? versionProbe.failure.message : String(versionProbe.failure)}.`,
        },
      });
    }

    if (Option.isNone(versionProbe.success)) {
      return buildServerProvider({
        provider: PROVIDER,
        enabled: true,
        checkedAt,
        models,
        probe: {
          installed: true,
          version: null,
          status: "warning",
          auth: { status: "unknown" },
          message: "OpenCode health check timed out.",
        },
      });
    }

    const versionResult = versionProbe.success.value;
    const detail = detailFromResult(versionResult);

    return buildServerProvider({
      provider: PROVIDER,
      enabled: true,
      checkedAt,
      models,
      probe: {
        installed: versionResult.code === 0,
        version:
          parseGenericCliVersion(versionResult.stdout) ??
          parseGenericCliVersion(versionResult.stderr),
        status: versionResult.code === 0 ? "ready" : "warning",
        auth: { status: "unknown" },
        ...(detail ? { message: detail } : {}),
      },
    });
  },
);

export const OpenCodeProviderLive = Layer.effect(
  OpenCodeProvider,
  Effect.gen(function* () {
    const serverSettings = yield* ServerSettingsService;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    const checkProvider = checkOpenCodeProviderStatus().pipe(
      Effect.provideService(ServerSettingsService, serverSettings),
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    );

    return yield* makeManagedServerProvider<OpenCodeSettings>({
      getSettings: serverSettings.getSettings.pipe(
        Effect.map((settings) => settings.providers.opencode),
        Effect.orDie,
      ),
      streamSettings: serverSettings.streamChanges.pipe(
        Stream.map((settings) => settings.providers.opencode),
      ),
      haveSettingsChanged: (previous, next) => !Equal.equals(previous, next),
      initialSnapshot: buildInitialOpenCodeProviderSnapshot,
      checkProvider,
      refreshInterval: OPEN_CODE_REFRESH_INTERVAL,
    });
  }),
);
