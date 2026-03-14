import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    UPDATE projection_threads
    SET issue_link_json = (
      SELECT json_extract(orchestration_events.payload_json, '$.issueLink')
      FROM orchestration_events
      WHERE orchestration_events.aggregate_kind = 'thread'
        AND orchestration_events.stream_id = projection_threads.thread_id
        AND orchestration_events.event_type IN ('thread.created', 'thread.meta-updated')
        AND json_type(orchestration_events.payload_json, '$.issueLink') = 'object'
      ORDER BY orchestration_events.sequence DESC
      LIMIT 1
    )
    WHERE issue_link_json IS NULL
  `;
});
