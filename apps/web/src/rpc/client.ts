import { WsRpcGroup } from "@t3tools/contracts";
import { Effect, Exit, Layer, ManagedRuntime, Scope } from "effect";
import { AtomRpc } from "effect/unstable/reactivity";
import { RpcClient } from "effect/unstable/rpc";

import {
  __resetClientTracingForTests,
  ClientTracingLive,
  configureClientTracing,
} from "../observability/clientTracing";
import {
  createWsRpcProtocolLayer,
  makeWsRpcProtocolClient,
  type WsRpcProtocolClient,
} from "./protocol";

export class WsRpcAtomClient extends AtomRpc.Service<WsRpcAtomClient>()("WsRpcAtomClient", {
  group: WsRpcGroup,
  protocol: Layer.suspend(() => createWsRpcProtocolLayer()),
}) {}

interface SharedRpcSession {
  readonly clientPromise: Promise<WsRpcProtocolClient>;
  readonly clientScope: Scope.Closeable;
  readonly runtime: ManagedRuntime.ManagedRuntime<RpcClient.Protocol, never>;
}

let sharedSession: SharedRpcSession | null = null;

function getSession(): SharedRpcSession {
  if (sharedSession !== null) {
    return sharedSession;
  }

  const runtime = ManagedRuntime.make(
    Layer.mergeAll(createWsRpcProtocolLayer(), ClientTracingLive),
  );
  const clientScope = runtime.runSync(Scope.make());
  sharedSession = {
    runtime,
    clientScope,
    clientPromise: runtime.runPromise(Scope.provide(clientScope)(makeWsRpcProtocolClient)),
  };
  return sharedSession;
}

function toFlatClient(client: WsRpcProtocolClient): typeof WsRpcAtomClient.Service {
  const structuredClient = client as unknown as Record<
    string,
    ((payload: unknown, options?: unknown) => unknown) | undefined
  >;
  return ((tag, payload, options) => {
    const call = structuredClient[tag as string];
    return call ? call(payload, options) : Effect.die(new Error(`Unknown RPC tag: ${tag}`));
  }) as typeof WsRpcAtomClient.Service;
}

export function runRpc<TSuccess, TError = never>(
  execute: (client: typeof WsRpcAtomClient.Service) => Effect.Effect<TSuccess, TError, never>,
): Promise<TSuccess> {
  return configureClientTracing().then(() => {
    const session = getSession();
    return session.runtime.runPromise(
      Effect.flatMap(
        Effect.promise(() => session.clientPromise),
        (client) => execute(toFlatClient(client)),
      ),
    );
  });
}

export async function __resetWsRpcAtomClientForTests() {
  const session = sharedSession;
  sharedSession = null;
  await session?.runtime
    .runPromise(Scope.close(session.clientScope, Exit.void))
    .catch(() => undefined)
    .finally(() => session?.runtime.dispose());
  await __resetClientTracingForTests();
}
