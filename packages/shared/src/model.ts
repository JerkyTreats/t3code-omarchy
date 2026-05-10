import {
  DEFAULT_MODEL_BY_PROVIDER,
  MODEL_SLUG_ALIASES_BY_PROVIDER,
  type ClaudeModelOptions,
  type CodexModelOptions,
  type CursorModelOptions,
  type LegacyProviderOptionSelectionsObject,
  type ModelCapabilities,
  type ModelSelection,
  type ProviderOptionDescriptor,
  type ProviderOptionSelection,
  type ProviderKind,
} from "@t3tools/contracts";

export interface SelectableModelOption {
  slug: string;
  name: string;
}

const EMPTY_LEGACY_MODEL_CAPABILITIES = {
  reasoningEffortLevels: [],
  supportsFastMode: false,
  supportsThinkingToggle: false,
  contextWindowOptions: [],
  promptInjectedEffortLevels: [],
} as const;

export function createModelCapabilities(input: {
  optionDescriptors: ReadonlyArray<ProviderOptionDescriptor>;
}): ModelCapabilities {
  return {
    optionDescriptors: input.optionDescriptors.map(cloneDescriptor),
    ...EMPTY_LEGACY_MODEL_CAPABILITIES,
  };
}

function getRawSelectionValueById(
  selections:
    | ReadonlyArray<ProviderOptionSelection>
    | LegacyProviderOptionSelectionsObject
    | null
    | undefined,
  id: string,
): string | boolean | undefined {
  if (selections && !Array.isArray(selections)) {
    return (selections as LegacyProviderOptionSelectionsObject)[id];
  }
  const selection = selections?.find((candidate) => candidate.id === id);
  return selection?.value;
}

export function getProviderOptionSelectionValue(
  selections:
    | ReadonlyArray<ProviderOptionSelection>
    | LegacyProviderOptionSelectionsObject
    | null
    | undefined,
  id: string,
): string | boolean | undefined {
  return getRawSelectionValueById(selections, id);
}

export function getProviderOptionStringSelectionValue(
  selections:
    | ReadonlyArray<ProviderOptionSelection>
    | LegacyProviderOptionSelectionsObject
    | null
    | undefined,
  id: string,
): string | undefined {
  const value = getProviderOptionSelectionValue(selections, id);
  return typeof value === "string" ? value : undefined;
}

export function getProviderOptionBooleanSelectionValue(
  selections:
    | ReadonlyArray<ProviderOptionSelection>
    | LegacyProviderOptionSelectionsObject
    | null
    | undefined,
  id: string,
): boolean | undefined {
  const value = getProviderOptionSelectionValue(selections, id);
  return typeof value === "boolean" ? value : undefined;
}

export function getModelSelectionOptionValue(
  modelSelection: ModelSelection | null | undefined,
  id: string,
): string | boolean | undefined {
  return getProviderOptionSelectionValue(modelSelection?.options, id);
}

export function getModelSelectionStringOptionValue(
  modelSelection: ModelSelection | null | undefined,
  id: string,
): string | undefined {
  return getProviderOptionStringSelectionValue(modelSelection?.options, id);
}

export function getModelSelectionBooleanOptionValue(
  modelSelection: ModelSelection | null | undefined,
  id: string,
): boolean | undefined {
  return getProviderOptionBooleanSelectionValue(modelSelection?.options, id);
}

function getLegacyCapabilities(caps: ModelCapabilities | null | undefined): {
  readonly reasoningEffortLevels: ReadonlyArray<{
    readonly value: string;
    readonly isDefault?: boolean | undefined;
  }>;
  readonly supportsFastMode: boolean;
  readonly supportsThinkingToggle: boolean;
  readonly contextWindowOptions: ReadonlyArray<{
    readonly value: string;
    readonly isDefault?: boolean | undefined;
  }>;
  readonly promptInjectedEffortLevels: ReadonlyArray<string>;
} {
  return {
    reasoningEffortLevels:
      caps?.reasoningEffortLevels ?? EMPTY_LEGACY_MODEL_CAPABILITIES.reasoningEffortLevels,
    supportsFastMode: caps?.supportsFastMode ?? EMPTY_LEGACY_MODEL_CAPABILITIES.supportsFastMode,
    supportsThinkingToggle:
      caps?.supportsThinkingToggle ?? EMPTY_LEGACY_MODEL_CAPABILITIES.supportsThinkingToggle,
    contextWindowOptions:
      caps?.contextWindowOptions ?? EMPTY_LEGACY_MODEL_CAPABILITIES.contextWindowOptions,
    promptInjectedEffortLevels:
      caps?.promptInjectedEffortLevels ??
      EMPTY_LEGACY_MODEL_CAPABILITIES.promptInjectedEffortLevels,
  };
}

