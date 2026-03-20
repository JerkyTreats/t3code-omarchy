import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const columns = yield* sql`PRAGMA table_info(projection_thread_proposed_plans)`.values;
  const hasImplementedAtColumn = columns.some((column) => column[1] === "implemented_at");
  const hasImplementationThreadIdColumn = columns.some(
    (column) => column[1] === "implementation_thread_id",
  );

  if (!hasImplementedAtColumn) {
    yield* sql`
      ALTER TABLE projection_thread_proposed_plans
      ADD COLUMN implemented_at TEXT
    `;
  }

  if (!hasImplementationThreadIdColumn) {
    yield* sql`
      ALTER TABLE projection_thread_proposed_plans
      ADD COLUMN implementation_thread_id TEXT
    `;
  }
});
