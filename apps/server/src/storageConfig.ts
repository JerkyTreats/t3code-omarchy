export interface StorageConfigSelectionInput {
  readonly cliHomeDir: string | undefined;
  readonly envHomeDir: string | undefined;
  readonly legacyStateDir: string | undefined;
  readonly bootstrapHomeDir: string | undefined;
}

export type StorageConfigSelection =
  | {
      readonly kind: "baseDir";
      readonly value: string;
    }
  | {
      readonly kind: "legacyStateDir";
      readonly value: string;
    };

function normalizeConfiguredPath(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function selectStorageConfig(
  input: StorageConfigSelectionInput,
): StorageConfigSelection | null {
  const configuredBaseDir =
    normalizeConfiguredPath(input.cliHomeDir) ?? normalizeConfiguredPath(input.envHomeDir);
  if (configuredBaseDir) {
    return {
      kind: "baseDir",
      value: configuredBaseDir,
    };
  }

  const legacyStateDir = normalizeConfiguredPath(input.legacyStateDir);
  if (legacyStateDir) {
    return {
      kind: "legacyStateDir",
      value: legacyStateDir,
    };
  }

  const bootstrapBaseDir = normalizeConfiguredPath(input.bootstrapHomeDir);
  if (bootstrapBaseDir) {
    return {
      kind: "baseDir",
      value: bootstrapBaseDir,
    };
  }

  return null;
}