export function hasEffortLevel(caps: ModelCapabilities, value: string): boolean {
  return getLegacyCapabilities(caps).reasoningEffortLevels.some((option) => option.value === value);
}

export function getDefaultEffort(caps: ModelCapabilities): string | null {
  return (
    getLegacyCapabilities(caps).reasoningEffortLevels.find((option) => option.isDefault)?.value ??
    null
  );
}

export function resolveEffort(
  caps: ModelCapabilities,
  raw: string | null | undefined,
): string | undefined {
  const legacy = getLegacyCapabilities(caps);
  const defaultValue = getDefaultEffort(caps);
  const trimmed = typeof raw === "string" ? raw.trim() : null;
  if (
    trimmed &&
    !legacy.promptInjectedEffortLevels.includes(trimmed) &&
    hasEffortLevel(caps, trimmed)
  ) {
    return trimmed;
  }
  return defaultValue ?? undefined;
}

export function hasContextWindowOption(caps: ModelCapabilities, value: string): boolean {
  return getLegacyCapabilities(caps).contextWindowOptions.some((option) => option.value === value);
}

export function getDefaultContextWindow(caps: ModelCapabilities): string | null {
  return (
    getLegacyCapabilities(caps).contextWindowOptions.find((option) => option.isDefault)?.value ??
    null
  );
}

export function resolveContextWindow(
  caps: ModelCapabilities,
  raw: string | null | undefined,
): string | undefined {
  const defaultValue = getDefaultContextWindow(caps);
  if (!raw) return defaultValue ?? undefined;
  return hasContextWindowOption(caps, raw) ? raw : (defaultValue ?? undefined);
}

export function normalizeCodexModelOptionsWithCapabilities(
  caps: ModelCapabilities,
  modelOptions: CodexModelOptions | ReadonlyArray<ProviderOptionSelection> | null | undefined,
): CodexModelOptions | undefined {
  const selections = Array.isArray(modelOptions) ? modelOptions : undefined;
  const objectOptions = Array.isArray(modelOptions)
    ? undefined
    : (modelOptions as CodexModelOptions | null | undefined);
  const selectedReasoningEffort = getProviderOptionStringSelectionValue(
    selections,
    "reasoningEffort",
  );
  const selectedFastMode = getProviderOptionBooleanSelectionValue(selections, "fastMode");
  const reasoningEffort = resolveEffort(
    caps,
    objectOptions?.reasoningEffort ?? selectedReasoningEffort,
  );
  const fastMode = caps.supportsFastMode
    ? (objectOptions?.fastMode ?? selectedFastMode)
    : undefined;
  const nextOptions: CodexModelOptions = {
    ...(reasoningEffort
      ? { reasoningEffort: reasoningEffort as CodexModelOptions["reasoningEffort"] }
      : {}),
    ...(fastMode !== undefined ? { fastMode } : {}),
  };
  return Object.keys(nextOptions).length > 0 ? nextOptions : undefined;
}

