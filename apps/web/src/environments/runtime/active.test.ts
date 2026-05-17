import { EnvironmentId } from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  readActiveRemoteEnvironmentSession,
  resetActiveRemoteEnvironmentSessionForTests,
  setActiveRemoteEnvironmentSession,
} from "./active";

describe("active remote environment session", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        removeItem: vi.fn((key: string) => {
          store.delete(key);
        }),
        setItem: vi.fn((key: string, value: string) => {
          store.set(key, value);
        }),
      },
    });
    resetActiveRemoteEnvironmentSessionForTests();
  });

  afterEach(() => {
    resetActiveRemoteEnvironmentSessionForTests();
    store.clear();
    vi.unstubAllGlobals();
  });

  it("persists and clears the active remote environment session", () => {
    const session = {
      environmentId: EnvironmentId.make("environment-1"),
      label: "Remote environment",
      httpBaseUrl: "https://remote.example.com/",
      wsBaseUrl: "wss://remote.example.com/",
      bearerToken: "bearer-token",
      webSocketToken: "ws-token",
      activatedAt: "2026-05-17T18:00:00.000Z",
    } as const;

    setActiveRemoteEnvironmentSession(session);
    expect(readActiveRemoteEnvironmentSession()).toEqual(session);

    setActiveRemoteEnvironmentSession(null);
    expect(readActiveRemoteEnvironmentSession()).toBeNull();
  });
});

const store = new Map<string, string>();
