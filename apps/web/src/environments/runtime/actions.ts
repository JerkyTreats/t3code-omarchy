import type {
  DesktopBridge,
  DesktopSshEnvironmentBootstrap,
  DesktopSshEnvironmentTarget,
  EnvironmentId,
} from "@t3tools/contracts";

import { ensureLocalApi } from "../../localApi";
import {
  bootstrapRemoteBearerSession,
  fetchRemoteEnvironmentDescriptor,
  fetchRemoteSessionState,
  issueRemoteWebSocketToken,
} from "../remote/api";
import { resolveRemotePairingTarget } from "../remote/target";
import { readActiveRemoteEnvironmentSession, setActiveRemoteEnvironmentSession } from "./active";
import {
  getSavedEnvironmentRecord,
  listSavedEnvironmentRecords,
  persistSavedEnvironmentRecord,
  readSavedEnvironmentBearerToken,
  removeSavedEnvironmentBearerToken,
  toPersistedSavedEnvironmentRecord,
  type SavedEnvironmentRecord,
  type SavedEnvironmentRuntimeState,
  useSavedEnvironmentRegistryStore,
  useSavedEnvironmentRuntimeStore,
  writeSavedEnvironmentBearerToken,
} from "./catalog";

function isoNow(): string {
  return new Date().toISOString();
}

type DesktopSshBridge = DesktopBridge &
  Required<
    Pick<
      DesktopBridge,
      "ensureSshEnvironment" | "fetchSshEnvironmentDescriptor" | "bootstrapSshBearerSession"
    >
  > &
  Pick<DesktopBridge, "issueSshWebSocketToken">;

function isDesktopSshTargetEqual(
  left: DesktopSshEnvironmentTarget | undefined,
  right: DesktopSshEnvironmentTarget | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return (
    left.alias === right.alias &&
    left.hostname === right.hostname &&
    left.username === right.username &&
    left.port === right.port
  );
}

function findSavedEnvironmentRecordByDesktopSshTarget(
  target: DesktopSshEnvironmentTarget | undefined,
): SavedEnvironmentRecord | null {
  if (!target) {
    return null;
  }

  return (
    listSavedEnvironmentRecords().find((record) =>
      isDesktopSshTargetEqual(record.desktopSsh, target),
    ) ?? null
  );
}

type SavedEnvironmentRegistrySnapshot = ReadonlyMap<EnvironmentId, SavedEnvironmentRecord | null>;

function snapshotSavedEnvironmentRegistry(
  environmentIds: ReadonlyArray<EnvironmentId>,
): SavedEnvironmentRegistrySnapshot {
  return new Map(
    environmentIds.map((environmentId) => [
      environmentId,
      getSavedEnvironmentRecord(environmentId),
    ]),
  );
}

async function persistSavedEnvironmentRegistryRollback(
  snapshot: SavedEnvironmentRegistrySnapshot,
): Promise<void> {
  const byId = Object.fromEntries(
    listSavedEnvironmentRecords().map((record) => [record.environmentId, record]),
  ) as Record<EnvironmentId, SavedEnvironmentRecord>;

  for (const [environmentId, record] of snapshot) {
    if (record) {
      byId[environmentId] = record;
    } else {
      delete byId[environmentId];
    }
  }

  const records = Object.values(byId);
  await ensureLocalApi().persistence.setSavedEnvironmentRegistry(
    records.map((entry) => toPersistedSavedEnvironmentRecord(entry)),
  );
  useSavedEnvironmentRegistryStore.setState({
    byId,
  });
}

function getDesktopSshBridge(): DesktopSshBridge {
  const desktopBridge = window.desktopBridge;
  if (!desktopBridge) {
    throw new Error("SSH launch is only available in the desktop app.");
  }
  if (
    typeof desktopBridge.ensureSshEnvironment !== "function" ||
    typeof desktopBridge.fetchSshEnvironmentDescriptor !== "function" ||
    typeof desktopBridge.bootstrapSshBearerSession !== "function"
  ) {
    throw new Error("Desktop SSH bridge is unavailable.");
  }
  return desktopBridge as DesktopSshBridge;
}

async function resolveDesktopSshEnvironmentBootstrap(
  target: DesktopSshEnvironmentTarget,
  options?: { readonly issuePairingToken?: boolean },
): Promise<DesktopSshEnvironmentBootstrap> {
  return await getDesktopSshBridge().ensureSshEnvironment(target, options);
}

async function fetchDesktopSshEnvironmentDescriptor(httpBaseUrl: string) {
  return await getDesktopSshBridge().fetchSshEnvironmentDescriptor(httpBaseUrl);
}

async function bootstrapDesktopSshBearerSession(httpBaseUrl: string, credential: string) {
  return await getDesktopSshBridge().bootstrapSshBearerSession(httpBaseUrl, credential);
}

