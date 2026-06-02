import type { OrchestrationEvent } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { RepositoryIdentityResolver } from "../project/Services/RepositoryIdentityResolver.ts";
import { ProjectionSnapshotQuery } from "./Services/ProjectionSnapshotQuery.ts";

export const enrichOrchestrationEvents = (events: ReadonlyArray<OrchestrationEvent>) =>
  Effect.gen(function* () {
    const projectionSnapshotQuery = yield* ProjectionSnapshotQuery;
    const repositoryIdentityResolver = yield* RepositoryIdentityResolver;

    const enrichProjectEvent = (
      event: OrchestrationEvent,
    ): Effect.Effect<OrchestrationEvent, never, never> => {
      switch (event.type) {
        case "project.created":
          return repositoryIdentityResolver.resolve(event.payload.workspaceRoot).pipe(
            Effect.map((repositoryIdentity) => ({
              ...event,
              payload: {
                ...event.payload,
                repositoryIdentity,
              },
            })),
          );
        case "project.meta-updated":
          return Effect.gen(function* () {
            const workspaceRoot =
              event.payload.workspaceRoot ??
              Option.match(
                yield* projectionSnapshotQuery.getProjectShellById(event.payload.projectId),
                {
                  onNone: () => null,
                  onSome: (project) => project.workspaceRoot,
                },
              ) ??
              null;
            if (workspaceRoot === null) {
              return event;
            }

            const repositoryIdentity = yield* repositoryIdentityResolver.resolve(workspaceRoot);
            return {
              ...event,
              payload: {
                ...event.payload,
                repositoryIdentity,
              },
            } satisfies OrchestrationEvent;
          }).pipe(Effect.catch(() => Effect.succeed(event)));
        default:
          return Effect.succeed(event);
      }
    };

    return yield* Effect.forEach(events, enrichProjectEvent, { concurrency: 4 });
  });
