import type {
  OrchestrationGetCheckpointFileInput,
  OrchestrationGetCheckpointFileResult,
} from "@t3tools/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { CheckpointServiceError } from "../Errors.ts";

export interface CheckpointFileQueryShape {
  readonly getCheckpointFile: (
    input: OrchestrationGetCheckpointFileInput,
  ) => Effect.Effect<OrchestrationGetCheckpointFileResult, CheckpointServiceError>;
}

export class CheckpointFileQuery extends ServiceMap.Service<
  CheckpointFileQuery,
  CheckpointFileQueryShape
>()("t3/checkpointing/Services/CheckpointFileQuery") {}
