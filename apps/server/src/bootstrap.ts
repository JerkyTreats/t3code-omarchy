import * as NFS from "node:fs";
import * as Net from "node:net";
import * as readline from "node:readline";
import { Readable } from "node:stream";

import { Data, Effect, Option, Predicate, Result, Schema } from "effect";
import { decodeJsonResult } from "@t3tools/shared/schemaJson";

class BootstrapError extends Data.TaggedError("BootstrapError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

function readErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : undefined;
}

export const readBootstrapEnvelope = Effect.fn("readBootstrapEnvelope")(function* <A, I>(
  schema: Schema.Codec<A, I>,
  fd: number,
  options?: {
    timeoutMs?: number;
  },
): Effect.fn.Return<Option.Option<A>, BootstrapError> {
  const fdReady = yield* isFdReady(fd);
  if (!fdReady) return Option.none();

  const stream = yield* makeBootstrapInputStream(fd);

  const timeoutMs = options?.timeoutMs ?? 1000;

  return yield* Effect.callback<Option.Option<A>, BootstrapError>((resume) => {
    const input = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    const cleanup = () => {
      stream.removeListener("error", handleError);
      input.removeListener("line", handleLine);
      input.removeListener("close", handleClose);
      input.close();
      stream.destroy();
    };

    const handleError = (error: Error) => {
      if (isUnavailableBootstrapFdError(error)) {
        resume(Effect.succeedNone);
        return;
      }
      resume(
        Effect.fail(
          new BootstrapError({
            message: "Failed to read bootstrap envelope.",
            cause: error,
          }),
        ),
      );
    };

    const handleLine = (line: string) => {
      const parsed = decodeJsonResult(schema)(line);
      if (Result.isSuccess(parsed)) {
        resume(Effect.succeedSome(parsed.success));
      } else {
        resume(
          Effect.fail(
            new BootstrapError({
              message: "Failed to decode bootstrap envelope.",
              cause: parsed.failure,
            }),
          ),
        );
      }
    };

    const handleClose = () => {
      resume(Effect.succeedNone);
    };

    stream.once("error", handleError);
    input.once("line", handleLine);
    input.once("close", handleClose);

    return Effect.sync(cleanup);
  }).pipe(Effect.timeoutOption(timeoutMs), Effect.map(Option.flatten));
});

const isUnavailableBootstrapFdError = Predicate.compose(
  Predicate.hasProperty("code"),
  (_) => _.code === "EBADF" || _.code === "ENOENT",
);

function shouldFallbackToDirectFdStream(error: unknown): boolean {
  const code = readErrorCode(error);
  return code === "ENXIO" || code === "EINVAL";
}

function isRetryableDirectReadError(error: unknown): boolean {
  const code = readErrorCode(error);
  return code === "EAGAIN" || code === "EWOULDBLOCK";
}

const isFdReady = (fd: number) =>
  Effect.try({
    try: () => NFS.fstatSync(fd),
    catch: (error) =>
      new BootstrapError({
        message: "Failed to stat bootstrap fd.",
        cause: error,
      }),
  }).pipe(
    Effect.as(true),
    Effect.catchIf(
      (error) => isUnavailableBootstrapFdError(error.cause),
      () => Effect.succeed(false),
    ),
  );

const makeBootstrapInputStream = (fd: number) =>
  Effect.try<Readable, BootstrapError>({
    try: () => {
      const fdPath = resolveFdPath(fd);
      if (fdPath === undefined) {
        const stream = new Net.Socket({
          fd,
          readable: true,
          writable: false,
        });
        stream.setEncoding("utf8");
        return stream;
      }

      try {
        const streamFd = NFS.openSync(fdPath, "r");
        return NFS.createReadStream("", {
          fd: streamFd,
          encoding: "utf8",
          autoClose: true,
        });
      } catch (error) {
        if (!shouldFallbackToDirectFdStream(error)) {
          throw error;
        }

        return makeDirectFdReadStream(fd);
      }
    },
    catch: (error) =>
      new BootstrapError({
        message: "Failed to duplicate bootstrap fd.",
        cause: error,
      }),
  });

export function resolveFdPath(
  fd: number,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  if (platform === "linux") {
    return `/proc/self/fd/${fd}`;
  }
  if (platform === "win32") {
    return undefined;
  }
  return `/dev/fd/${fd}`;
}

function makeDirectFdReadStream(fd: number): Readable {
  let closed = false;
  let reading = false;

  const stream = new Readable({
    read() {
      pump();
    },
    destroy(error, callback) {
      closed = true;
      try {
        NFS.closeSync(fd);
      } catch {
        // Ignore cleanup failures when the fd is already gone.
      }
      callback(error);
    },
  });

  stream.setEncoding("utf8");

  const pump = () => {
    if (closed || reading) {
      return;
    }

    reading = true;
    const buffer = Buffer.allocUnsafe(64 * 1024);

    const attemptRead = () => {
      if (closed) {
        reading = false;
        return;
      }

      NFS.read(fd, buffer, 0, buffer.length, null, (error, bytesRead) => {
        if (closed) {
          reading = false;
          return;
        }

        if (error) {
          if (isRetryableDirectReadError(error)) {
            const timer = setTimeout(attemptRead, 10);
            timer.unref?.();
            return;
          }

          reading = false;
          stream.destroy(error);
          return;
        }

        reading = false;

        if (bytesRead === 0) {
          stream.push(null);
          return;
        }

        if (stream.push(buffer.subarray(0, bytesRead))) {
          pump();
        }
      });
    };

    attemptRead();
  };

  return stream;
}
