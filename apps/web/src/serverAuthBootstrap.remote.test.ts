import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockReadActiveRemoteEnvironmentSession = vi.fn();
const mockSetActiveRemoteEnvironmentSession = vi.fn();
const mockFetchRemoteSessionState = vi.fn();
const mockIssueRemoteWebSocketToken = vi.fn();

vi.mock("./environments/runtime/active", () => ({
  readActiveRemoteEnvironmentSession: mockReadActiveRemoteEnvironmentSession,
  setActiveRemoteEnvironmentSession: mockSetActiveRemoteEnvironmentSession,
}));

vi.mock("./environments/remote/api", () => ({
  fetchRemoteSessionState: mockFetchRemoteSessionState,
  issueRemoteWebSocketToken: mockIssueRemoteWebSocketToken,
}));

describe("server auth bootstrap with active remote environments", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReadActiveRemoteEnvironmentSession.mockReset();
    mockSetActiveRemoteEnvironmentSession.mockReset();
    mockFetchRemoteSessionState.mockReset();
    mockIssueRemoteWebSocketToken.mockReset();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        clearTimeout: globalThis.clearTimeout,
        desktopBridge: undefined,
        location: {
          href: "https://app.t3.codes/",
          origin: "https://app.t3.codes",
        },
        setTimeout: globalThis.setTimeout,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("authenticates through the active saved remote environment", async () => {
    mockReadActiveRemoteEnvironmentSession.mockReturnValue({
      environmentId: "environment-1",
      label: "Remote environment",
      httpBaseUrl: "https://remote.example.com/",
      wsBaseUrl: "wss://remote.example.com/",
      bearerToken: "bearer-token",
      webSocketToken: "stale-token",
      activatedAt: "2026-05-17T18:00:00.000Z",
    });
    mockFetchRemoteSessionState.mockResolvedValue({
      authenticated: true,
      auth: {
        kind: "bearer",
      },
      role: "owner",
    });
    mockIssueRemoteWebSocketToken.mockResolvedValue({
      token: "fresh-ws-token",
    });

    const {
      __readServerAuthGateStateForTests,
      __resetServerAuthGateBootstrapForTests,
      startServerAuthGateBootstrap,
    } = await import("./serverAuthBootstrap");
    __resetServerAuthGateBootstrapForTests();

    const state = await startServerAuthGateBootstrap();

    expect(state).toEqual({ status: "authenticated" });
    expect(__readServerAuthGateStateForTests()).toEqual({ status: "authenticated" });
    expect(mockFetchRemoteSessionState).toHaveBeenCalledWith({
      httpBaseUrl: "https://remote.example.com/",
      bearerToken: "bearer-token",
    });
    expect(mockSetActiveRemoteEnvironmentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        webSocketToken: "fresh-ws-token",
      }),
    );
  });
});