export function normalizeClaudeModelOptionsWithCapabilities(
  caps: ModelCapabilities,
  modelOptions: ClaudeModelOptions | ReadonlyArray<ProviderOptionSelection> | null | undefined,
): ClaudeModelOptions | undefined {
  const selections = Array.isArray(modelOptions) ? modelOptions : undefined;
  const objectOptions = Array.isArray(modelOptions)
    ? undefined
    : (modelOptions as ClaudeModelOptions | null | undefined);
  const selectedEffort = getProviderOptionStringSelectionValue(selections, "effort");
  const selectedThinking = getProviderOptionBooleanSelectionValue(selections, "thinking");
  const selectedFastMode = getProviderOptionBooleanSelectionValue(selections, "fastMode");
  const selectedContextWindow = getProviderOptionStringSelectionValue(selections, "contextWindow");
  const effort = resolveEffort(caps, objectOptions?.effort ?? selectedEffort);
  const thinking = caps.supportsThinkingToggle
    ? (objectOptions?.thinking ?? selectedThinking)
    : undefined;
  const fastMode = caps.supportsFastMode
    ? (objectOptions?.fastMode ?? selectedFastMode)
    : undefined;
  const contextWindow = resolveContextWindow(
    caps,
    objectOptions?.contextWindow ?? selectedContextWindow,
  );
  const nextOptions: ClaudeModelOptions = {
    ...(thinking !== undefined ? { thinking } : {}),
    ...(effort ? { effort: effort as ClaudeModelOptions["effort"] } : {}),
    ...(fastMode !== undefined ? { fastMode } : {}),
    ...(contextWindow !== undefined ? { contextWindow } : {}),
  };
  return Object.keys(nextOptions).length > 0 ? nextOptions : undefined;
}

export function normalizeCursorModelOptions(
  modelOptions:
    | CursorModelOptions
    | LegacyProviderOptionSelectionsObject
    | ReadonlyArray<ProviderOptionSelection>
    | null
    | undefined,
): CursorModelOptions | undefined {
  const selections = Array.isArray(modelOptions) ? modelOptions : undefined;
  const objectOptions = Array.isArray(modelOptions)
    ? undefined
    : (modelOptions as CursorModelOptions | null | undefined);
  const reasoning = getProviderOptionStringSelectionValue(selections, "reasoning");
  const thinking = getProviderOptionBooleanSelectionValue(selections, "thinking");
  const fastMode = getProviderOptionBooleanSelectionValue(selections, "fastMode");
  const contextWindow = getProviderOptionStringSelectionValue(selections, "contextWindow");
  const nextOptions: CursorModelOptions = {
    ...((objectOptions?.reasoning ?? reasoning)
      ? { reasoning: (objectOptions?.reasoning ?? reasoning) as CursorModelOptions["reasoning"] }
      : {}),
    ...((objectOptions?.thinking ?? thinking) !== undefined
      ? { thinking: objectOptions?.thinking ?? thinking }
      : {}),
    ...((objectOptions?.fastMode ?? fastMode) !== undefined
      ? { fastMode: objectOptions?.fastMode ?? fastMode }
      : {}),
    ...((objectOptions?.contextWindow ?? contextWindow) !== undefined
      ? { contextWindow: objectOptions?.contextWindow ?? contextWindow }
      : {}),
  };
  return Object.keys(nextOptions).length > 0 ? nextOptions : undefined;
}

export function normalizeCursorModelOptionsWithCapabilities(
  caps: ModelCapabilities,
  modelOptions: CursorModelOptions | ReadonlyArray<ProviderOptionSelection> | null | undefined,
): CursorModelOptions | undefined {
  const normalized = normalizeCursorModelOptions(modelOptions);
  if (!normalized) {
    return undefined;
  }

  const reasoning = normalized.reasoning;
  const fastMode = caps.supportsFastMode ? normalized.fastMode : undefined;
  const thinking = caps.supportsThinkingToggle ? normalized.thinking : undefined;
  const contextWindow = resolveContextWindow(caps, normalized.contextWindow);
  const nextOptions: CursorModelOptions = {
    ...(reasoning && hasEffortLevel(caps, reasoning) ? { reasoning } : {}),
    ...(fastMode !== undefined ? { fastMode } : {}),
    ...(thinking !== undefined ? { thinking } : {}),
    ...(contextWindow !== undefined ? { contextWindow } : {}),
  };
  return Object.keys(nextOptions).length > 0 ? nextOptions : undefined;
}

function resolveDescriptorChoiceValue(
  descriptor: Extract<ProviderOptionDescriptor, { type: "select" }>,
  raw: string | null | undefined,
): string | undefined {
  const trimmed = trimOrNull(raw);
  if (!trimmed) {
    return descriptor.currentValue ?? descriptor.options.find((option) => option.isDefault)?.id;
  }
  if (descriptor.options.length === 0) {
    return trimmed;
  }
  if (
    descriptor.promptInjectedValues?.includes(trimmed) &&
    descriptor.options.some((option) => option.id === trimmed)
  ) {
    return descriptor.options.find((option) => option.isDefault)?.id;
  }
  if (descriptor.options.some((option) => option.id === trimmed)) {
    return trimmed;
  }
  return descriptor.currentValue ?? descriptor.options.find((option) => option.isDefault)?.id;
}

