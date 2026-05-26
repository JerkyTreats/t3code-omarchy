import { describe, expect, it } from "vitest";

import {
  formatNightlyReleaseName,
  formatProductDisplayName,
  formatStableReleaseName,
  PRODUCT_BASE_NAME,
  PRODUCT_PACKAGE_DESCRIPTION,
  PRODUCT_TECHNICAL_IDENTITY,
  resolveProductReleaseDescription,
  resolveProductStageLabel,
} from "./productIdentity.ts";

describe("productIdentity", () => {
  it("keeps Omarchy visible in display names", () => {
    expect(PRODUCT_BASE_NAME).toBe("T3 Code Omarchy");
    expect(formatProductDisplayName("Alpha")).toBe("T3 Code Omarchy (Alpha)");
    expect(formatProductDisplayName("Nightly")).toBe("T3 Code Omarchy (Nightly)");
    expect(formatProductDisplayName("Dev")).toBe("T3 Code Omarchy (Dev)");
  });

  it("derives stage labels from runtime state", () => {
    expect(resolveProductStageLabel({ isDevelopment: true, isNightly: false })).toBe("Dev");
    expect(resolveProductStageLabel({ isDevelopment: false, isNightly: true })).toBe("Nightly");
    expect(resolveProductStageLabel({ isDevelopment: false, isNightly: false })).toBe("Alpha");
  });

  it("keeps release names fork branded", () => {
    expect(formatStableReleaseName("1.2.3")).toBe("T3 Code Omarchy v1.2.3");
    expect(formatNightlyReleaseName("1.2.4-nightly.20260501.17", "abcdef123456")).toBe(
      "T3 Code Omarchy Nightly 1.2.4-nightly.20260501.17 (abcdef123456)",
    );
  });

  it("keeps package copy fork branded without changing stable technical ids", () => {
    expect(PRODUCT_PACKAGE_DESCRIPTION).toBe("T3 Code Omarchy desktop build");
    expect(PRODUCT_TECHNICAL_IDENTITY.appId).toBe("com.t3tools.t3code");
    expect(PRODUCT_TECHNICAL_IDENTITY.linuxExecutableName).toBe("t3code");
    expect(PRODUCT_TECHNICAL_IDENTITY.userDataDirName).toBe("t3code");
  });

  it("formats release announcement descriptions with fork identity", () => {
    expect(resolveProductReleaseDescription("nightly")).toBe(
      "A new T3 Code Omarchy prerelease is available for nightly testers.",
    );
    expect(resolveProductReleaseDescription("latest")).toBe(
      "A new T3 Code Omarchy latest release is available.",
    );
  });
});
