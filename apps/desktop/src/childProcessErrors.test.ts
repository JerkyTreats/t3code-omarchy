import { describe, expect, it } from "vitest";

import { isIgnorableChildProcessStreamError } from "./childProcessErrors";

describe("isIgnorableChildProcessStreamError", () => {
  it("returns true for child pipe disconnect errors", () => {
    expect(isIgnorableChildProcessStreamError({ code: "ECONNRESET" })).toBe(true);
    expect(isIgnorableChildProcessStreamError({ code: "EPIPE" })).toBe(true);
    expect(isIgnorableChildProcessStreamError({ code: "ERR_STREAM_DESTROYED" })).toBe(true);
  });

  it("returns false for unrelated failures", () => {
    expect(isIgnorableChildProcessStreamError({ code: "ENOENT" })).toBe(false);
    expect(isIgnorableChildProcessStreamError(new Error("boom"))).toBe(false);
    expect(isIgnorableChildProcessStreamError(null)).toBe(false);
  });
});
