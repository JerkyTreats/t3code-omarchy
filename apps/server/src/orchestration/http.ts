import {
  ClientOrchestrationCommand,
  OrchestrationDispatchCommandError,
  OrchestrationGetSnapshotError,
  OrchestrationReplayEventsError,
  type OrchestrationReadModel,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import { ServerAuth } from "../auth/Services/ServerAuth.ts";
import { enrichOrchestrationEvents } from "./EventReplay.ts";
import { normalizeDispatchCommand } from "./Normalizer.ts";
import { OrchestrationEngineService } from "./Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "./Services/ProjectionSnapshotQuery.ts";

const respondToOrchestrationHttpError = (
  error:
    | OrchestrationDispatchCommandError
    | OrchestrationGetSnapshotError
    | OrchestrationReplayEventsError,
) =>
  Effect.gen(function* () {
    if (
      error._tag === "OrchestrationGetSnapshotError" ||
      error._tag === "OrchestrationReplayEventsError"
    ) {
      yield* Effect.logError("orchestration http route failed", {
        message: error.message,
        cause: error.cause,
      });
      return HttpServerResponse.jsonUnsafe({ error: error.message }, { status: 500 });
    }

    return HttpServerResponse.jsonUnsafe({ error: error.message }, { status: 400 });
  });

const authenticateOwnerSession = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const serverAuth = yield* ServerAuth;
  const session = yield* serverAuth.authenticateHttpRequest(request);
  if (session.role !== "owner") {
    return yield* new OrchestrationDispatchCommandError({
      message: "Only owner sessions can manage projects.",
    });
  }
  return session;
});

const parseFromSequenceExclusive = (request: HttpServerRequest.HttpServerRequest) =>
  Effect.gen(function* () {
    const url = HttpServerRequest.toURL(request);
    if (Option.isNone(url)) {
      return yield* new OrchestrationDispatchCommandError({
        message: "Invalid orchestration events request.",
      });
    }

    const rawValue = url.value.searchParams.get("fromSequenceExclusive") ?? "0";
    const value = Number(rawValue);
    if (!Number.isSafeInteger(value) || value < 0) {
      return yield* new OrchestrationDispatchCommandError({
        message: "Invalid fromSequenceExclusive query parameter.",
      });
    }

    return value;
  });

export const orchestrationSnapshotRouteLayer = HttpRouter.add(
  "GET",
  "/api/orchestration/snapshot",
  Effect.gen(function* () {
    yield* authenticateOwnerSession;
    const projectionSnapshotQuery = yield* ProjectionSnapshotQuery;
    const snapshot = yield* projectionSnapshotQuery.getSnapshot().pipe(
      Effect.mapError(
        (cause) =>
          new OrchestrationGetSnapshotError({
            message: "Failed to load orchestration snapshot.",
            cause,
          }),
      ),
    );
    return HttpServerResponse.jsonUnsafe(snapshot satisfies OrchestrationReadModel, {
      status: 200,
    });
  }).pipe(
    Effect.catchTag("OrchestrationDispatchCommandError", respondToOrchestrationHttpError),
    Effect.catchTag("OrchestrationGetSnapshotError", respondToOrchestrationHttpError),
  ),
);

export const orchestrationEventsRouteLayer = HttpRouter.add(
  "GET",
  "/api/orchestration/events",
  Effect.gen(function* () {
    yield* authenticateOwnerSession;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const fromSequenceExclusive = yield* parseFromSequenceExclusive(request);
    const orchestrationEngine = yield* OrchestrationEngineService;
    const events = yield* Stream.runCollect(
      orchestrationEngine.readEvents(fromSequenceExclusive),
    ).pipe(
      Effect.map((events) => Array.from(events)),
      Effect.flatMap(enrichOrchestrationEvents),
      Effect.mapError(
        (cause) =>
          new OrchestrationReplayEventsError({
            message: "Failed to replay orchestration events.",
            cause,
          }),
      ),
    );
    return HttpServerResponse.jsonUnsafe(events, { status: 200 });
  }).pipe(
    Effect.catchTag("OrchestrationDispatchCommandError", respondToOrchestrationHttpError),
    Effect.catchTag("OrchestrationReplayEventsError", respondToOrchestrationHttpError),
  ),
);

export const orchestrationDispatchRouteLayer = HttpRouter.add(
  "POST",
  "/api/orchestration/dispatch",
  Effect.gen(function* () {
    yield* authenticateOwnerSession;
    const orchestrationEngine = yield* OrchestrationEngineService;
    const command = yield* HttpServerRequest.schemaBodyJson(ClientOrchestrationCommand).pipe(
      Effect.mapError(
        (cause) =>
          new OrchestrationDispatchCommandError({
            message: "Invalid orchestration command payload.",
            cause,
          }),
      ),
    );
    const normalizedCommand = yield* normalizeDispatchCommand(command);
    const result = yield* orchestrationEngine.dispatch(normalizedCommand).pipe(
      Effect.mapError(
        (cause) =>
          new OrchestrationDispatchCommandError({
            message: "Failed to dispatch orchestration command.",
            cause,
          }),
      ),
    );
    return HttpServerResponse.jsonUnsafe(result, { status: 200 });
  }).pipe(Effect.catchTag("OrchestrationDispatchCommandError", respondToOrchestrationHttpError)),
);
