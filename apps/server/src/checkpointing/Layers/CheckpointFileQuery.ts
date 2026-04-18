import path from "node:path";

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
  CheckpointFileQuery,
  type CheckpointFileQueryShape,
} from "../Services/CheckpointFileQuery.ts";

const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024;
const MAX_IMAGE_PREVIEW_BYTES = 8 * 1024 * 1024;
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdown", ".mkd"]);

function resolveLanguage(relativePath: string): string {
  const extension = path.extname(relativePath).toLowerCase();
  switch (extension) {
    case ".md":
    case ".markdown":
    case ".mdown":
    case ".mkd":
      return "markdown";
    case ".sh":
      return "bash";
    case ".yml":
      return "yaml";
    default:
      return extension.length > 1 ? extension.slice(1) : "text";
  }
}

function isMarkdownPath(relativePath: string): boolean {
  return MARKDOWN_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

function classifyLineEnding(text: string): "lf" | "crlf" | "cr" | "none" {
  if (text.length === 0) {
    return "none";
  }
  if (text.includes("\r\n")) {
    return "crlf";
  }
  if (text.includes("\r")) {
    return "cr";
  }
  return "lf";
}

function decodeUtf8Text(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) {
    return null;
  }

  let suspiciousControlBytes = 0;
  for (const byte of bytes) {
    if (byte === 9 || byte === 10 || byte === 13) {
      continue;
    }
    if (byte < 32) {
      suspiciousControlBytes += 1;
    }
  }

  if (bytes.length > 0 && suspiciousControlBytes / bytes.length > 0.05) {
    return null;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

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

    if (fileStats.mimeType.startsWith("image/")) {
      if (fileStats.byteSize > MAX_IMAGE_PREVIEW_BYTES) {
        return {
          kind: "too-large",
          path: resolvedPath.relativePath,
          previewKind: "image",
          mimeType: fileStats.mimeType,
          byteSize: fileStats.byteSize,
          maxPreviewBytes: MAX_IMAGE_PREVIEW_BYTES,
        } satisfies OrchestrationGetCheckpointFileResult;
      }

      const imageBytes = yield* checkpointStore.readCheckpointFileBytes({
        cwd: workspaceCwd,
        checkpointRef,
        relativePath: resolvedPath.relativePath,
      });
      if (!imageBytes) {
        return {
          kind: "missing",
          path: resolvedPath.relativePath,
          reason: "not-found",
        } satisfies OrchestrationGetCheckpointFileResult;
      }

      return {
        kind: "image",
        path: resolvedPath.relativePath,
        dataUrl: `data:${fileStats.mimeType};base64,${Buffer.from(imageBytes).toString("base64")}`,
        mimeType: fileStats.mimeType,
        byteSize: fileStats.byteSize,
      } satisfies OrchestrationGetCheckpointFileResult;
    }

    if (fileStats.byteSize > MAX_TEXT_PREVIEW_BYTES) {
      return {
        kind: "too-large",
        path: resolvedPath.relativePath,
        previewKind: "text",
        mimeType: fileStats.mimeType,
        byteSize: fileStats.byteSize,
        maxPreviewBytes: MAX_TEXT_PREVIEW_BYTES,
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

    const decodedText = decodeUtf8Text(fileBytes);
    if (decodedText === null) {
      return {
        kind: "binary",
        path: resolvedPath.relativePath,
        mimeType: fileStats.mimeType,
        byteSize: fileStats.byteSize,
      } satisfies OrchestrationGetCheckpointFileResult;
    }

    return {
      kind: "text",
      path: resolvedPath.relativePath,
      text: decodedText,
      mimeType: fileStats.mimeType,
      byteSize: fileStats.byteSize,
      language: resolveLanguage(resolvedPath.relativePath),
      lineEnding: classifyLineEnding(decodedText),
      isMarkdown: isMarkdownPath(resolvedPath.relativePath),
    } satisfies OrchestrationGetCheckpointFileResult;
  });

  return {
    getCheckpointFile,
  } satisfies CheckpointFileQueryShape;
});

export const CheckpointFileQueryLive = Layer.effect(CheckpointFileQuery, make);
