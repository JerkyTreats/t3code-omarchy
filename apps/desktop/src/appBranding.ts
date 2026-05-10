import { isNightlyDesktopVersion } from "./updateChannels.ts";

export type DesktopAppStageLabel = "Dev" | "Nightly" | "Alpha";

export interface DesktopAppBranding {
  readonly baseName: string;
  readonly stageLabel: DesktopAppStageLabel;
  readonly displayName: string;
}

const APP_BASE_NAME = "T3 Code";

export function resolveDesktopAppStageLabel(input: {
  readonly isDevelopment: boolean;
  readonly appVersion: string;
}): DesktopAppStageLabel {
  if (input.isDevelopment) {
    return "Dev";
  }

  return isNightlyDesktopVersion(input.appVersion) ? "Nightly" : "Alpha";
}

export function resolveDesktopAppBranding(input: {
  readonly isDevelopment: boolean;
  readonly appVersion: string;
}): DesktopAppBranding {
  const stageLabel = resolveDesktopAppStageLabel(input);
  return {
    baseName: APP_BASE_NAME,
    stageLabel,
    displayName: `${APP_BASE_NAME} (${stageLabel})`,
  };
}
