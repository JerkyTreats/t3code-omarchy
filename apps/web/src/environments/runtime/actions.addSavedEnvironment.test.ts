import { EnvironmentId } from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockSavedRecords: Array<Record<string, unknown>> = [];

const mockResolveRemotePairingTarget = vi.fn();
const mockFetchRemoteEnvironmentDescriptor = vi.fn();
const mockBootstrapRemoteBearerSession = vi.fn();
const mockFetchRemoteSessionState = vi.fn();
const mockPersistSavedEnvironmentRecord = vi.fn();
const mockWriteSavedEnvironmentBearerToken = vi.fn();
const mockReadSavedEnvironmentBearerToken = vi.fn();
const mockSetSavedEnvironmentRegistry = vi.fn();
const mockGetSavedEnvironmentRecord = vi.fn((environmentId: string) => {
  return mockSavedRecords.find((record) => record.environmentId === environmentId) ?? null;
});
const mockRemoveSavedEnvironmentBearerToken = vi.fn();
const mockRegistrySetState = vi.fn((next: { byId: Record<string, Record<string, unknown>> }) => {
  mockSavedRecords = Object.values(next.byId);
});
const mockRemove = vi.fn((environmentId: string) => {
  mockSavedRecords = mockSavedRecords.filter((record) => record.environmentId !== environmentId);
});
const mockUpsert = vi.fn((record: Record<string, unknown>) => {
  mockSavedRecords = [
    ...mockSavedRecords.filter((entry) => entry.environmentId !== record.environmentId),
    record,
  ];
});
const mockListSavedEnvironmentRecords = vi.fn(() => mockSavedRecords);
const mockEnsureSshEnvironment = vi.fn();
const mockDisconnectSshEnvironment = vi.fn();
const mockFetchSshEnvironmentDescriptor = vi.fn();
const mockBootstrapSshBearerSession = vi.fn();
const mockToPersistedSavedEnvironmentRecord = vi.fn((record) => record);

vi.mock("../remote/target", () => ({
  resolveRemotePairingTarget: mockResolveRemotePairingTarget,
}));

vi.mock("../remote/api", () => ({
  bootstrapRemoteBearerSession: mockBootstrapRemoteBearerSession,
  fetchRemoteEnvironmentDescriptor: mockFetchRemoteEnvironmentDescriptor,
  fetchRemoteSessionState: mockFetchRemoteSessionState,
}));

vi.mock("~/localApi", () => ({
  ensureLocalApi: () => ({
    persistence: {
      setSavedEnvironmentRegistry: mockSetSavedEnvironmentRegistry,
    },
  }),
}));

vi.mock("./catalog", () => ({
  getSavedEnvironmentRecord: mockGetSavedEnvironmentRecord,
  listSavedEnvironmentRecords: mockListSavedEnvironmentRecords,
  persistSavedEnvironmentRecord: mockPersistSavedEnvironmentRecord,
  readSavedEnvironmentBearerToken: mockReadSavedEnvironmentBearerToken,
  removeSavedEnvironmentBearerToken: mockRemoveSavedEnvironmentBearerToken,
  toPersistedSavedEnvironmentRecord: mockToPersistedSavedEnvironmentRecord,
  useSavedEnvironmentRegistryStore: {
    getState: () => ({
      upsert: mockUpsert,
      remove: mockRemove,
    }),
    setState: mockRegistrySetState,
  },
  writeSavedEnvironmentBearerToken: mockWriteSavedEnvironmentBearerToken,
}));

