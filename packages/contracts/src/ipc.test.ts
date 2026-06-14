import { describe, expect, it } from "@effect/vitest";
import * as Schema from "effect/Schema";

import { DesktopScreenshotCaptureSchema, DesktopSystemThemeSchema } from "./ipc.ts";

const decodeDesktopScreenshotCapture = Schema.decodeUnknownSync(DesktopScreenshotCaptureSchema);
const decodeDesktopSystemTheme = Schema.decodeUnknownSync(DesktopSystemThemeSchema);

describe("desktop IPC fork contracts", () => {
  it("accepts Omarchy screenshot capture payloads", () => {
    const decoded = decodeDesktopScreenshotCapture({
      name: "screenshot.png",
      mimeType: "image/png",
      sizeBytes: 12,
      dataUrl: "data:image/png;base64,AAAA",
    });

    expect(decoded.mimeType).toBe("image/png");
    expect(decoded.name).toBe("screenshot.png");
  });

  it("accepts Omarchy system theme payloads", () => {
    const decoded = decodeDesktopSystemTheme({
      source: "omarchy",
      name: "Tokyo Night",
      mode: "dark",
      colors: {
        background: "#1a1b26",
        foreground: "#c0caf5",
        accent: "#7aa2f7",
      },
    });

    expect(decoded.source).toBe("omarchy");
    expect(decoded.colors.accent).toBe("#7aa2f7");
  });

  it("rejects generic system theme sources", () => {
    expect(() =>
      decodeDesktopSystemTheme({
        source: "system",
        name: "System",
        mode: "dark",
        colors: {
          background: "#000000",
          foreground: "#ffffff",
          accent: "#ffffff",
        },
      }),
    ).toThrow();
  });
});
