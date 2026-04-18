/**
 * CheckpointStoreLive - Filesystem checkpoint store adapter layer.
 *
 * Implements hidden Git-ref checkpoint capture/restore directly with
 * Effect-native child process execution (`effect/unstable/process`).
 *
 * This layer owns filesystem/Git interactions only; it does not persist
 * checkpoint metadata and does not coordinate provider rollback semantics.
 *
 * @module CheckpointStoreLive
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import Mime from "@effect/platform-node/Mime";
import { Effect, Layer, FileSystem, Path } from "effect";

import { CheckpointInvariantError } from "../Errors.ts";
import { GitCommandError } from "@t3tools/contracts";
import { GitCore } from "../../git/Services/GitCore.ts";
import {
  CheckpointStore,
  type CheckpointStoreShape,
  type CheckpointFileStat,
} from "../Services/CheckpointStore.ts";
import { CheckpointRef } from "@t3tools/contracts";

const makeCheckpointStore = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const git = yield* GitCore;

  const resolveHeadCommit = (cwd: string): Effect.Effect<string | null, GitCommandError> =>
    git
      .execute({
        operation: "CheckpointStore.resolveHeadCommit",
        cwd,
        args: ["rev-parse", "--verify", "--quiet", "HEAD^{commit}"],
        allowNonZeroExit: true,
      })
      .pipe(
        Effect.map((result) => {
          if (result.code !== 0) {
            return null;
          }
          const commit = result.stdout.trim();
          return commit.length > 0 ? commit : null;
        }),
      );

  const hasHeadCommit = (cwd: string): Effect.Effect<boolean, GitCommandError> =>
    git
      .execute({
        operation: "CheckpointStore.hasHeadCommit",
        cwd,
        args: ["rev-parse", "--verify", "HEAD"],
        allowNonZeroExit: true,
      })
      .pipe(Effect.map((result) => result.code === 0));

  const resolveCheckpointCommit = (
    cwd: string,
    checkpointRef: CheckpointRef,
  ): Effect.Effect<string | null, GitCommandError> =>
    git
      .execute({
        operation: "CheckpointStore.resolveCheckpointCommit",
        cwd,
        args: ["rev-parse", "--verify", "--quiet", `${checkpointRef}^{commit}`],
        allowNonZeroExit: true,
      })
      .pipe(
        Effect.map((result) => {
          if (result.code !== 0) {
            return null;
          }
          const commit = result.stdout.trim();
          return commit.length > 0 ? commit : null;
        }),
      );

  const isGitRepository: CheckpointStoreShape["isGitRepository"] = (cwd) =>
    git
      .execute({
        operation: "CheckpointStore.isGitRepository",
        cwd,
        args: ["rev-parse", "--is-inside-work-tree"],
        allowNonZeroExit: true,
      })
      .pipe(
        Effect.map((result) => result.code === 0 && result.stdout.trim() === "true"),
        Effect.catch(() => Effect.succeed(false)),
      );

  const captureCheckpoint: CheckpointStoreShape["captureCheckpoint"] = Effect.fn(
    "captureCheckpoint",
  )(function* (input) {
    const operation = "CheckpointStore.captureCheckpoint";

    yield* Effect.acquireUseRelease(
      fs.makeTempDirectory({ prefix: "t3-fs-checkpoint-" }),
      Effect.fn("captureCheckpoint.withTempDirectory")(function* (tempDir) {
        const tempIndexPath = path.join(tempDir, `index-${randomUUID()}`);
        const commitEnv: NodeJS.ProcessEnv = {
          ...process.env,
          GIT_INDEX_FILE: tempIndexPath,
          GIT_AUTHOR_NAME: "T3 Code",
          GIT_AUTHOR_EMAIL: "t3code@users.noreply.github.com",
          GIT_COMMITTER_NAME: "T3 Code",
          GIT_COMMITTER_EMAIL: "t3code@users.noreply.github.com",
        };

        const headExists = yield* hasHeadCommit(input.cwd);
        if (headExists) {
          yield* git.execute({
            operation,
            cwd: input.cwd,
            args: ["read-tree", "HEAD"],
            env: commitEnv,
          });
        }

        yield* git.execute({
          operation,
          cwd: input.cwd,
          args: ["add", "-A", "--", "."],
          env: commitEnv,
        });

        const writeTreeResult = yield* git.execute({
          operation,
          cwd: input.cwd,
          args: ["write-tree"],
          env: commitEnv,
        });
        const treeOid = writeTreeResult.stdout.trim();
        if (treeOid.length === 0) {
          return yield* new GitCommandError({
            operation,
            command: "git write-tree",
            cwd: input.cwd,
            detail: "git write-tree returned an empty tree oid.",
          });
        }

        const message = `t3 checkpoint ref=${input.checkpointRef}`;
        const commitTreeResult = yield* git.execute({
          operation,
          cwd: input.cwd,
          args: ["commit-tree", treeOid, "-m", message],
          env: commitEnv,
        });
        const commitOid = commitTreeResult.stdout.trim();
        if (commitOid.length === 0) {
          return yield* new GitCommandError({
            operation,
            command: "git commit-tree",
            cwd: input.cwd,
            detail: "git commit-tree returned an empty commit oid.",
          });
        }

        yield* git.execute({
          operation,
          cwd: input.cwd,
          args: ["update-ref", input.checkpointRef, commitOid],
        });
      }),
      (tempDir) => fs.remove(tempDir, { recursive: true }),
    ).pipe(
      Effect.catchTags({
        PlatformError: (error) =>
          Effect.fail(
            new CheckpointInvariantError({
              operation: "CheckpointStore.captureCheckpoint",
              detail: "Failed to capture checkpoint.",
              cause: error,
            }),
          ),
      }),
    );
  });

  const hasCheckpointRef: CheckpointStoreShape["hasCheckpointRef"] = (input) =>
    resolveCheckpointCommit(input.cwd, input.checkpointRef).pipe(
      Effect.map((commit) => commit !== null),
    );

  const restoreCheckpoint: CheckpointStoreShape["restoreCheckpoint"] = Effect.fn(
    "restoreCheckpoint",
  )(function* (input) {
    const operation = "CheckpointStore.restoreCheckpoint";

    let commitOid = yield* resolveCheckpointCommit(input.cwd, input.checkpointRef);

    if (!commitOid && input.fallbackToHead === true) {
      commitOid = yield* resolveHeadCommit(input.cwd);
    }

    if (!commitOid) {
      return false;
    }

    yield* git.execute({
      operation,
      cwd: input.cwd,
      args: ["restore", "--source", commitOid, "--worktree", "--staged", "--", "."],
    });
    yield* git.execute({
      operation,
      cwd: input.cwd,
      args: ["clean", "-fd", "--", "."],
    });

    const headExists = yield* hasHeadCommit(input.cwd);
    if (headExists) {
      yield* git.execute({
        operation,
        cwd: input.cwd,
        args: ["reset", "--quiet", "--", "."],
      });
    }

    return true;
  });

  const diffCheckpoints: CheckpointStoreShape["diffCheckpoints"] = Effect.fn("diffCheckpoints")(
    function* (input) {
      const operation = "CheckpointStore.diffCheckpoints";

      let fromCommitOid = yield* resolveCheckpointCommit(input.cwd, input.fromCheckpointRef);
      const toCommitOid = yield* resolveCheckpointCommit(input.cwd, input.toCheckpointRef);

      if (!fromCommitOid && input.fallbackFromToHead === true) {
        const headCommit = yield* resolveHeadCommit(input.cwd);
        if (headCommit) {
          fromCommitOid = headCommit;
        }
      }

      if (!fromCommitOid || !toCommitOid) {
        return yield* new GitCommandError({
          operation,
          command: "git diff",
          cwd: input.cwd,
          detail: "Checkpoint ref is unavailable for diff operation.",
        });
      }

      const result = yield* git.execute({
        operation,
        cwd: input.cwd,
        args: ["diff", "--patch", "--minimal", "--no-color", fromCommitOid, toCommitOid],
      });

      return result.stdout;
    },
  );

  const resolveCheckpointBlobSpec = (
    cwd: string,
    checkpointRef: CheckpointRef,
    relativePath: string,
  ): Effect.Effect<string | null, GitCommandError> =>
    Effect.gen(function* () {
      const commitOid = yield* resolveCheckpointCommit(cwd, checkpointRef);
      if (!commitOid) {
        return null;
      }
      const normalizedRelativePath = relativePath.replaceAll("\\", "/").trim();
      if (normalizedRelativePath.length === 0) {
        return null;
      }
      return `${commitOid}:${normalizedRelativePath}`;
    });

  const statCheckpointFile: CheckpointStoreShape["statCheckpointFile"] = Effect.fn(
    "statCheckpointFile",
  )(function* (input) {
    const operation = "CheckpointStore.statCheckpointFile";
    const blobSpec = yield* resolveCheckpointBlobSpec(
      input.cwd,
      input.checkpointRef,
      input.relativePath,
    );
    if (!blobSpec) {
      return null;
    }

    const result = yield* git.execute({
      operation,
      cwd: input.cwd,
      args: ["cat-file", "-s", blobSpec],
      allowNonZeroExit: true,
    });
    if (result.code !== 0) {
      return null;
    }

    const byteSize = Number.parseInt(result.stdout.trim(), 10);
    if (!Number.isFinite(byteSize) || byteSize < 0) {
      return yield* new GitCommandError({
        operation,
        command: "git cat-file -s",
        cwd: input.cwd,
        detail: "git cat-file -s returned an invalid file size.",
      });
    }

    const mimeType = Mime.getType(input.relativePath) ?? "application/octet-stream";
    const stat: CheckpointFileStat = {
      byteSize,
      mimeType,
    };
    return stat;
  });

  const readCheckpointFileBytes: CheckpointStoreShape["readCheckpointFileBytes"] = Effect.fn(
    "readCheckpointFileBytes",
  )(function* (input) {
    const operation = "CheckpointStore.readCheckpointFileBytes";
    const blobSpec = yield* resolveCheckpointBlobSpec(
      input.cwd,
      input.checkpointRef,
      input.relativePath,
    );
    if (!blobSpec) {
      return null;
    }

    const stats = yield* statCheckpointFile(input);
    if (!stats) {
      return null;
    }

    return yield* Effect.try({
      try: () =>
        new Uint8Array(
          execFileSync("git", ["show", blobSpec], {
            cwd: input.cwd,
            encoding: "buffer",
            maxBuffer: Math.max(1_000_000, stats.byteSize + 64 * 1024),
            env: process.env,
          }),
        ),
      catch: (cause) => {
        const detail =
          cause instanceof Error && "message" in cause
            ? cause.message
            : "Failed to read checkpoint file bytes.";
        return new GitCommandError({
          operation,
          command: `git show ${blobSpec}`,
          cwd: input.cwd,
          detail,
          cause,
        });
      },
    });
  });

  const readCheckpointFileText: CheckpointStoreShape["readCheckpointFileText"] = Effect.fn(
    "readCheckpointFileText",
  )(function* (input) {
    const fileBytes = yield* readCheckpointFileBytes(input);
    if (!fileBytes) {
      return null;
    }

    return yield* Effect.try({
      try: () => new TextDecoder("utf-8", { fatal: true }).decode(fileBytes),
      catch: (cause) =>
        new GitCommandError({
          operation: "CheckpointStore.readCheckpointFileText",
          command: `git show ${input.checkpointRef}:${input.relativePath}`,
          cwd: input.cwd,
          detail: "Checkpoint file is not valid UTF-8 text.",
          cause,
        }),
    });
  });

  const deleteCheckpointRefs: CheckpointStoreShape["deleteCheckpointRefs"] = Effect.fn(
    "deleteCheckpointRefs",
  )(function* (input) {
    const operation = "CheckpointStore.deleteCheckpointRefs";

    yield* Effect.forEach(
      input.checkpointRefs,
      (checkpointRef) =>
        git.execute({
          operation,
          cwd: input.cwd,
          args: ["update-ref", "-d", checkpointRef],
          allowNonZeroExit: true,
        }),
      { discard: true },
    );
  });

  return {
    isGitRepository,
    captureCheckpoint,
    hasCheckpointRef,
    restoreCheckpoint,
    diffCheckpoints,
    statCheckpointFile,
    readCheckpointFileText,
    readCheckpointFileBytes,
    deleteCheckpointRefs,
  } satisfies CheckpointStoreShape;
});

export const CheckpointStoreLive = Layer.effect(CheckpointStore, makeCheckpointStore);
