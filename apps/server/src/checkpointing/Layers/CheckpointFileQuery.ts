import {
  type OrchestrationGetCheckpointFileInput,
  type OrchestrationGetCheckpointFileResult,
} from "@t3tools/contracts";
import { Effect, Layer, Option, Schema } from "effect";

import { ProjectionSnapshotQuery } from "../../orchestration/Services/ProjectionSnapshotQuery.ts";
import {
  WorkspacePathOutsideRootError,
  WorkspacePaths,
} from "../../workspace/Services/WorkspacePaths.ts";
import { CheckpointInvariantError, CheckpointUnavailableError } from "../Errors.ts";
import { CheckpointStore } from "../Services/CheckpointStore.ts";
import { checkpointRefForThreadTurn } from "../Utils.ts";
import {
  buildPreviewResult,
  MAX_IMAGE_PREVIEW_BYTES,
  MAX_TEXT_PREVIEW_BYTES,
} from "../../filePreview.ts";
import {
  CheckpointFileQuery,
  type CheckpointFileQueryShape,
} from "../Services/CheckpointFileQuery.ts";

const make = Effect.gen(function* () {
  const projectionSnapshotQuery = yield* ProjectionSnapshotQuery;
  const checkpointStore = yield* CheckpointStore;
  const workspacePaths = yield* WorkspacePaths;

  const getCheckpointFile: CheckpointFileQueryShape["getCheckpointFile"] = Effect.fn(
    "getCheckpointFile",
  )(function* (input: OrchestrationGetCheckpointFileInput) {
    const operation = "CheckpointFileQuery.getCheckpointFile";
    const threadContext = yield* projectionSnapshotQuery.getThreadCheckpointContext(input.threadId);
    if (Option.isNone(threadContext)) {
      return yield* new CheckpointInvariantError({
        operation,
        detail: `Thread '${input.threadId}' not found.`,
      });
    }

    const maxTurnCount = threadContext.value.checkpoints.reduce(
      (max, checkpoint) => Math.max(max, checkpoint.checkpointTurnCount),
      0,
    );
    if (input.turnCount > maxTurnCount) {
      return yield* new CheckpointUnavailableError({
        threadId: input.threadId,
        turnCount: input.turnCount,
        detail: `Checkpoint file range exceeds current turn count: requested ${input.turnCount}, current ${maxTurnCount}.`,
      });
    }

    const workspaceCwd = threadContext.value.worktreePath ?? threadContext.value.workspaceRoot;
    if (!workspaceCwd) {
      return yield* new CheckpointInvariantError({
        operation,
        detail: `Workspace path missing for thread '${input.threadId}' when reading checkpoint file.`,
      });
    }

    const resolvedPath = yield* workspacePaths
      .resolveRelativePathWithinRoot({
        workspaceRoot: workspaceCwd,
        relativePath: input.relativePath,
      })
      .pipe(
        Effect.mapError((cause) =>
          Schema.is(WorkspacePathOutsideRootError)(cause)
            ? new CheckpointInvariantError({
                operation,
                detail: `Checkpoint file path must stay within the workspace root: ${input.relativePath}`,
                cause,
              })
            : cause,
        ),
      );

    const checkpointRef =
      input.turnCount === 0
        ? checkpointRefForThreadTurn(input.threadId, 0)
        : threadContext.value.checkpoints.find(
            (checkpoint) => checkpoint.checkpointTurnCount === input.turnCount,
          )?.checkpointRef;
    if (!checkpointRef) {
      return yield* new CheckpointUnavailableError({
        threadId: input.threadId,
        turnCount: input.turnCount,
        detail: `Checkpoint ref is unavailable for turn ${input.turnCount}.`,
      });
    }

    const checkpointExists = yield* checkpointStore.hasCheckpointRef({
      cwd: workspaceCwd,
      checkpointRef,
    });
    if (!checkpointExists) {
      return yield* new CheckpointUnavailableError({
        threadId: input.threadId,
        turnCount: input.turnCount,
        detail: `Filesystem checkpoint is unavailable for turn ${input.turnCount}.`,
      });
    }

    const fileStats = yield* checkpointStore.statCheckpointFile({
      cwd: workspaceCwd,
      checkpointRef,
      relativePath: resolvedPath.relativePath,
    });
    if (!fileStats) {
      const selectedCheckpoint = threadContext.value.checkpoints.find(
        (checkpoint) => checkpoint.checkpointTurnCount === input.turnCount,
      );
      const reason =
        selectedCheckpoint?.files.some((file) => file.path === resolvedPath.relativePath) === true
          ? "deleted"
          : "not-found";
      return {
        kind: "missing",
        path: resolvedPath.relativePath,
        reason,
      } satisfies OrchestrationGetCheckpointFileResult;
    }

    const maxPreviewBytes = fileStats.mimeType.startsWith("image/")
      ? MAX_IMAGE_PREVIEW_BYTES
      : MAX_TEXT_PREVIEW_BYTES;
    if (fileStats.byteSize > maxPreviewBytes) {
      return {
        kind: "too-large",
        path: resolvedPath.relativePath,
        previewKind: fileStats.mimeType.startsWith("image/") ? "image" : "text",
        mimeType: fileStats.mimeType,
        byteSize: fileStats.byteSize,
        maxPreviewBytes,
      } satisfies OrchestrationGetCheckpointFileResult;
    }

    const fileBytes = yield* checkpointStore.readCheckpointFileBytes({
      cwd: workspaceCwd,
      checkpointRef,
      relativePath: resolvedPath.relativePath,
    });
    if (!fileBytes) {
      return {
        kind: "missing",
        path: resolvedPath.relativePath,
        reason: "not-found",
      } satisfies OrchestrationGetCheckpointFileResult;
    }

    return buildPreviewResult({
      relativePath: resolvedPath.relativePath,
      mimeType: fileStats.mimeType,
      byteSize: fileStats.byteSize,
      bytes: fileBytes,
    }) satisfies OrchestrationGetCheckpointFileResult;
  });

  return {
    getCheckpointFile,
  } satisfies CheckpointFileQueryShape;
});

export const CheckpointFileQueryLive = Layer.effect(CheckpointFileQuery, make);