async function removeSavedEnvironmentRecord(environmentId: EnvironmentId): Promise<void> {
  useSavedEnvironmentRegistryStore.getState().remove(environmentId);
  await removeSavedEnvironmentBearerToken(environmentId);
}

function patchSavedEnvironmentRuntimeState(
  environmentId: EnvironmentId,
  patch: Partial<SavedEnvironmentRuntimeState>,
): void {
  const runtimeStore = useSavedEnvironmentRuntimeStore.getState();
  runtimeStore.ensure(environmentId);
  runtimeStore.patch(environmentId, patch);
}

function disconnectSavedEnvironmentRuntime(
  environmentId: EnvironmentId,
  errorMessage?: string,
): void {
  const disconnectedAt = isoNow();
  const connectedAt = getSavedEnvironmentRuntimeState(environmentId)?.connectedAt ?? null;
  patchSavedEnvironmentRuntimeState(environmentId, {
    connectionState: errorMessage ? "error" : "disconnected",
    authState: errorMessage ? "requires-auth" : "unknown",
    lastError: errorMessage ?? null,
    lastErrorAt: errorMessage ? disconnectedAt : null,
    connectedAt: errorMessage ? connectedAt : null,
    descriptor: null,
    disconnectedAt,
    role: null,
    serverConfig: null,
  });
}

function getSavedEnvironmentRuntimeState(environmentId: EnvironmentId) {
  return useSavedEnvironmentRuntimeStore.getState().byId[environmentId];
}

async function issueSavedEnvironmentWebSocketToken(input: {
  readonly record: SavedEnvironmentRecord;
  readonly bearerToken: string;
}): Promise<string> {
  if (
    input.record.desktopSsh &&
    typeof window.desktopBridge?.issueSshWebSocketToken === "function"
  ) {
    const result = await window.desktopBridge.issueSshWebSocketToken(
      input.record.httpBaseUrl,
      input.bearerToken,
    );
    return result.token;
  }

  const result = await issueRemoteWebSocketToken({
    httpBaseUrl: input.record.httpBaseUrl,
    bearerToken: input.bearerToken,
  });
  return result.token;
}

async function activateSavedEnvironment(input: {
  readonly record: SavedEnvironmentRecord;
  readonly bearerToken: string;
}): Promise<void> {
  const descriptor = input.record.desktopSsh
    ? await fetchDesktopSshEnvironmentDescriptor(input.record.httpBaseUrl)
    : await fetchRemoteEnvironmentDescriptor({
        httpBaseUrl: input.record.httpBaseUrl,
      });
  const webSocketToken = await issueSavedEnvironmentWebSocketToken(input);
  const connectedAt = isoNow();

  patchSavedEnvironmentRuntimeState(input.record.environmentId, {
    authState: "authenticated",
    connectedAt,
    connectionState: "connected",
    descriptor,
    disconnectedAt: null,
    lastError: null,
    lastErrorAt: null,
    role: "owner",
  });
  setActiveRemoteEnvironmentSession({
    activatedAt: connectedAt,
    bearerToken: input.bearerToken,
    environmentId: input.record.environmentId,
    httpBaseUrl: input.record.httpBaseUrl,
    label: input.record.label,
    webSocketToken,
    wsBaseUrl: input.record.wsBaseUrl,
  });
}

export async function removeSavedEnvironment(environmentId: EnvironmentId): Promise<void> {
  const record = getSavedEnvironmentRecord(environmentId);
  if (!record) {
    return;
  }

  if (record.desktopSsh && typeof window.desktopBridge?.disconnectSshEnvironment === "function") {
    await window.desktopBridge.disconnectSshEnvironment(record.desktopSsh);
  }

  if (readActiveRemoteEnvironmentSession()?.environmentId === environmentId) {
    setActiveRemoteEnvironmentSession(null);
  }
  useSavedEnvironmentRuntimeStore.getState().clear(environmentId);
  await removeSavedEnvironmentRecord(environmentId);
}