function cloneDescriptor(descriptor: ProviderOptionDescriptor): ProviderOptionDescriptor {
  return descriptor.type === "select"
    ? {
        ...descriptor,
        options: [...descriptor.options],
        ...(descriptor.promptInjectedValues
          ? { promptInjectedValues: [...descriptor.promptInjectedValues] }
          : {}),
      }
    : { ...descriptor };
}

function cloneSelection(selection: ProviderOptionSelection): ProviderOptionSelection {
  return { ...selection };
}

function withDescriptorCurrentValue(
  descriptor: ProviderOptionDescriptor,
  rawCurrentValue: string | boolean | undefined,
): ProviderOptionDescriptor {
  if (descriptor.type === "boolean") {
    if (typeof rawCurrentValue === "boolean") {
      return {
        ...descriptor,
        currentValue: rawCurrentValue,
      };
    }
    return descriptor;
  }
  const currentValue =
    typeof rawCurrentValue === "string"
      ? resolveDescriptorChoiceValue(descriptor, rawCurrentValue)
      : resolveDescriptorChoiceValue(descriptor, descriptor.currentValue);
  if (!currentValue) {
    const { currentValue: _unusedCurrentValue, ...rest } = descriptor;
    return rest;
  }
  return {
    ...descriptor,
    currentValue,
  };
}

export function getProviderOptionDescriptors(input: {
  caps: ModelCapabilities;
  selections?:
    | ReadonlyArray<ProviderOptionSelection>
    | LegacyProviderOptionSelectionsObject
    | null
    | undefined;
}): ReadonlyArray<ProviderOptionDescriptor> {
  const { caps, selections } = input;
  const baseDescriptors = (caps.optionDescriptors ?? []).map(cloneDescriptor);

  return baseDescriptors.map((descriptor) =>
    withDescriptorCurrentValue(
      descriptor,
      getRawSelectionValueById(selections, descriptor.id) ?? descriptor.currentValue,
    ),
  );
}

export function getProviderOptionCurrentValue(
  descriptor: ProviderOptionDescriptor | null | undefined,
): string | boolean | undefined {
  if (!descriptor) {
    return undefined;
  }
  if (descriptor.type === "boolean") {
    return descriptor.currentValue;
  }
  if (descriptor.currentValue) {
    return descriptor.currentValue;
  }
  return descriptor.options.find((option) => option.isDefault)?.id;
}

export function getProviderOptionCurrentLabel(
  descriptor: ProviderOptionDescriptor | null | undefined,
): string | undefined {
  if (!descriptor) {
    return undefined;
  }
  if (descriptor.type === "boolean") {
    return typeof descriptor.currentValue === "boolean"
      ? descriptor.currentValue
        ? "On"
        : "Off"
      : undefined;
  }
  const currentValue = getProviderOptionCurrentValue(descriptor);
  if (typeof currentValue !== "string") {
    return undefined;
  }
  return descriptor.options.find((option) => option.id === currentValue)?.label;
}

export function buildProviderOptionSelectionsFromDescriptors(
  descriptors: ReadonlyArray<ProviderOptionDescriptor> | null | undefined,
): Array<ProviderOptionSelection> | undefined {
  if (!descriptors || descriptors.length === 0) {
    return undefined;
  }

  const nextSelections: Array<ProviderOptionSelection> = [];

  for (const descriptor of descriptors) {
    const value = getProviderOptionCurrentValue(descriptor);
    if (typeof value === "string" || typeof value === "boolean") {
      nextSelections.push({ id: descriptor.id, value });
    }
  }

  return nextSelections.length > 0 ? nextSelections : undefined;
}

