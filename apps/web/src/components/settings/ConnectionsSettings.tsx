import { GlobeIcon, KeyRoundIcon, LinkIcon, RefreshCwIcon, ShieldIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type {
  AdvertisedEndpoint,
  AuthAccessSnapshot,
  AuthClientSession,
  AuthPairingLink,
  AuthSessionId,
  DesktopDiscoveredSshHost,
  DesktopServerExposureState,
  DesktopServerExposureMode,
  PersistedSavedEnvironmentRecord,
} from "@t3tools/contracts";
import { useCallback, useMemo, useState } from "react";

import { ensureLocalApi } from "../../localApi";
import { ensureNativeApi, hasCurrentNativeApiFeature } from "../../nativeApi";
import {
  addSavedEnvironment,
  connectDesktopSshEnvironment,
  disconnectSavedEnvironment as disconnectSavedEnvironmentRecord,
  reconnectSavedEnvironment as reconnectSavedEnvironmentRecord,
  removeSavedEnvironment,
  useActiveRemoteEnvironmentStore,
} from "../../environments/runtime";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { cn } from "../../lib/utils";
import { SettingsPageContainer, SettingsRow, SettingsSection } from "./settingsLayout";

const EMPTY_ADVERTISED_ENDPOINTS: readonly AdvertisedEndpoint[] = [];
const EMPTY_SAVED_ENVIRONMENTS: readonly PersistedSavedEnvironmentRecord[] = [];
const EMPTY_SSH_HOSTS: readonly DesktopDiscoveredSshHost[] = [];
const EMPTY_AUTH_ACCESS_SNAPSHOT: AuthAccessSnapshot = {
  pairingLinks: [],
  clientSessions: [],
};

function createExposureStateFallback(): DesktopServerExposureState {
  return {
    mode: "local-only",
    endpointUrl: null,
    advertisedHost: null,
  };
}

function describeExposureMode(mode: DesktopServerExposureMode): string {
  return mode === "network-accessible"
    ? "The desktop server listens on all interfaces for pairing and remote access."
    : "The desktop server only listens on loopback for local use on this machine.";
}

function formatConnectedAt(value: string | null): string {
  if (!value) {
    return "Never";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatAuthDate(value: unknown): string {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}

function formatClientLabel(session: AuthClientSession): string {
  return (
    session.client.label ??
    session.client.browser ??
    session.client.os ??
    session.client.deviceType ??
    "Unknown client"
  );
}

function formatClientDetail(session: AuthClientSession): string {
  return [session.client.browser, session.client.os, session.client.ipAddress]
    .filter(Boolean)
    .join(" • ");
}

function formatSshTarget(host: DesktopDiscoveredSshHost): string {
  const authority = host.username ? `${host.username}@${host.hostname}` : host.hostname;
  return host.port ? `${authority}:${host.port}` : authority;
}

function makeSshHostKey(host: DesktopDiscoveredSshHost): string {
  return `${host.source}:${host.alias}:${host.hostname}:${host.port ?? ""}`;
}

function useConnectionsSnapshot() {
  return useQuery({
    queryKey: ["connections", "snapshot"],
    queryFn: async () => {
      const registry = await ensureLocalApi().persistence.getSavedEnvironmentRegistry();
      const exposure =
        typeof window.desktopBridge?.getServerExposureState === "function"
          ? await window.desktopBridge.getServerExposureState()
          : createExposureStateFallback();
      const advertisedEndpoints =
        typeof window.desktopBridge?.getAdvertisedEndpoints === "function"
          ? await window.desktopBridge.getAdvertisedEndpoints()
          : [];
      const sshHosts =
        typeof window.desktopBridge?.discoverSshHosts === "function"
          ? await window.desktopBridge.discoverSshHosts()
          : [];

      return {
        exposure,
        advertisedEndpoints,
        registry,
        sshHosts,
      };
    },
    staleTime: 15_000,
  });
}

function useAuthAccessSnapshot(enabled: boolean) {
  return useQuery({
    queryKey: ["connections", "authAccess"],
    queryFn: async () => ensureNativeApi().auth.getAccessSnapshot(),
    enabled,
    staleTime: 15_000,
  });
}

export function ConnectionsSettings() {
  const snapshotQuery = useConnectionsSnapshot();
  const authAccessSupported = hasCurrentNativeApiFeature("auth.accessManagement");
  const authAccessQuery = useAuthAccessSnapshot(authAccessSupported);
  const [isUpdatingExposure, setIsUpdatingExposure] = useState(false);
  const [isUpdatingTailscale, setIsUpdatingTailscale] = useState(false);
  const [pairingLinkLabel, setPairingLinkLabel] = useState("");
  const [creatingPairingLink, setCreatingPairingLink] = useState(false);
  const [revokingPairingLinkId, setRevokingPairingLinkId] = useState<string | null>(null);
  const [revokingClientSessionId, setRevokingClientSessionId] = useState<AuthSessionId | null>(
    null,
  );
  const [revokingOtherClientSessions, setRevokingOtherClientSessions] = useState(false);
  const [authAccessErrorMessage, setAuthAccessErrorMessage] = useState<string | null>(null);
  const [connectingSshHostKey, setConnectingSshHostKey] = useState<string | null>(null);
  const [isAddingRemote, setIsAddingRemote] = useState(false);
  const [pairingLabel, setPairingLabel] = useState("");
  const [pairingUrl, setPairingUrl] = useState("");
  const [pairingErrorMessage, setPairingErrorMessage] = useState<string | null>(null);
  const [sshErrorMessage, setSshErrorMessage] = useState<string | null>(null);
  const [reconnectingEnvironmentId, setReconnectingEnvironmentId] = useState<string | null>(null);
  const [disconnectingEnvironmentId, setDisconnectingEnvironmentId] = useState<string | null>(null);
  const [removingEnvironmentId, setRemovingEnvironmentId] = useState<string | null>(null);
  const [savedEnvironmentErrorMessage, setSavedEnvironmentErrorMessage] = useState<string | null>(
    null,
  );

  const snapshotData = snapshotQuery.data;
  const authAccess = authAccessQuery.data ?? EMPTY_AUTH_ACCESS_SNAPSHOT;
  const activeRemoteEnvironment = useActiveRemoteEnvironmentStore((state) => state.session);
  const exposure = snapshotData?.exposure ?? createExposureStateFallback();
  const advertisedEndpoints = snapshotData?.advertisedEndpoints ?? EMPTY_ADVERTISED_ENDPOINTS;
  const registry = snapshotData?.registry ?? EMPTY_SAVED_ENVIRONMENTS;
  const sshHosts = snapshotData?.sshHosts ?? EMPTY_SSH_HOSTS;
  const networkAccessible = exposure.mode === "network-accessible";
  const exposureUnavailable = typeof window.desktopBridge?.getServerExposureState !== "function";
  const tailscaleToggleUnavailable =
    typeof window.desktopBridge?.setTailscaleServeEnabled !== "function";

  const refresh = useCallback(() => {
    void snapshotQuery.refetch();
  }, [snapshotQuery]);

  const refreshAuthAccess = useCallback(() => {
    void authAccessQuery.refetch();
  }, [authAccessQuery]);

  const createPairingLink = useCallback(async () => {
    setAuthAccessErrorMessage(null);
    setCreatingPairingLink(true);
    try {
      if (!authAccessSupported) {
        throw new Error("Access management is unavailable on the current transport.");
      }
      const label = pairingLinkLabel.trim();
      await ensureNativeApi().auth.createPairingCredential(label ? { label } : {});
      setPairingLinkLabel("");
      await authAccessQuery.refetch();
    } catch (error) {
      setAuthAccessErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setCreatingPairingLink(false);
    }
  }, [authAccessQuery, authAccessSupported, pairingLinkLabel]);

  const revokePairingLink = useCallback(
    async (link: AuthPairingLink) => {
      setAuthAccessErrorMessage(null);
      setRevokingPairingLinkId(link.id);
      try {
        if (!authAccessSupported) {
          throw new Error("Access management is unavailable on the current transport.");
        }
        await ensureNativeApi().auth.revokePairingLink({ id: link.id });
        await authAccessQuery.refetch();
      } catch (error) {
        setAuthAccessErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setRevokingPairingLinkId(null);
      }
    },
    [authAccessQuery, authAccessSupported],
  );

  const revokeClientSession = useCallback(
    async (session: AuthClientSession) => {
      setAuthAccessErrorMessage(null);
      setRevokingClientSessionId(session.sessionId);
      try {
        if (!authAccessSupported) {
          throw new Error("Access management is unavailable on the current transport.");
        }
        await ensureNativeApi().auth.revokeClientSession({ sessionId: session.sessionId });
        await authAccessQuery.refetch();
      } catch (error) {
        setAuthAccessErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setRevokingClientSessionId(null);
      }
    },
    [authAccessQuery, authAccessSupported],
  );

  const revokeOtherClientSessions = useCallback(async () => {
    setAuthAccessErrorMessage(null);
    setRevokingOtherClientSessions(true);
    try {
      if (!authAccessSupported) {
        throw new Error("Access management is unavailable on the current transport.");
      }
      await ensureNativeApi().auth.revokeOtherClientSessions();
      await authAccessQuery.refetch();
    } catch (error) {
      setAuthAccessErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRevokingOtherClientSessions(false);
    }
  }, [authAccessQuery, authAccessSupported]);

  const connectSshHost = useCallback(async (host: DesktopDiscoveredSshHost) => {
    setSshErrorMessage(null);
    const hostKey = makeSshHostKey(host);
    setConnectingSshHostKey(hostKey);
    try {
      await connectDesktopSshEnvironment(
        {
          alias: host.alias,
          hostname: host.hostname,
          username: host.username,
          port: host.port,
        },
        { label: host.alias },
      );
      window.location.reload();
    } catch (error) {
      setSshErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setConnectingSshHostKey(null);
    }
  }, []);

  const connectPairingUrl = useCallback(async () => {
    const trimmedPairingUrl = pairingUrl.trim();
    if (!trimmedPairingUrl) {
      setPairingErrorMessage("Paste a pairing link to add a remote environment.");
      return;
    }

    setPairingErrorMessage(null);
    setIsAddingRemote(true);
    try {
      await addSavedEnvironment({
        label: pairingLabel.trim(),
        pairingUrl: trimmedPairingUrl,
      });
      setPairingLabel("");
      setPairingUrl("");
      window.location.reload();
    } catch (error) {
      setPairingErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsAddingRemote(false);
    }
  }, [pairingLabel, pairingUrl]);

  const forgetSavedEnvironment = useCallback(
    async (environmentId: string) => {
      setSavedEnvironmentErrorMessage(null);
      setRemovingEnvironmentId(environmentId);
      try {
        const removedActiveEnvironment = activeRemoteEnvironment?.environmentId === environmentId;
        await removeSavedEnvironment(
          environmentId as PersistedSavedEnvironmentRecord["environmentId"],
        );
        if (removedActiveEnvironment) {
          window.location.reload();
          return;
        }
        await snapshotQuery.refetch();
      } catch (error) {
        setSavedEnvironmentErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setRemovingEnvironmentId(null);
      }
    },
    [activeRemoteEnvironment?.environmentId, snapshotQuery],
  );

  const reconnectSavedEnvironment = useCallback(async (record: PersistedSavedEnvironmentRecord) => {
    setSavedEnvironmentErrorMessage(null);
    setReconnectingEnvironmentId(record.environmentId);
    try {
      await reconnectSavedEnvironmentRecord(record.environmentId);
      window.location.reload();
    } catch (error) {
      setSavedEnvironmentErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setReconnectingEnvironmentId(null);
    }
  }, []);

  const disconnectSavedEnvironment = useCallback(
    async (record: PersistedSavedEnvironmentRecord) => {
      setSavedEnvironmentErrorMessage(null);
      setDisconnectingEnvironmentId(record.environmentId);
      try {
        await disconnectSavedEnvironmentRecord(record.environmentId);
        window.location.reload();
      } catch (error) {
        setSavedEnvironmentErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setDisconnectingEnvironmentId(null);
      }
    },
    [],
  );

  const setExposureMode = useCallback(
    async (checked: boolean) => {
      if (typeof window.desktopBridge?.setServerExposureMode !== "function") {
        return;
      }
      setIsUpdatingExposure(true);
      try {
        await window.desktopBridge.setServerExposureMode(
          checked ? "network-accessible" : "local-only",
        );
        await snapshotQuery.refetch();
      } finally {
        setIsUpdatingExposure(false);
      }
    },
    [snapshotQuery],
  );

  const setTailscaleServeEnabled = useCallback(
    async (checked: boolean) => {
      if (typeof window.desktopBridge?.setTailscaleServeEnabled !== "function") {
        return;
      }
      setIsUpdatingTailscale(true);
      try {
        await window.desktopBridge.setTailscaleServeEnabled({
          enabled: checked,
          ...(exposure.tailscaleServePort === undefined
            ? {}
            : { port: exposure.tailscaleServePort }),
        });
        await snapshotQuery.refetch();
      } finally {
        setIsUpdatingTailscale(false);
      }
    },
    [exposure.tailscaleServePort, snapshotQuery],
  );

  const savedEnvironmentRows = useMemo(
    () =>
      registry.map((record: PersistedSavedEnvironmentRecord) => (
        <SettingsRow
          key={record.environmentId}
          title={record.label}
          description={record.httpBaseUrl}
          status={
            <>
              <span className="block break-all font-mono text-[11px] text-foreground">
                {record.wsBaseUrl}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Last connected: {formatConnectedAt(record.lastConnectedAt)}
              </span>
            </>
          }
          control={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={
                  reconnectingEnvironmentId !== null ||
                  disconnectingEnvironmentId !== null ||
                  removingEnvironmentId !== null
                }
                onClick={() => void reconnectSavedEnvironment(record)}
              >
                {reconnectingEnvironmentId === record.environmentId
                  ? "Reconnecting..."
                  : "Reconnect"}
              </Button>
              {activeRemoteEnvironment?.environmentId === record.environmentId ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    reconnectingEnvironmentId !== null ||
                    disconnectingEnvironmentId !== null ||
                    removingEnvironmentId !== null
                  }
                  onClick={() => void disconnectSavedEnvironment(record)}
                >
                  {disconnectingEnvironmentId === record.environmentId
                    ? "Disconnecting..."
                    : "Disconnect"}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                disabled={
                  reconnectingEnvironmentId !== null ||
                  disconnectingEnvironmentId !== null ||
                  removingEnvironmentId !== null
                }
                onClick={() => void forgetSavedEnvironment(record.environmentId)}
              >
                {removingEnvironmentId === record.environmentId ? "Forgetting..." : "Forget"}
              </Button>
            </div>
          }
        />
      )),
    [
      activeRemoteEnvironment?.environmentId,
      disconnectSavedEnvironment,
      disconnectingEnvironmentId,
      forgetSavedEnvironment,
      reconnectSavedEnvironment,
      reconnectingEnvironmentId,
      registry,
      removingEnvironmentId,
    ],
  );

  const pairingLinkRows = useMemo(
    () =>
      authAccess.pairingLinks.map((link: AuthPairingLink) => (
        <SettingsRow
          key={link.id}
          title={link.label ?? link.subject}
          description={`Role: ${link.role}`}
          status={
            <>
              <span className="block break-all font-mono text-[11px] text-foreground">
                {link.credential}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Expires: {formatAuthDate(link.expiresAt)}
              </span>
            </>
          }
          control={
            <Button
              variant="outline"
              size="sm"
              disabled={revokingPairingLinkId !== null}
              onClick={() => void revokePairingLink(link)}
            >
              {revokingPairingLinkId === link.id ? "Revoking..." : "Revoke"}
            </Button>
          }
        />
      )),
    [authAccess.pairingLinks, revokePairingLink, revokingPairingLinkId],
  );

  const clientSessionRows = useMemo(
    () =>
      authAccess.clientSessions.map((session: AuthClientSession) => {
        const clientDetail = formatClientDetail(session);

        return (
          <SettingsRow
            key={session.sessionId}
            title={formatClientLabel(session)}
            description={clientDetail || session.method}
            status={
              <>
                <span className="block text-[11px] text-muted-foreground">
                  {session.current ? "Current session" : session.connected ? "Connected" : "Idle"} •{" "}
                  {session.role}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Last connected:{" "}
                  {session.lastConnectedAt ? formatAuthDate(session.lastConnectedAt) : "Never"}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Expires: {formatAuthDate(session.expiresAt)}
                </span>
              </>
            }
            control={
              <Button
                variant="outline"
                size="sm"
                disabled={
                  session.current || revokingClientSessionId !== null || revokingOtherClientSessions
                }
                onClick={() => void revokeClientSession(session)}
              >
                {revokingClientSessionId === session.sessionId ? "Revoking..." : "Revoke"}
              </Button>
            }
          />
        );
      }),
    [
      authAccess.clientSessions,
      revokeClientSession,
      revokingClientSessionId,
      revokingOtherClientSessions,
    ],
  );

  const advertisedEndpointRows = useMemo(
    () =>
      advertisedEndpoints.map((endpoint: AdvertisedEndpoint) => (
        <SettingsRow
          key={endpoint.id}
          title={endpoint.label}
          description={endpoint.description ?? endpoint.provider.label}
          status={
            <>
              <span className="block break-all font-mono text-[11px] text-foreground">
                {endpoint.httpBaseUrl}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {endpoint.provider.label} • {endpoint.status} • {endpoint.reachability}
              </span>
            </>
          }
        />
      )),
    [advertisedEndpoints],
  );

  const sshHostRows = useMemo(
    () =>
      sshHosts.map((host: DesktopDiscoveredSshHost) =>
        (() => {
          const hostKey = makeSshHostKey(host);
          const savedRecord = registry.find(
            (record) =>
              record.desktopSsh?.alias === host.alias &&
              record.desktopSsh?.hostname === host.hostname &&
              record.desktopSsh?.username === host.username &&
              record.desktopSsh?.port === host.port,
          );

          return (
            <SettingsRow
              key={hostKey}
              title={host.alias}
              description={formatSshTarget(host)}
              status={
                <>
                  <span className="block text-[11px] text-muted-foreground">{host.source}</span>
                  {savedRecord ? (
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {savedRecord.environmentId === activeRemoteEnvironment?.environmentId
                        ? `Active as ${savedRecord.label}`
                        : `Saved as ${savedRecord.label}`}
                    </span>
                  ) : null}
                </>
              }
              control={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={connectingSshHostKey !== null}
                  onClick={() => void connectSshHost(host)}
                >
                  {connectingSshHostKey === hostKey
                    ? "Connecting..."
                    : savedRecord
                      ? "Reconnect"
                      : "Connect"}
                </Button>
              }
            />
          );
        })(),
      ),
    [
      activeRemoteEnvironment?.environmentId,
      connectSshHost,
      connectingSshHostKey,
      registry,
      sshHosts,
    ],
  );

  return (
    <SettingsPageContainer>
      <SettingsSection
        title="Server Exposure"
        icon={<GlobeIcon className="size-3.5" />}
        headerAction={
          <Button variant="outline" size="sm" disabled={snapshotQuery.isFetching} onClick={refresh}>
            <RefreshCwIcon
              className={cn("mr-2 size-4", snapshotQuery.isFetching && "animate-spin")}
            />
            Refresh
          </Button>
        }
      >
        <SettingsRow
          title="Network access"
          description={
            exposureUnavailable
              ? "Desktop exposure controls are only available inside the desktop app."
              : describeExposureMode(exposure.mode)
          }
          status={
            <>
              <span className="block text-[11px] text-muted-foreground">Mode: {exposure.mode}</span>
              {exposure.endpointUrl ? (
                <span className="mt-1 block break-all font-mono text-[11px] text-foreground">
                  {exposure.endpointUrl}
                </span>
              ) : null}
              {exposure.advertisedHost ? (
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Advertised host: {exposure.advertisedHost}
                </span>
              ) : null}
            </>
          }
          control={
            <Switch
              checked={networkAccessible}
              disabled={exposureUnavailable || isUpdatingExposure}
              onCheckedChange={(checked) => void setExposureMode(Boolean(checked))}
              aria-label="Enable desktop network access"
            />
          }
        />
        <SettingsRow
          title="Tailscale Serve"
          description={
            tailscaleToggleUnavailable
              ? "Tailscale controls are only available inside the desktop app."
              : "Expose an HTTPS endpoint on your Tailnet when Tailscale is available."
          }
          status={
            <>
              <span className="block text-[11px] text-muted-foreground">
                Enabled: {exposure.tailscaleServeEnabled ? "yes" : "no"}
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                HTTPS port: {exposure.tailscaleServePort ?? 443}
              </span>
            </>
          }
          control={
            <Switch
              checked={exposure.tailscaleServeEnabled === true}
              disabled={tailscaleToggleUnavailable || isUpdatingTailscale}
              onCheckedChange={(checked) => void setTailscaleServeEnabled(Boolean(checked))}
              aria-label="Enable Tailscale Serve"
            />
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Authorized Access"
        icon={<ShieldIcon className="size-3.5" />}
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={
                !authAccessSupported ||
                revokingOtherClientSessions ||
                authAccess.clientSessions.length <= 1
              }
              onClick={() => void revokeOtherClientSessions()}
            >
              {revokingOtherClientSessions ? "Revoking..." : "Revoke others"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!authAccessSupported || authAccessQuery.isFetching}
              onClick={refreshAuthAccess}
            >
              <RefreshCwIcon
                className={cn("mr-2 size-4", authAccessQuery.isFetching && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        }
      >
        <SettingsRow
          title="Create pairing link"
          description={
            authAccessSupported
              ? "Issue a temporary owner credential for connecting another client."
              : "Access management is unavailable on the current transport."
          }
          status={authAccessErrorMessage ?? undefined}
          control={
            <Button
              variant="outline"
              size="sm"
              disabled={!authAccessSupported || creatingPairingLink}
              onClick={() => void createPairingLink()}
            >
              {creatingPairingLink ? "Creating..." : "Create link"}
            </Button>
          }
        >
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,16rem)_1fr]">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Label
              </p>
              <Input
                value={pairingLinkLabel}
                onChange={(event) => setPairingLinkLabel(event.target.value)}
                placeholder="Optional client label"
              />
            </div>
            <div className="flex items-end text-[11px] text-muted-foreground">
              Active pairing links and client sessions are listed below.
            </div>
          </div>
        </SettingsRow>
        {pairingLinkRows.length > 0 ? (
          pairingLinkRows
        ) : (
          <SettingsRow
            title="No active pairing links"
            description="Created pairing links will appear here until they expire or are revoked."
            status={
              authAccessQuery.error instanceof Error ? authAccessQuery.error.message : undefined
            }
          />
        )}
        <SettingsRow
          title="Client sessions"
          description="Connected browsers and remote clients with active server access."
          status={
            <span className="inline-flex items-center gap-1">
              <KeyRoundIcon className="size-3" />
              {authAccess.clientSessions.length} active
            </span>
          }
        />
        {clientSessionRows.length > 0 ? (
          clientSessionRows
        ) : (
          <SettingsRow
            title="No client sessions"
            description="Authenticated clients will appear here after they connect."
          />
        )}
      </SettingsSection>

      <SettingsSection title="Pair Remote Environment" icon={<LinkIcon className="size-3.5" />}>
        <SettingsRow
          title="Add by pairing link"
          description="Paste a desktop or hosted pairing link to save a remote environment."
          status={pairingErrorMessage ?? undefined}
          control={
            <Button
              variant="outline"
              size="sm"
              disabled={isAddingRemote || pairingUrl.trim().length === 0}
              onClick={() => void connectPairingUrl()}
            >
              {isAddingRemote ? "Adding..." : "Add environment"}
            </Button>
          }
        >
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Label
              </p>
              <Input
                value={pairingLabel}
                onChange={(event) => setPairingLabel(event.target.value)}
                placeholder="Optional display name"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Pairing link
              </p>
              <Textarea
                value={pairingUrl}
                onChange={(event) => setPairingUrl(event.target.value)}
                placeholder="https://.../pair#token=..."
              />
            </div>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Advertised Endpoints" icon={<GlobeIcon className="size-3.5" />}>
        {advertisedEndpointRows.length > 0 ? (
          advertisedEndpointRows
        ) : (
          <SettingsRow
            title="No advertised endpoints"
            description="Published desktop endpoints will appear here when the desktop bridge exposes them."
          />
        )}
      </SettingsSection>

      <SettingsSection title="Saved Environments" icon={<LinkIcon className="size-3.5" />}>
        {activeRemoteEnvironment ? (
          <SettingsRow
            title="Active environment"
            description={activeRemoteEnvironment.label}
            status={
              <>
                <span className="block break-all font-mono text-[11px] text-foreground">
                  {activeRemoteEnvironment.httpBaseUrl}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Environment id: {activeRemoteEnvironment.environmentId}
                </span>
              </>
            }
          />
        ) : (
          <SettingsRow
            title="Active environment"
            description="Local desktop or browser primary environment"
          />
        )}
        {savedEnvironmentErrorMessage ? (
          <SettingsRow
            title="Saved environment update failed"
            description={savedEnvironmentErrorMessage}
          />
        ) : null}
        {savedEnvironmentRows.length > 0 ? (
          savedEnvironmentRows
        ) : (
          <SettingsRow
            title="No saved environments"
            description="Paired and remote environments will appear here after they are connected."
            status={snapshotQuery.error instanceof Error ? snapshotQuery.error.message : undefined}
          />
        )}
      </SettingsSection>

      <SettingsSection title="SSH Hosts" icon={<LinkIcon className="size-3.5" />}>
        {sshErrorMessage ? (
          <SettingsRow title="SSH connection failed" description={sshErrorMessage} />
        ) : null}
        {sshHostRows.length > 0 ? (
          sshHostRows
        ) : (
          <SettingsRow
            title="No SSH hosts discovered"
            description="SSH config aliases and known hosts will appear here when the desktop bridge exposes them."
          />
        )}
      </SettingsSection>
    </SettingsPageContainer>
  );
}
