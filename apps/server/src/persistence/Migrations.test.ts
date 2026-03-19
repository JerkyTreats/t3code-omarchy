import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Migrator from "effect/unstable/sql/Migrator";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import Migration0001 from "./Migrations/001_OrchestrationEvents.ts";
import Migration0002 from "./Migrations/002_OrchestrationCommandReceipts.ts";
import Migration0003 from "./Migrations/003_CheckpointDiffBlobs.ts";
import Migration0004 from "./Migrations/004_ProviderSessionRuntime.ts";
import Migration0005 from "./Migrations/005_Projections.ts";
import Migration0006 from "./Migrations/006_ProjectionThreadSessionRuntimeModeColumns.ts";
import Migration0007 from "./Migrations/007_ProjectionThreadMessageAttachments.ts";
import Migration0008 from "./Migrations/008_ProjectionThreadActivitySequence.ts";
import Migration0009 from "./Migrations/009_ProviderSessionRuntimeMode.ts";
import Migration0010 from "./Migrations/010_ProjectionThreadsRuntimeMode.ts";
import Migration0011 from "./Migrations/011_OrchestrationThreadCreatedRuntimeMode.ts";
import Migration0012 from "./Migrations/012_ProjectionThreadsInteractionMode.ts";
import Migration0013 from "./Migrations/013_ProjectionThreadProposedPlans.ts";
import Migration0016 from "./Migrations/016_ProjectionThreadsIssueLink.ts";
import Migration0017 from "./Migrations/017_BackfillProjectionThreadIssueLinks.ts";
import { runMigrations } from "./Migrations.ts";
import { makeSqlitePersistenceLive } from "./Layers/Sqlite.ts";

const oldLoader = Migrator.fromRecord({
  "1_OrchestrationEvents": Migration0001,
  "2_OrchestrationCommandReceipts": Migration0002,
  "3_CheckpointDiffBlobs": Migration0003,
  "4_ProviderSessionRuntime": Migration0004,
  "5_Projections": Migration0005,
  "6_ProjectionThreadSessionRuntimeModeColumns": Migration0006,
  "7_ProjectionThreadMessageAttachments": Migration0007,
  "8_ProjectionThreadActivitySequence": Migration0008,
  "9_ProviderSessionRuntimeMode": Migration0009,
  "10_ProjectionThreadsRuntimeMode": Migration0010,
  "11_OrchestrationThreadCreatedRuntimeMode": Migration0011,
  "12_ProjectionThreadsInteractionMode": Migration0012,
  "13_ProjectionThreadProposedPlans": Migration0013,
  "14_ProjectionThreadsIssueLink": Migration0016,
  "15_BackfillProjectionThreadIssueLinks": Migration0017,
});

const runOldMigrations = Migrator.make({});

describe("runMigrations", () => {
  it("repairs databases created before the migration id shift", async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "t3code-migrations-"));
    const dbPath = path.join(tempDir, "state.sqlite");
    const persistenceLayer = makeSqlitePersistenceLive(dbPath).pipe(
      Layer.provide(NodeServices.layer),
    );

    const program = Effect.gen(function* () {
      yield* runOldMigrations({ loader: oldLoader });

      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        INSERT INTO projection_thread_proposed_plans (
          plan_id,
          thread_id,
          turn_id,
          plan_markdown,
          created_at,
          updated_at
        ) VALUES (
          'plan-1',
          'thread-1',
          'turn-1',
          '1. Repair migrations',
          '2026-03-19T00:00:00.000Z',
          '2026-03-19T00:00:00.000Z'
        )
      `;
      yield* sql`
        INSERT INTO projection_turns (
          thread_id,
          turn_id,
          pending_message_id,
          assistant_message_id,
          state,
          requested_at,
          started_at,
          completed_at,
          checkpoint_turn_count,
          checkpoint_ref,
          checkpoint_status,
          checkpoint_files_json
        ) VALUES (
          'thread-1',
          'turn-1',
          NULL,
          NULL,
          'completed',
          '2026-03-19T00:00:00.000Z',
          '2026-03-19T00:00:00.000Z',
          '2026-03-19T00:00:01.000Z',
          NULL,
          NULL,
          NULL,
          '[]'
        )
      `;

      yield* runMigrations;

      const proposedPlanColumns = yield* sql`PRAGMA table_info(projection_thread_proposed_plans)`
        .values;
      const turnColumns = yield* sql`PRAGMA table_info(projection_turns)`.values;

      return {
        proposedPlanColumns: proposedPlanColumns.map((column) => String(column[1])),
        turnColumns: turnColumns.map((column) => String(column[1])),
      };
    }).pipe(Effect.provide(persistenceLayer));

    try {
      const result = await Effect.runPromise(program);

      expect(result.proposedPlanColumns).toContain("implemented_at");
      expect(result.proposedPlanColumns).toContain("implementation_thread_id");
      expect(result.turnColumns).toContain("source_proposed_plan_thread_id");
      expect(result.turnColumns).toContain("source_proposed_plan_id");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
