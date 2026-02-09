import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";

import type { WsResponseMessage, WsServerMessage } from "@acme/contracts";
import { startRuntimeApiServer } from "./runtimeApiServer";

function withTimeout<T>(promise: Promise<T>, timeoutMs = 5_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for websocket message."));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function connectClient(url: string) {
  const queuedMessages: WsServerMessage[] = [];
  const pendingResolvers: Array<(message: WsServerMessage) => void> = [];
  const socket = new WebSocket(url);
  socket.on("message", (raw) => {
    let parsed: WsServerMessage;
    try {
      parsed = JSON.parse(raw.toString()) as WsServerMessage;
    } catch {
      return;
    }

    const pending = pendingResolvers.shift();
    if (pending) {
      pending(parsed);
      return;
    }

    queuedMessages.push(parsed);
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", (error) => reject(error));
  });

  const nextMessage = async () => {
    const queued = queuedMessages.shift();
    if (queued) {
      return queued;
    }

    return withTimeout(
      new Promise<WsServerMessage>((resolve) => {
        pendingResolvers.push(resolve);
      }),
    );
  };

  return {
    socket,
    nextMessage,
  };
}

async function sendRequest(
  socket: WebSocket,
  nextMessage: () => Promise<WsServerMessage>,
  id: string,
  method: string,
  params?: unknown,
): Promise<WsResponseMessage> {
  socket.send(
    JSON.stringify({
      type: "request",
      id,
      method,
      params,
    }),
  );

  const waitForMatchingResponse = async (): Promise<WsResponseMessage> => {
    const message = await nextMessage();
    if (message.type !== "response") {
      return waitForMatchingResponse();
    }
    if (message.id !== id) {
      return waitForMatchingResponse();
    }

    return message;
  };

  return waitForMatchingResponse();
}

const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  const snapshot = [...servers];
  servers.length = 0;
  await Promise.all(snapshot.map((server) => server.close()));
});

