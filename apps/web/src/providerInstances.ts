import {
  PROVIDER_DISPLAY_NAMES,
  type ProviderKind,
  type ServerProvider,
  type ServerProviderModel,
  type ServerProviderState,
} from "@t3tools/contracts";

export type ProviderInstanceId = ProviderKind;
export type ProviderDriverKind = ProviderKind;
export type ProviderInstanceAvailability = "ready" | "disabled" | "not-installed" | "unavailable";

export interface ProviderInstanceEntry {
  readonly instanceId: ProviderInstanceId;
  readonly driverKind: ProviderDriverKind;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly installed: boolean;
  readonly status: ServerProviderState;
  readonly isDefault: true;
  readonly isAvailable: boolean;
  readonly availability: ProviderInstanceAvailability;
  readonly snapshot: ServerProvider;
  readonly models: ReadonlyArray<ServerProviderModel>;
}

function resolveProviderDisplayName(snapshot: ServerProvider): string {
  return snapshot.displayName?.trim() || PROVIDER_DISPLAY_NAMES[snapshot.provider];
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
  const availability = resolveProviderInstanceAvailability(snapshot);
  return {
    instanceId: snapshot.provider,
    driverKind: snapshot.provider,
    displayName: resolveProviderDisplayName(snapshot),
    enabled: snapshot.enabled,
    installed: snapshot.installed,
    status: snapshot.status,
    isDefault: true,
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