export async function addSavedEnvironment(input: {
  readonly label: string;
  readonly pairingUrl?: string;
  readonly host?: string;
  readonly pairingCode?: string;
  readonly desktopSsh?: DesktopSshEnvironmentTarget;
}): Promise<SavedEnvironmentRecord> {
  const resolvedTarget = resolveRemotePairingTarget({
    ...(input.pairingUrl !== undefined ? { pairingUrl: input.pairingUrl } : {}),
    ...(input.host !== undefined ? { host: input.host } : {}),
    ...(input.pairingCode !== undefined ? { pairingCode: input.pairingCode } : {}),
  });

  const descriptor = input.desktopSsh
    ? await fetchDesktopSshEnvironmentDescriptor(resolvedTarget.httpBaseUrl)
    : await fetchRemoteEnvironmentDescriptor({
        httpBaseUrl: resolvedTarget.httpBaseUrl,
      });
  const environmentId = descriptor.environmentId;
  const registrySnapshot = snapshotSavedEnvironmentRegistry([environmentId]);
  const existingRecord =
    getSavedEnvironmentRecord(environmentId) ??
    findSavedEnvironmentRecordByDesktopSshTarget(input.desktopSsh);
  const staleDesktopSshRecord =
    existingRecord && existingRecord.environmentId !== environmentId ? existingRecord : null;

  const bearerSession = input.desktopSsh
    ? await bootstrapDesktopSshBearerSession(resolvedTarget.httpBaseUrl, resolvedTarget.credential)
    : await bootstrapRemoteBearerSession({
        httpBaseUrl: resolvedTarget.httpBaseUrl,
        credential: resolvedTarget.credential,
      });

  const record: SavedEnvironmentRecord = {
    environmentId,
    label: input.label.trim() || existingRecord?.label || descriptor.label,
    wsBaseUrl: resolvedTarget.wsBaseUrl,
    httpBaseUrl: resolvedTarget.httpBaseUrl,
    createdAt: existingRecord?.createdAt ?? isoNow(),
    lastConnectedAt: isoNow(),
    ...((input.desktopSsh ?? existingRecord?.desktopSsh)
      ? { desktopSsh: input.desktopSsh ?? existingRecord?.desktopSsh }
      : {}),
  };

  await persistSavedEnvironmentRecord(record);
  const didPersistBearerToken = await writeSavedEnvironmentBearerToken(
    environmentId,
    bearerSession.sessionToken,
  );
  if (!didPersistBearerToken) {
    await persistSavedEnvironmentRegistryRollback(registrySnapshot);
    throw new Error("Unable to persist saved environment credentials.");
  }

  useSavedEnvironmentRegistryStore.getState().upsert(record);
  if (staleDesktopSshRecord) {
    await removeSavedEnvironmentRecord(staleDesktopSshRecord.environmentId);
  }
  await activateSavedEnvironment({
    record,
    bearerToken: bearerSession.sessionToken,
  });

  return record;
}

export async function disconnectSavedEnvironment(environmentId: EnvironmentId): Promise<void> {
  const record = getSavedEnvironmentRecord(environmentId);
  if (!record) {
    return;
  }

  if (record.desktopSsh && typeof window.desktopBridge?.disconnectSshEnvironment === "function") {
    await window.desktopBridge.disconnectSshEnvironment(record.desktopSsh);
  }

  if (readActiveRemoteEnvironmentSession()?.environmentId === environmentId) {
    setActiveRemoteEnvironmentSession(null);
  }

  disconnectSavedEnvironmentRuntime(environmentId);
}

export async function connectDesktopSshEnvironment(
  target: DesktopSshEnvironmentTarget,
  options?: { label?: string },
): Promise<SavedEnvironmentRecord> {
  const bootstrap = await resolveDesktopSshEnvironmentBootstrap(target, {
    issuePairingToken: true,
  });
  if (!bootstrap.pairingToken) {
    throw new Error("Desktop SSH launch did not return a pairing token.");
  }

  return await addSavedEnvironment({
    label: options?.label?.trim() || bootstrap.target.alias,
    host: bootstrap.httpBaseUrl,
    pairingCode: bootstrap.pairingToken,
    desktopSsh: bootstrap.target,
  }).catch((error) => {
    const detail = [
      `local ${bootstrap.httpBaseUrl}`,
      `remote port ${bootstrap.remotePort ?? "unknown"}`,
      bootstrap.remoteServerKind ? `remote server ${bootstrap.remoteServerKind}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message} ${detail ? `(${detail})` : ""}`.trim());
  });
}

export async function reconnectSavedEnvironment(
  environmentId: EnvironmentId,
): Promise<SavedEnvironmentRecord> {
  const record = getSavedEnvironmentRecord(environmentId);
  if (!record) {
    throw new Error("Saved environment was not found.");
  }

  if (record.desktopSsh) {
    return connectDesktopSshEnvironment(record.desktopSsh, {
      label: record.label,
    });
  }

  const bearerToken = await readSavedEnvironmentBearerToken(environmentId);
  if (!bearerToken) {
    throw new Error("Saved environment credentials are missing. Add a new pairing link.");
  }

  const session = await fetchRemoteSessionState({
    httpBaseUrl: record.httpBaseUrl,
    bearerToken,
  });
  if (!session.authenticated) {
    throw new Error("Saved environment credentials expired. Add a new pairing link.");
  }

  const descriptor = await fetchRemoteEnvironmentDescriptor({
    httpBaseUrl: record.httpBaseUrl,
  });
  if (descriptor.environmentId !== record.environmentId) {
    throw new Error(
      "Saved environment points to a different remote server. Add a new pairing link.",
    );
  }

  const refreshedRecord: SavedEnvironmentRecord = {
    ...record,
    lastConnectedAt: isoNow(),
  };
  useSavedEnvironmentRegistryStore.getState().upsert(refreshedRecord);
  await activateSavedEnvironment({
    record: refreshedRecord,
    bearerToken,
  });
  return refreshedRecord;
}
