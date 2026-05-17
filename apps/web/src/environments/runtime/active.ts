import type { EnvironmentId } from "@t3tools/contracts";
import { create } from "zustand";

const ACTIVE_REMOTE_ENVIRONMENT_STORAGE_KEY = "t3code:active-remote-environment:v1";

export interface ActiveRemoteEnvironmentSession {
  readonly environmentId: EnvironmentId;
  readonly label: string;
  readonly httpBaseUrl: string;
  readonly wsBaseUrl: string;
  readonly bearerToken: string;
  readonly webSocketToken: string;
  readonly activatedAt: string;
}

interface ActiveRemoteEnvironmentStoreState {
  readonly session: ActiveRemoteEnvironmentSession | null;
  readonly setSession: (session: ActiveRemoteEnvironmentSession | null) => void;
  readonly reset: () => void;
}

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function isActiveRemoteEnvironmentSession(value: unknown): value is ActiveRemoteEnvironmentSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.environmentId === "string" &&
    typeof candidate.label === "string" &&
    typeof candidate.httpBaseUrl === "string" &&
    typeof candidate.wsBaseUrl === "string" &&
    typeof candidate.bearerToken === "string" &&
    typeof candidate.webSocketToken === "string" &&
    typeof candidate.activatedAt === "string"
  );
}

function readPersistedActiveRemoteEnvironmentSession(): ActiveRemoteEnvironmentSession | null {
  if (!hasWindow()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ACTIVE_REMOTE_ENVIRONMENT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    return isActiveRemoteEnvironmentSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistActiveRemoteEnvironmentSession(
  session: ActiveRemoteEnvironmentSession | null,
): void {
  if (!hasWindow()) {
    return;
  }

  if (session === null) {
    window.localStorage.removeItem(ACTIVE_REMOTE_ENVIRONMENT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ACTIVE_REMOTE_ENVIRONMENT_STORAGE_KEY, JSON.stringify(session));
}

export const useActiveRemoteEnvironmentStore = create<ActiveRemoteEnvironmentStoreState>()(
  (set) => ({
    session: readPersistedActiveRemoteEnvironmentSession(),
    setSession: (session) => {
      persistActiveRemoteEnvironmentSession(session);
      set({ session });
    },
    reset: () => {
      persistActiveRemoteEnvironmentSession(null);
      set({ session: null });
    },
  }),
);

export function readActiveRemoteEnvironmentSession(): ActiveRemoteEnvironmentSession | null {
  return useActiveRemoteEnvironmentStore.getState().session;
}

export function setActiveRemoteEnvironmentSession(
  session: ActiveRemoteEnvironmentSession | null,
): void {
  useActiveRemoteEnvironmentStore.getState().setSession(session);
}

export function resetActiveRemoteEnvironmentSessionForTests(): void {
  useActiveRemoteEnvironmentStore.getState().reset();
}
