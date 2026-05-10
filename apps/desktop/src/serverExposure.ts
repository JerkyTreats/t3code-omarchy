import type { DesktopServerExposureMode } from "@t3tools/contracts";

interface NetworkInterfaceInfoLike {
  readonly address: string;
  readonly family: string | number;
  readonly internal: boolean;
  readonly [key: string]: unknown;
}

type NetworkInterfacesLike = Record<string, ReadonlyArray<NetworkInterfaceInfoLike> | undefined>;

export interface DesktopServerExposure {
  readonly mode: DesktopServerExposureMode;
  readonly bindHost: string;
  readonly localHttpUrl: string;
  readonly localWsUrl: string;
  readonly endpointUrl: string | null;
  readonly advertisedHost: string | null;
}

export function resolveLanAdvertisedHost(
  networkInterfaces: NetworkInterfacesLike,
  explicitHost: string | undefined,
): string | null {
  if (explicitHost) {
    return explicitHost;
  }

  for (const addresses of Object.values(networkInterfaces)) {
    if (!addresses) {
      continue;
    }

    for (const address of addresses) {
      const isIpv4 = address.family === "IPv4" || address.family === 4;
      if (isIpv4 && !address.internal) {
        return address.address;
      }
    }
  }

  return null;
}

export function resolveDesktopServerExposure(input: {
  readonly mode: DesktopServerExposureMode;
  readonly port: number;
  readonly networkInterfaces: NetworkInterfacesLike;
  readonly advertisedHostOverride?: string | undefined;
}): DesktopServerExposure {
  const localHttpUrl = `http://127.0.0.1:${input.port}`;
  const localWsUrl = `ws://127.0.0.1:${input.port}`;

  if (input.mode === "local-only") {
    return {
      mode: input.mode,
      bindHost: "127.0.0.1",
      localHttpUrl,
      localWsUrl,
      endpointUrl: null,
      advertisedHost: null,
    };
  }

  const advertisedHost = resolveLanAdvertisedHost(
    input.networkInterfaces,
    input.advertisedHostOverride,
  );

  return {
    mode: input.mode,
    bindHost: "0.0.0.0",
    localHttpUrl,
    localWsUrl,
    endpointUrl: advertisedHost === null ? null : `http://${advertisedHost}:${input.port}`,
    advertisedHost,
  };
}
