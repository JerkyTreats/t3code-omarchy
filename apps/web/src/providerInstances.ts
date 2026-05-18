import {
  defaultInstanceIdForDriver,
  PROVIDER_DISPLAY_NAMES,
  ProviderDriverKind,
  ProviderInstanceId,
  type ProviderKind,
  type ServerProvider,
  type ServerProviderModel,
  type ServerProviderState,
} from "@t3tools/contracts";

export type ProviderInstanceAvailability = "ready" | "disabled" | "not-installed" | "unavailable";

export interface ProviderInstanceEntry {
  readonly instanceId: ProviderInstanceId;
  readonly driverKind: ProviderDriverKind;
  readonly displayName: string;
  readonly accentColor?: string | undefined;
  readonly continuationGroupKey?: string | undefined;
  readonly enabled: boolean;
  readonly installed: boolean;
  readonly status: ServerProviderState;
  readonly isDefault: boolean;
  readonly isAvailable: boolean;
  readonly availability: ProviderInstanceAvailability;
  readonly snapshot: ServerProvider;
  readonly models: ReadonlyArray<ServerProviderModel>;
}

function toDriverKind(value: string): ProviderDriverKind {
  return ProviderDriverKind.make(value);
}

function toInstanceId(value: string): ProviderInstanceId {
  return ProviderInstanceId.make(value);
}

function humanizeInstanceId(instanceId: ProviderInstanceId): string {
  return instanceId
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter((token) => token.length > 0)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function driverKindLabel(driverKind: ProviderDriverKind, fallbackProvider: ProviderKind): string {
  return PROVIDER_DISPLAY_NAMES[fallbackProvider] ?? driverKind;
}

export function normalizeProviderAccentColor(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return /^#[0-9a-fA-F]{6}$/u.test(trimmed) ? trimmed : undefined;
}

function resolveProviderDisplayName(input: {
  snapshot: ServerProvider;
  instanceId: ProviderInstanceId;
  driverKind: ProviderDriverKind;
  isDefault: boolean;
}): string {
  const trimmedSnapshotName = input.snapshot.displayName?.trim();
  const kindLabel = driverKindLabel(input.driverKind, input.snapshot.provider);
  if (trimmedSnapshotName && trimmedSnapshotName !== kindLabel) {
    return trimmedSnapshotName;
  }
  if (!input.isDefault) {
    const humanized = humanizeInstanceId(input.instanceId);
    if (humanized.length > 0) return humanized;
  }
  return trimmedSnapshotName || kindLabel;
}

function resolveProviderInstanceAvailability(
  snapshot: ServerProvider,
): ProviderInstanceAvailability {
  if (!snapshot.enabled) {
    return "disabled";
  }
  if (!snapshot.installed) {
    return "not-installed";
  }
  return snapshot.status === "ready" ? "ready" : "unavailable";
}

function toProviderInstanceEntry(snapshot: ServerProvider): ProviderInstanceEntry {
  const driverKind = snapshot.driver ?? toDriverKind(snapshot.provider);
  const instanceId = snapshot.instanceId ?? toInstanceId(snapshot.provider);
  const isDefault = instanceId === defaultInstanceIdForDriver(driverKind);
  const availability = resolveProviderInstanceAvailability(snapshot);
  return {
    instanceId,
    driverKind,
    displayName: resolveProviderDisplayName({ snapshot, instanceId, driverKind, isDefault }),
    accentColor: normalizeProviderAccentColor(snapshot.accentColor),
    continuationGroupKey: snapshot.continuation?.groupKey,
    enabled: snapshot.enabled,
    installed: snapshot.installed,
    status: snapshot.status,
    isDefault,
    isAvailable: availability === "ready",
    availability,
    snapshot,
    models: snapshot.models,
  };
}

export function deriveProviderInstanceEntries(
  providers: ReadonlyArray<ServerProvider>,
): ReadonlyArray<ProviderInstanceEntry> {
  return providers.map(toProviderInstanceEntry);
}

export function deriveProviderInstanceEntryMap(
  providers: ReadonlyArray<ServerProvider>,
): Readonly<Record<ProviderInstanceId, ProviderInstanceEntry>> {
  return Object.fromEntries(
    deriveProviderInstanceEntries(providers).map((entry) => [entry.instanceId, entry]),
  ) as Readonly<Record<ProviderInstanceId, ProviderInstanceEntry>>;
}

export function getProviderInstanceEntry(
  providers: ReadonlyArray<ServerProvider>,
  instanceId: ProviderInstanceId,
): ProviderInstanceEntry | undefined {
  return deriveProviderInstanceEntryMap(providers)[instanceId];
}

export function getProviderInstanceSnapshot(
  providers: ReadonlyArray<ServerProvider>,
  instanceId: ProviderInstanceId,
): ServerProvider | undefined {
  return getProviderInstanceEntry(providers, instanceId)?.snapshot;
}

export function getProviderInstanceModels(
  providers: ReadonlyArray<ServerProvider>,
  instanceId: ProviderInstanceId,
): ReadonlyArray<ServerProviderModel> {
  return getProviderInstanceEntry(providers, instanceId)?.models ?? [];
}

export function resolveSelectableProviderInstance(
  providers: ReadonlyArray<ServerProvider>,
  instanceId: ProviderInstanceId | undefined,
): ProviderInstanceId | undefined {
  const entries = deriveProviderInstanceEntries(providers);
  if (instanceId) {
    const requested = entries.find((entry) => entry.instanceId === instanceId);
    if (requested?.enabled) {
      return instanceId;
    }
  }
  return entries.find((entry) => entry.enabled)?.instanceId;
}

export function getSelectableProviderInstanceEntry(
  providers: ReadonlyArray<ServerProvider>,
  instanceId: ProviderInstanceId | undefined,
): ProviderInstanceEntry | undefined {
  const resolvedInstanceId = resolveSelectableProviderInstance(providers, instanceId);
  return resolvedInstanceId ? getProviderInstanceEntry(providers, resolvedInstanceId) : undefined;
}

export function resolveProviderDriverKindForInstanceSelection(
  entries: ReadonlyArray<ProviderInstanceEntry>,
  selection: ProviderInstanceId | ProviderDriverKind | null | undefined,
): ProviderDriverKind | undefined {
  return entries.find((entry) => entry.instanceId === selection)?.driverKind;
}