export function normalizeProviderOptionSelections(
  value:
    | ReadonlyArray<ProviderOptionSelection>
    | Readonly<Record<string, unknown>>
    | null
    | undefined,
): Array<ProviderOptionSelection> | undefined {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(cloneSelection) : undefined;
  }

  const nextSelections: Array<ProviderOptionSelection> = [];
  for (const [id, selectionValue] of Object.entries(value)) {
    if (typeof selectionValue === "string" || typeof selectionValue === "boolean") {
      nextSelections.push({ id, value: selectionValue });
    }
  }

  return nextSelections.length > 0 ? nextSelections : undefined;
}

export function getModelSelectionOptionDescriptors(
  modelSelection: ModelSelection | null | undefined,
  caps?: ModelCapabilities | null | undefined,
): ReadonlyArray<ProviderOptionDescriptor> {
  if (!modelSelection) {
    return [];
  }
  if (!caps) {
    return [];
  }
  return getProviderOptionDescriptors({
    caps,
    selections: modelSelection.options,
  });
}

export function isClaudeUltrathinkPrompt(text: string | null | undefined): boolean {
  return typeof text === "string" && /\bultrathink\b/i.test(text);
}

export function normalizeModelSlug(
  model: string | null | undefined,
  provider: ProviderKind = "codex",
): string | null {
  if (typeof model !== "string") {
    return null;
  }

  const trimmed = model.trim();
  if (!trimmed) {
    return null;
  }

  const aliases = MODEL_SLUG_ALIASES_BY_PROVIDER[provider] as Record<string, string>;
  const aliased = Object.prototype.hasOwnProperty.call(aliases, trimmed)
    ? aliases[trimmed]
    : undefined;
  return typeof aliased === "string" ? aliased : trimmed;
}

export function resolveSelectableModel(
  provider: ProviderKind,
  value: string | null | undefined,
  options: ReadonlyArray<SelectableModelOption>,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const direct = options.find((option) => option.slug === trimmed);
  if (direct) {
    return direct.slug;
  }

  const byName = options.find((option) => option.name.toLowerCase() === trimmed.toLowerCase());
  if (byName) {
    return byName.slug;
  }

  const normalized = normalizeModelSlug(trimmed, provider);
  if (!normalized) {
    return null;
  }

  const resolved = options.find((option) => option.slug === normalized);
  return resolved ? resolved.slug : null;
}

function resolveModelSlug(model: string | null | undefined, provider: ProviderKind): string {
  const normalized = normalizeModelSlug(model, provider);
  if (!normalized) {
    return DEFAULT_MODEL_BY_PROVIDER[provider];
  }
  return normalized;
}

export function resolveModelSlugForProvider(
  provider: ProviderKind,
  model: string | null | undefined,
): string {
  return resolveModelSlug(model, provider);
}

/** Trim a string, returning null for empty/missing values. */
export function trimOrNull<T extends string>(value: T | null | undefined): T | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim() as T;
  return trimmed || null;
}

function cloneSelections(
  selections: ReadonlyArray<ProviderOptionSelection>,
): Array<ProviderOptionSelection> {
  return selections.map(cloneSelection);
}

export function createModelSelection(
  provider: ProviderKind,
  model: string,
  options?: ReadonlyArray<ProviderOptionSelection> | null,
): ModelSelection {
  const selections = options ? cloneSelections(options) : [];
  return {
    provider,
    model,
    ...(selections.length > 0 ? { options: selections } : {}),
  } as ModelSelection;
}

/**
 * Returns the effort value if it is a prompt-injected value according to
 * any select descriptor in the given capabilities, or null otherwise.
 *
 * Unlike a single `find`, this checks every descriptor so that the
 * correct descriptor's `promptInjectedValues` list is consulted even when
 * multiple select descriptors exist.
 */
export function resolvePromptInjectedEffort(
  caps: ModelCapabilities,
  rawEffort: string | null | undefined,
): string | null {
  const trimmed = trimOrNull(rawEffort);
  if (!trimmed) return null;
  const descriptors = getProviderOptionDescriptors({ caps });
  for (const descriptor of descriptors) {
    if (descriptor.type === "select" && descriptor.promptInjectedValues?.includes(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

export function applyClaudePromptEffortPrefix(
  text: string,
  effort: string | null | undefined,
): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (effort !== "ultrathink") {
    return trimmed;
  }
  if (trimmed.startsWith("Ultrathink:")) {
    return trimmed;
  }
  return `Ultrathink:\n${trimmed}`;
}
