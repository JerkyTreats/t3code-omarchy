# Upstream Intake `v0.0.16 -> v0.0.17`

## Goal

Define the file-level intake plan for integrating upstream `v0.0.17` into the fork while preserving the protected fork surfaces described in `patch.md`.

## Release Shape

This release is much narrower than `v0.0.16`.

It is mostly:

- server and packaging hardening
- typed error cleanup across auth, provider, terminal, and workspace paths
- one targeted web state improvement for per-thread changed-file expansion

That makes `v0.0.16 -> v0.0.17` a medium-risk release line with one clear fork-sensitive seam instead of a broad platform rewrite.

## Protected Surfaces Touched

- `F4` composer draft autonomy and composer chrome
- `F6` fork first GitHub identity resolution
- `F8` plan aware sidebar and activity status cues

## Intake Summary

### Adopt

These changes are high value and low conflict with fork-owned behavior:

- secret store hardening in `apps/server/src/auth/Layers/ServerSecretStore.ts`
- catalog override resolution in release and packaging paths
- typed error cleanup in provider, terminal, workspace, and server helper layers
- primary environment auth error normalization in `apps/web/src/environments/primary/auth.ts`
- primary environment descriptor bootstrap error normalization in `apps/web/src/environments/primary/context.ts`
- packaging metadata alignment in root and package level manifests where it does not affect fork naming

### Adapt

These changes are worth taking, but need fork-shaped integration:

- thread-scoped changed-files expansion persistence in `apps/web/src/uiStateStore.ts`
- `ChatView` and `MessagesTimeline` wiring for changed-files expansion state
- `GitHubCli` decoding and diagnostics improvements at the fork-first GitHub seam

### Reject

No major upstream behavior in this release should be rejected outright.

Still reject during merge resolution:

- any incidental resolution that weakens fork-first GitHub repo identity
- any `ChatView` reconciliation that disturbs composer ownership or fork chrome placement
- any generic timeline state handling that leaks across thread boundaries or conflicts with fork thread routing

## File-Level Intake

### Release Packaging And Catalog Hardening

Status:

- `adopt`

Primary upstream work:

- `e3004ae8`

Files:

- `package.json`
- `scripts/lib/resolve-catalog.ts`
- `scripts/build-desktop-artifact.ts`
- `apps/server/scripts/cli.ts`
- package manifests in `apps/server`, `apps/web`, and `apps/desktop`

Why:

- upstream fixes catalog override resolution so publish and packaging outputs carry the same concrete dependency graph as the workspace root
- this reduces release drift and lowers the chance of broken packaged artifacts
- it does not conflict with fork-owned product semantics

Merge notes:

- preserve fork branding and release identity from `F1`
- preserve existing fork packaging names while adopting the dependency resolution fix

### Server Secret Store And Error Hardening

Status:

- `adopt`

Primary upstream work:

- `e3004ae8`

Files:

- `apps/server/src/auth/Layers/ServerSecretStore.ts`
- `apps/server/src/provider/Layers/CodexProvider.ts`
- `apps/server/src/provider/providerSnapshot.ts`
- `apps/server/src/terminal/Layers/Manager.ts`
- `apps/server/src/workspace/Layers/WorkspaceEntries.ts`
- `apps/server/src/ws.ts`
- `apps/server/src/git/Layers/GitCore.ts`

Why:

- this is primarily correctness and diagnostics cleanup
- the secret store changes tighten platform error handling in a security-sensitive path
- the terminal and workspace changes make failure handling more typed and consistent
- these align directly with repository priorities for reliability and predictable failure behavior

Merge notes:

- keep the already integrated `v0.0.16` auth substrate authoritative
- port the error handling improvements without reopening settled fork seams

### Primary Environment Auth Bootstrap Cleanup

Status:

- `adopt`

Primary upstream work:

- `e3004ae8`

Files:

- `apps/web/src/environments/primary/auth.ts`
- `apps/web/src/environments/primary/context.ts`

Why:

- upstream converts `BootstrapHttpError` into a tagged error shape and reuses it consistently across session and descriptor fetches
- this is a maintainability and correctness improvement inside the auth bootstrap path we already adopted from `v0.0.16`

Merge notes:

- preserve the fork local auth gate behavior already established in `apps/web/src/serverAuthBootstrap.ts`
- prefer adopting the error shape and retry semantics, not upstream route or shell assumptions

### GitHub Decode Diagnostics At The Fork Identity Seam

Status:

- `adapt`

Primary upstream work:

- `e3004ae8`

Files:

- `apps/server/src/git/Layers/GitHubCli.ts`

Why:

- the upstream change improves schema decode error reporting through `SchemaIssue`
- the file is already a fork-owned seam under `F6`
- the behavioral risk is low, but the file still deserves `adapt` treatment because it governs fork-first repo identity

Required fork behavior to preserve:

- fork-first repo identity remains the default for user-facing GitHub context
- richer decode diagnostics must not come with any change to remote selection semantics

Recommended merge method:

1. adopt the schema formatter and typed diagnostics improvement
2. verify all fork identity selection logic remains unchanged

### Thread-Scoped Changed-File Expansion Persistence

Status:

- `adapt`

Primary upstream work:

- `9385314d`

Files:

- `apps/web/src/uiStateStore.ts`
- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/components/chat/MessagesTimeline.tsx`
- related tests in `apps/web/src/components/chat` and `apps/web/src/uiStateStore.test.ts`

Why:

- upstream fixes a real usability gap by remembering changed-file collapse state per thread
- the implementation touches `ChatView`, which is a protected fork seam under `F4`
- the change also affects timeline level thread state, which sits near other fork-owned activity and status behavior

Required fork behavior to preserve:

- composer ownership and chrome remain untouched
- draft state remains isolated from timeline UI state
- thread-scoped persistence must not interfere with fork-specific activity rendering or plan cues
- route and thread scoping must remain correct across primary and non-primary thread contexts

Recommended merge method:

1. adopt the `uiStateStore` data model and persistence logic
2. port the `MessagesTimeline` prop changes without accepting unrelated visual churn
3. adapt `ChatView` wiring carefully so the new state stays outside composer ownership
4. verify changed-file expansion persists per thread and resets correctly on thread cleanup

## Implementation Order

1. Adopt package and catalog override resolution changes
2. Adopt server secret store and typed error cleanup
3. Adopt primary environment auth bootstrap cleanup
4. Adapt `GitHubCli` diagnostics at the fork identity seam
5. Adapt thread-scoped changed-file expansion state through `uiStateStore` and timeline wiring

## Verification Focus

- packaged dependency resolution still respects root catalog overrides
- server auth secret handling still works with the `v0.0.16` pairing and session model
- primary environment auth retry and bootstrap failure handling remain stable
- fork-first GitHub identity still wins for repo and issue context
- changed-file expand and collapse state persists per thread only
- composer draft text, screenshots, attachments, and top-action chrome remain intact while using changed-file controls

## Bottom Line

`v0.0.17` should mostly be absorbed.

The release has one meaningful fork-sensitive area in `ChatView` and timeline UI state, plus one smaller protected seam in `GitHubCli`.

Everything else in the release line should be treated as straightforward hardening and reliability adoption.
