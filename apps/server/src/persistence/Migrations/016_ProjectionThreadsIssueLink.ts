import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const columns = yield* sql`PRAGMA table_info(projection_threads)`.values;
  const hasIssueLinkColumn = columns.some((column) => column[1] === "issue_link_json");
  if (hasIssueLinkColumn) {
    return;
  }

  yield* sql`
    ALTER TABLE projection_threads
    ADD COLUMN issue_link_json TEXT
  `;
});