describe("runtimeApiServer", () => {
  it("responds to todos.list over websocket RPC", async () => {
    const server = await startRuntimeApiServer({
      port: 0,
      launchCwd: process.cwd(),
    });
    servers.push(server);

    const client = await connectClient(server.wsUrl);
    const hello = await client.nextMessage();
    expect(hello.type).toBe("hello");

    const response = await sendRequest(
      client.socket,
      client.nextMessage,
      "todos-1",
      "todos.list",
    );
    expect(response.ok).toBe(true);
    expect(Array.isArray(response.result)).toBe(true);

    client.socket.close();
  });

  it("accepts buffer-encoded websocket request payloads", async () => {
    const server = await startRuntimeApiServer({
      port: 0,
      launchCwd: process.cwd(),
    });
    servers.push(server);

    const client = await connectClient(server.wsUrl);
    await client.nextMessage();

    client.socket.send(
      Buffer.from(
        JSON.stringify({
          type: "request",
          id: "buffer-todos-1",
          method: "todos.list",
        }),
      ),
    );

    const response = await withTimeout(
      (async (): Promise<WsResponseMessage> => {
        const message = await client.nextMessage();
        if (message.type === "response" && message.id === "buffer-todos-1") {
          return message;
        }
        return Promise.reject(new Error("Expected matching todos response."));
      })(),
    );
    expect(response.ok).toBe(true);
    expect(Array.isArray(response.result)).toBe(true);

    client.socket.close();
  });

  it("replaces an existing websocket client with a new one", async () => {
    const server = await startRuntimeApiServer({
      port: 0,
      launchCwd: process.cwd(),
    });
    servers.push(server);

    const firstClient = await connectClient(server.wsUrl);
    await firstClient.nextMessage();

    const firstClose = new Promise<{ code: number }>((resolve) => {
      firstClient.socket.once("close", (code) => resolve({ code }));
    });

    const secondClient = await connectClient(server.wsUrl);
    await secondClient.nextMessage();

    const closed = await withTimeout(firstClose);
    expect(closed.code).toBe(4000);

    const response = await sendRequest(
      secondClient.socket,
      secondClient.nextMessage,
      "todos-2",
      "todos.list",
    );
    expect(response.ok).toBe(true);

    secondClient.socket.close();
  });

  it("requires auth token when runtime is configured with one", async () => {
    const server = await startRuntimeApiServer({
      port: 0,
      launchCwd: process.cwd(),
      authToken: "secret-token",
    });
    servers.push(server);

    const authorizedUrl = new URL(server.wsUrl);
    expect(authorizedUrl.searchParams.get("token")).toBe("secret-token");
    const unauthorizedUrl = `${authorizedUrl.origin}${authorizedUrl.pathname}`;
    const unauthorizedClient = new WebSocket(unauthorizedUrl);
    const unauthorizedClose = await withTimeout(
      new Promise<{ code: number }>((resolve, reject) => {
        unauthorizedClient.once("close", (code) => resolve({ code }));
        unauthorizedClient.once("error", (error) => reject(error));
      }),
    );
    expect(unauthorizedClose.code).toBe(4001);

    const authorizedClient = await connectClient(server.wsUrl);
    const hello = await authorizedClient.nextMessage();
    expect(hello.type).toBe("hello");
    authorizedClient.socket.close();
  });

  it("does not evict authorized client when unauthorized client connects", async () => {
    const server = await startRuntimeApiServer({
      port: 0,
      launchCwd: process.cwd(),
      authToken: "secret-token",
    });
    servers.push(server);

    const authorizedClient = await connectClient(server.wsUrl);
    await authorizedClient.nextMessage();

    const authorizedClose = new Promise<{ code: number }>((resolve) => {
      authorizedClient.socket.once("close", (code) => resolve({ code }));
    });

    const authorizedUrl = new URL(server.wsUrl);
    const unauthorizedUrl = `${authorizedUrl.origin}${authorizedUrl.pathname}`;
    const unauthorizedClient = new WebSocket(unauthorizedUrl);
    const unauthorizedClose = await withTimeout(
      new Promise<{ code: number }>((resolve, reject) => {
        unauthorizedClient.once("close", (code) => resolve({ code }));
        unauthorizedClient.once("error", (error) => reject(error));
      }),
    );
    expect(unauthorizedClose.code).toBe(4001);

    const response = await sendRequest(
      authorizedClient.socket,
      authorizedClient.nextMessage,
      "todos-auth-1",
      "todos.list",
    );
    expect(response.ok).toBe(true);

    authorizedClient.socket.close();
    const closed = await withTimeout(authorizedClose);
    expect([1000, 1005]).toContain(closed.code);
  });

  it("returns a bootstrap payload even when codex cannot initialize", async () => {
    const originalPath = process.env.PATH;
    process.env.PATH = "";
    try {
      const server = await startRuntimeApiServer({
        port: 0,
        launchCwd: process.cwd(),
        bootstrapSessionTimeoutMs: 100,
      });
      servers.push(server);

      const client = await connectClient(server.wsUrl);
      await client.nextMessage();

      const response = await sendRequest(
        client.socket,
        client.nextMessage,
        "bootstrap-1",
        "app.bootstrap",
      );
      expect(response.ok).toBe(true);
      if (!response.ok) {
        throw new Error("Expected successful bootstrap response payload.");
      }

      const payload = response.result as {
        session: { status: string };
        bootstrapError?: string;
      };
      expect(payload.session.status).toBe("error");
      expect(typeof payload.bootstrapError).toBe("string");
      expect((payload.bootstrapError ?? "").length).toBeGreaterThan(0);

      client.socket.close();
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it("handles repeated bootstrap requests under failure conditions", async () => {
    const originalPath = process.env.PATH;
    process.env.PATH = "";
    try {
      const server = await startRuntimeApiServer({
        port: 0,
        launchCwd: process.cwd(),
        bootstrapSessionTimeoutMs: 100,
      });
      servers.push(server);

      const client = await connectClient(server.wsUrl);
      await client.nextMessage();

      const first = await sendRequest(
        client.socket,
        client.nextMessage,
        "bootstrap-repeat-1",
        "app.bootstrap",
      );
      const second = await sendRequest(
        client.socket,
        client.nextMessage,
        "bootstrap-repeat-2",
        "app.bootstrap",
      );

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) {
        throw new Error("Expected both bootstrap responses to succeed.");
      }

      const firstSession = first.result as { session: { sessionId: string; status: string } };
      const secondSession = second.result as { session: { sessionId: string; status: string } };
      expect(firstSession.session.status).toBe("error");
      expect(firstSession.session.sessionId.length).toBeGreaterThan(0);
      expect(secondSession.session.sessionId.length).toBeGreaterThan(0);
      expect(secondSession.session.status).not.toBe("closed");

      client.socket.close();
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it("returns structured errors for unknown methods", async () => {
    const server = await startRuntimeApiServer({
      port: 0,
      launchCwd: process.cwd(),
    });
    servers.push(server);

    const client = await connectClient(server.wsUrl);
    await client.nextMessage();

    const response = await sendRequest(
      client.socket,
      client.nextMessage,
      "unknown-1",
      "unknown.method",
    );
    expect(response.ok).toBe(false);
    if (response.ok) {
      throw new Error("Expected unknown method to fail.");
    }
    expect(response.error?.code).toBe("request_failed");
    expect(response.error?.message).toContain("Unknown API method");

    client.socket.close();
  });

  it("reports runtime health metadata", async () => {
    const server = await startRuntimeApiServer({
      port: 0,
      launchCwd: process.cwd(),
    });
    servers.push(server);

    const client = await connectClient(server.wsUrl);
    await client.nextMessage();

    const response = await sendRequest(
      client.socket,
      client.nextMessage,
      "health-1",
      "app.health",
    );
    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error("Expected health response to succeed.");
    }

    const payload = response.result as {
      status: string;
      launchCwd: string;
      sessionCount: number;
      activeClientConnected: boolean;
    };
    expect(payload.status).toBe("ok");
    expect(payload.launchCwd).toBe(process.cwd());
    expect(typeof payload.sessionCount).toBe("number");
    expect(payload.activeClientConnected).toBe(true);

    client.socket.close();
  });
});
