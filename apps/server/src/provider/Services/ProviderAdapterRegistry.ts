/**
 * ProviderAdapterRegistry - Lookup boundary for provider adapter implementations.
 *
 * Maps a provider kind to the concrete adapter service (Codex, Claude, etc).
 * It does not own session lifecycle or routing rules; `ProviderService` uses
 * this registry together with `ProviderSessionDirectory`.
 *
 * @module ProviderAdapterRegistry
 */
import type { ProviderDriverKind, ProviderInstanceId, ProviderKind } from "@t3tools/contracts";
import { Context } from "effect";
import type { Effect } from "effect";

import type { ProviderAdapterError, ProviderUnsupportedError } from "../Errors.ts";
import type { ProviderAdapterShape } from "./ProviderAdapter.ts";

export interface ProviderInstanceRoutingInfo {
  readonly instanceId: ProviderInstanceId;
  readonly driverKind: ProviderDriverKind;
  readonly provider: ProviderKind;
  readonly displayName?: string | undefined;
  readonly accentColor?: string | undefined;
  readonly enabled: boolean;
}

/**
 * ProviderAdapterRegistryShape - Service API for adapter lookup by provider kind.
 */
export interface ProviderAdapterRegistryShape {
  /**
   * Resolve the adapter for a provider kind.
   */
  readonly getByProvider: (
    provider: ProviderKind,
  ) => Effect.Effect<ProviderAdapterShape<ProviderAdapterError>, ProviderUnsupportedError>;

  /**
   * Resolve the adapter for a provider instance.
   */
  readonly getByInstance?: (
    instanceId: ProviderInstanceId,
  ) => Effect.Effect<ProviderAdapterShape<ProviderAdapterError>, ProviderUnsupportedError>;

  /**
   * Resolve routing metadata for a provider instance.
   */
  readonly getInstanceInfo?: (
    instanceId: ProviderInstanceId,
  ) => Effect.Effect<ProviderInstanceRoutingInfo, ProviderUnsupportedError>;

  /**
   * List provider kinds currently registered.
   */
  readonly listProviders: () => Effect.Effect<ReadonlyArray<ProviderKind>>;

  /**
   * List currently registered provider instance ids.
   */
  readonly listInstances?: () => Effect.Effect<ReadonlyArray<ProviderInstanceId>>;
}

/**
 * ProviderAdapterRegistry - Service tag for provider adapter lookup.
 */
export class ProviderAdapterRegistry extends Context.Service<
  ProviderAdapterRegistry,
  ProviderAdapterRegistryShape
>()("t3/provider/Services/ProviderAdapterRegistry") {}

// Dummy comment for workflow testing.
