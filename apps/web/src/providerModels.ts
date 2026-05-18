import {
  DEFAULT_MODEL_BY_PROVIDER,
  ProviderInstanceId,
  type CursorModelOptions,
  type ModelCapabilities,
  type ProviderKind,
  type ServerProvider,
  type ServerProviderModel,
} from "@t3tools/contracts";
import {
  hasEffortLevel,
  normalizeModelSlug,
  resolveContextWindow,
  trimOrNull,
} from "@t3tools/shared/model";
import {
  getProviderInstanceModels,
  getProviderInstanceSnapshot,
  getSelectableProviderInstanceEntry,
} from "./providerInstances";

const providerInstanceIdFromLegacyProvider = (provider: ProviderKind): ProviderInstanceId =>
  ProviderInstanceId.make(provider);

const EMPTY_CAPABILITIES: ModelCapabilities = {
  reasoningEffortLevels: [],
  supportsFastMode: false,
  supportsThinkingToggle: false,
  contextWindowOptions: [],
  promptInjectedEffortLevels: [],
};

export function getProviderModels(
  providers: ReadonlyArray<ServerProvider>,
  provider: ProviderKind,
): ReadonlyArray<ServerProviderModel> {
  return getProviderInstanceModels(providers, providerInstanceIdFromLegacyProvider(provider));
}

export function getProviderSnapshot(
  providers: ReadonlyArray<ServerProvider>,
  provider: ProviderKind,
): ServerProvider | undefined {
  return getProviderInstanceSnapshot(providers, providerInstanceIdFromLegacyProvider(provider));
}

export function isProviderEnabled(
  providers: ReadonlyArray<ServerProvider>,
  provider: ProviderKind,
): boolean {
  if (providers.length === 0) {
    return true;
  }
  return getProviderSnapshot(providers, provider)?.enabled ?? false;
}

export function resolveSelectableProvider(
  providers: ReadonlyArray<ServerProvider>,
  provider: ProviderKind | null | undefined,
): ProviderKind {
  const requested = provider ?? "codex";
  if (isProviderEnabled(providers, requested)) {
    return requested;
  }
  const entry = getSelectableProviderInstanceEntry(
    providers,
    providerInstanceIdFromLegacyProvider(requested),
  );
  return entry?.snapshot.provider ?? requested;
}

export function getProviderModelCapabilities(
  models: ReadonlyArray<ServerProviderModel>,
  model: string | null | undefined,
  provider: ProviderKind,
): ModelCapabilities {
  const slug = normalizeModelSlug(model, provider);
  return models.find((candidate) => candidate.slug === slug)?.capabilities ?? EMPTY_CAPABILITIES;
}

export function getDefaultServerModel(
  providers: ReadonlyArray<ServerProvider>,
  provider: ProviderKind,
): string {
  const models = getProviderModels(providers, provider);
  return (
    models.find((model) => !model.isCustom)?.slug ??
    models[0]?.slug ??
    DEFAULT_MODEL_BY_PROVIDER[provider]
  );
}

export function normalizeCursorModelOptionsWithCapabilities(
  caps: ModelCapabilities,
  modelOptions: CursorModelOptions | null | undefined,
): CursorModelOptions | undefined {
  const reasoning = trimOrNull(modelOptions?.reasoning);
  const reasoningValue =
    reasoning && hasEffortLevel(caps, reasoning)
      ? (reasoning as CursorModelOptions["reasoning"])
      : undefined;
  const fastMode =
    caps.supportsFastMode && typeof modelOptions?.fastMode === "boolean"
      ? modelOptions.fastMode
      : undefined;
  const thinking =
    caps.supportsThinkingToggle && typeof modelOptions?.thinking === "boolean"
      ? modelOptions.thinking
      : undefined;
  const contextWindow = resolveContextWindow(caps, modelOptions?.contextWindow);
  const nextOptions: CursorModelOptions = {
    ...(reasoningValue ? { reasoning: reasoningValue } : {}),
    ...(fastMode !== undefined ? { fastMode } : {}),
    ...(thinking !== undefined ? { thinking } : {}),
    ...(contextWindow ? { contextWindow } : {}),
  };
  return Object.keys(nextOptions).length > 0 ? nextOptions : undefined;
}