describe("saved environment actions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockSavedRecords = [];
    vi.stubGlobal("window", {
      desktopBridge: {
        ensureSshEnvironment: mockEnsureSshEnvironment,
        disconnectSshEnvironment: mockDisconnectSshEnvironment,
        fetchSshEnvironmentDescriptor: mockFetchSshEnvironmentDescriptor,
        bootstrapSshBearerSession: mockBootstrapSshBearerSession,
      },
    });

    mockResolveRemotePairingTarget.mockImplementation(
      (input: { host?: string; pairingCode?: string }) => ({
        httpBaseUrl: input.host
          ? input.host.endsWith("/")
            ? input.host
            : `${input.host}/`
          : "https://remote.example.com/",
        wsBaseUrl: input.host
          ? input.host.replace(/^http/u, "ws").endsWith("/")
            ? input.host.replace(/^http/u, "ws")
            : `${input.host.replace(/^http/u, "ws")}/`
          : "wss://remote.example.com/",
        credential: input.pairingCode ?? "pairing-code",
      }),
    );
    mockFetchRemoteEnvironmentDescriptor.mockResolvedValue({
      environmentId: EnvironmentId.make("environment-1"),
      label: "Remote environment",
    });
    mockBootstrapRemoteBearerSession.mockResolvedValue({
      sessionToken: "bearer-token",
      role: "owner",
    });
    mockPersistSavedEnvironmentRecord.mockResolvedValue(undefined);
    mockWriteSavedEnvironmentBearerToken.mockResolvedValue(false);
    mockReadSavedEnvironmentBearerToken.mockResolvedValue("saved-bearer-token");
    mockSetSavedEnvironmentRegistry.mockResolvedValue(undefined);
    mockRemoveSavedEnvironmentBearerToken.mockResolvedValue(undefined);
    mockFetchRemoteSessionState.mockResolvedValue({
      authenticated: true,
      auth: {
        kind: "bearer",
      },
      role: "owner",
    });
    mockDisconnectSshEnvironment.mockResolvedValue(undefined);
    mockFetchSshEnvironmentDescriptor.mockResolvedValue({
      environmentId: EnvironmentId.make("environment-ssh"),
      label: "SSH environment",
    });
    mockBootstrapSshBearerSession.mockResolvedValue({
      sessionToken: "ssh-bearer-token",
      role: "owner",
    });
    mockEnsureSshEnvironment.mockResolvedValue({
      target: {
        alias: "devbox",
        hostname: "devbox.example.com",
        username: "julius",
        port: 22,
      },
      httpBaseUrl: "http://127.0.0.1:3774/",
      wsBaseUrl: "ws://127.0.0.1:3774/",
      pairingToken: "ssh-pairing-code",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rolls back persisted metadata when bearer token persistence fails", async () => {
    const { addSavedEnvironment } = await import("./actions");

    await expect(
      addSavedEnvironment({
        label: "Remote environment",
        host: "remote.example.com",
        pairingCode: "123456",
      }),
    ).rejects.toThrow("Unable to persist saved environment credentials.");

    expect(mockPersistSavedEnvironmentRecord).toHaveBeenCalledTimes(1);
    expect(mockWriteSavedEnvironmentBearerToken).toHaveBeenCalledWith(
      EnvironmentId.make("environment-1"),
      "bearer-token",
    );
    expect(mockSetSavedEnvironmentRegistry).toHaveBeenCalledWith([]);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("persists desktop SSH targets after launching a managed remote", async () => {
    mockWriteSavedEnvironmentBearerToken.mockResolvedValue(true);

    const { connectDesktopSshEnvironment } = await import("./actions");

    const record = await connectDesktopSshEnvironment({
      alias: "devbox",
      hostname: "devbox.example.com",
      username: "julius",
      port: 22,
    });

    expect(mockEnsureSshEnvironment).toHaveBeenCalledWith(
      {
        alias: "devbox",
        hostname: "devbox.example.com",
        username: "julius",
        port: 22,
      },
      { issuePairingToken: true },
    );
    expect(mockFetchSshEnvironmentDescriptor).toHaveBeenCalledWith("http://127.0.0.1:3774/");
    expect(mockBootstrapSshBearerSession).toHaveBeenCalledWith(
      "http://127.0.0.1:3774/",
      "ssh-pairing-code",
    );
    expect(record.desktopSsh).toEqual({
      alias: "devbox",
      hostname: "devbox.example.com",
      username: "julius",
      port: 22,
    });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        environmentId: EnvironmentId.make("environment-ssh"),
        desktopSsh: {
          alias: "devbox",
          hostname: "devbox.example.com",
          username: "julius",
          port: 22,
        },
      }),
    );
  });

  it("disconnects desktop SSH state before forgetting a saved environment", async () => {
    mockSavedRecords = [
      {
        environmentId: EnvironmentId.make("environment-ssh"),
        label: "Devbox",
        httpBaseUrl: "http://127.0.0.1:3774/",
        wsBaseUrl: "ws://127.0.0.1:3774/",
        createdAt: "2026-05-15T00:00:00.000Z",
        lastConnectedAt: "2026-05-15T00:01:00.000Z",
        desktopSsh: {
          alias: "devbox",
          hostname: "devbox.example.com",
          username: "julius",
          port: 22,
        },
      },
    ];

    const { removeSavedEnvironment } = await import("./actions");

    await removeSavedEnvironment(EnvironmentId.make("environment-ssh"));

    expect(mockDisconnectSshEnvironment).toHaveBeenCalledWith({
      alias: "devbox",
      hostname: "devbox.example.com",
      username: "julius",
      port: 22,
    });
    expect(mockRemove).toHaveBeenCalledWith(EnvironmentId.make("environment-ssh"));
    expect(mockRemoveSavedEnvironmentBearerToken).toHaveBeenCalledWith(
      EnvironmentId.make("environment-ssh"),
    );
  });

  it("reconnects a saved non-SSH environment with persisted credentials", async () => {
    mockSavedRecords = [
      {
        environmentId: EnvironmentId.make("environment-1"),
        label: "Remote environment",
        httpBaseUrl: "https://remote.example.com/",
        wsBaseUrl: "wss://remote.example.com/",
        createdAt: "2026-05-15T00:00:00.000Z",
        lastConnectedAt: "2026-05-15T00:01:00.000Z",
      },
    ];

    const { reconnectSavedEnvironment } = await import("./actions");

    const record = await reconnectSavedEnvironment(EnvironmentId.make("environment-1"));

    expect(mockReadSavedEnvironmentBearerToken).toHaveBeenCalledWith(
      EnvironmentId.make("environment-1"),
    );
    expect(mockFetchRemoteSessionState).toHaveBeenCalledWith({
      httpBaseUrl: "https://remote.example.com/",
      bearerToken: "saved-bearer-token",
    });
    expect(mockFetchRemoteEnvironmentDescriptor).toHaveBeenCalledWith({
      httpBaseUrl: "https://remote.example.com/",
    });
    expect(record.lastConnectedAt).not.toBe("2026-05-15T00:01:00.000Z");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        environmentId: EnvironmentId.make("environment-1"),
        label: "Remote environment",
      }),
    );
  });

  it("fails clearly when a saved non-SSH environment is missing credentials", async () => {
    mockSavedRecords = [
      {
        environmentId: EnvironmentId.make("environment-1"),
        label: "Remote environment",
        httpBaseUrl: "https://remote.example.com/",
        wsBaseUrl: "wss://remote.example.com/",
        createdAt: "2026-05-15T00:00:00.000Z",
        lastConnectedAt: null,
      },
    ];
    mockReadSavedEnvironmentBearerToken.mockResolvedValue(null);

    const { reconnectSavedEnvironment } = await import("./actions");

    await expect(reconnectSavedEnvironment(EnvironmentId.make("environment-1"))).rejects.toThrow(
      "Saved environment credentials are missing. Add a new pairing link.",
    );

    expect(mockFetchRemoteSessionState).not.toHaveBeenCalled();
  });

  it("fails clearly when a saved non-SSH environment session is unauthenticated", async () => {
    mockSavedRecords = [
      {
        environmentId: EnvironmentId.make("environment-1"),
        label: "Remote environment",
        httpBaseUrl: "https://remote.example.com/",
        wsBaseUrl: "wss://remote.example.com/",
        createdAt: "2026-05-15T00:00:00.000Z",
        lastConnectedAt: null,
      },
    ];
    mockFetchRemoteSessionState.mockResolvedValue({
      authenticated: false,
      auth: {
        kind: "bearer",
      },
      role: "owner",
    });

    const { reconnectSavedEnvironment } = await import("./actions");

    await expect(reconnectSavedEnvironment(EnvironmentId.make("environment-1"))).rejects.toThrow(
      "Saved environment credentials expired. Add a new pairing link.",
    );

    expect(mockFetchRemoteEnvironmentDescriptor).not.toHaveBeenCalled();
  });
});
