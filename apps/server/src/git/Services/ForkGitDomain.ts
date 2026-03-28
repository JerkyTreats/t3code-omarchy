import { ServiceMap } from "effect";

import type { GitManagerShape } from "./GitManager.ts";

/**
 * ForkGitDomain - Fork-owned Git workflow policy seam.
 *
 * This service isolates fork policy from upstream-facing git runtime concerns.
 * Browser-facing services should depend on this seam instead of directly
 * entangling product workflow rules with upstream adapters.
 */
export class ForkGitDomain extends ServiceMap.Service<ForkGitDomain, GitManagerShape>()(
  "t3/git/Services/ForkGitDomain",
) {}
