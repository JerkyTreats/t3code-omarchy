function splitVersion(version: string): {
  readonly numeric: [number, number, number];
  readonly prerelease: string | null;
} {
  const trimmed = version.trim();
  const [core = "", prerelease] = trimmed.split("-", 2);
  const parts = core.split(".");
  const major = Number(parts[0]);
  const minor = Number(parts[1]);
  const patch = parts[2] === undefined ? 0 : Number(parts[2]);

  if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) {
    return {
      numeric: [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
      prerelease: null,
    };
  }

  return {
    numeric: [major, minor, patch],
    prerelease: prerelease?.trim() || null,
  };
}

export function normalizeCliVersion(version: string): string {
  const trimmed = version.trim();
  const [core = "", prerelease] = trimmed.split("-", 2);
  const parts = core.split(".");
  if (parts.length === 2) {
    return prerelease ? `${core}.0-${prerelease}` : `${core}.0`;
  }
  return trimmed;
}

export function compareCliVersions(left: string, right: string): number {
  const leftVersion = splitVersion(normalizeCliVersion(left));
  const rightVersion = splitVersion(normalizeCliVersion(right));

  for (let index = 0; index < 3; index += 1) {
    const leftPart = leftVersion.numeric[index] ?? 0;
    const rightPart = rightVersion.numeric[index] ?? 0;
    const delta = leftPart - rightPart;
    if (delta !== 0) {
      return delta;
    }
  }

  if (leftVersion.prerelease === rightVersion.prerelease) {
    return 0;
  }
  if (leftVersion.prerelease === null) {
    return 1;
  }
  if (rightVersion.prerelease === null) {
    return -1;
  }
  return leftVersion.prerelease.localeCompare(rightVersion.prerelease, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}
