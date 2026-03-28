function readErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const { code } = error as { code?: unknown };
  return typeof code === "string" ? code : undefined;
}

export function isIgnorableChildProcessStreamError(error: unknown): boolean {
  const code = readErrorCode(error);
  return code === "ECONNRESET" || code === "EPIPE" || code === "ERR_STREAM_DESTROYED";
}
