export type DesktopUpdateChannel = "latest" | "nightly";

export function isNightlyDesktopVersion(version: string): boolean {
  return /-nightly\.\d{8}\.\d+$/.test(version);
}

export function resolveDefaultDesktopUpdateChannel(version: string): DesktopUpdateChannel {
  return isNightlyDesktopVersion(version) ? "nightly" : "latest";
}

export function doesVersionMatchDesktopUpdateChannel(
  version: string,
  channel: DesktopUpdateChannel,
): boolean {
  return channel === "nightly"
    ? isNightlyDesktopVersion(version)
    : !isNightlyDesktopVersion(version);
}
