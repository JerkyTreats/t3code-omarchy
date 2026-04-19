import { Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectReadFileInput, ProjectReadFileResult } from "@t3tools/contracts";
import { WorkspacePathOutsideRootError } from "./WorkspacePaths.ts";

export class WorkspaceFileQueryError extends Schema.TaggedErrorClass<WorkspaceFileQueryError>()(
  "WorkspaceFileQueryError",
  {
    cwd: Schema.String,
    relativePath: Schema.optional(Schema.String),
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {}

export interface WorkspaceFileQueryShape {
  readonly readFile: (
    input: ProjectReadFileInput,
  ) => Effect.Effect<
    ProjectReadFileResult,
    WorkspaceFileQueryError | WorkspacePathOutsideRootError
  >;
}

export class WorkspaceFileQuery extends ServiceMap.Service<
  WorkspaceFileQuery,
  WorkspaceFileQueryShape
>()("t3/workspace/Services/WorkspaceFileQuery") {}
