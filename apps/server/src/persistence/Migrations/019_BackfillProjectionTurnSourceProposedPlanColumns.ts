import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const columns = yield* sql`PRAGMA table_info(projection_turns)`.values;
  const hasSourceProposedPlanThreadIdColumn = columns.some(
    (column) => column[1] === "source_proposed_plan_thread_id",
  );
  const hasSourceProposedPlanIdColumn = columns.some(
    (column) => column[1] === "source_proposed_plan_id",
  );

  if (!hasSourceProposedPlanThreadIdColumn) {
    yield* sql`
      ALTER TABLE projection_turns
      ADD COLUMN source_proposed_plan_thread_id TEXT
    `;
  }

  if (!hasSourceProposedPlanIdColumn) {
    yield* sql`
      ALTER TABLE projection_turns
      ADD COLUMN source_proposed_plan_id TEXT
    `;
  }
});
