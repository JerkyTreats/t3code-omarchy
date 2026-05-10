# Upstream Intake `v0.0.20 -> v0.0.21`

## Goal

Define the intake plan for integrating upstream `v0.0.20 -> v0.0.21` into the fork while preserving the protected fork surfaces described in `patch.md`.

## Release Shape

This release line is large and fork-sensitive.

It mixes:

- ACP and OpenCode provider expansion
- Cursor provider support
- provider model selection redesign
- desktop startup and packaging hardening
- right panel and shell layout adjustments
- command palette and thread-status polish

That makes `v0.0.20 -> v0.0.21` a high-risk release line even before the later source-control expansion in `v0.0.21 -> v0.0.22`.

## Protected Surfaces Touched

- `F1` branding and release identity
- `F4` composer draft autonomy and composer chrome
- `F5` Git panel isolation from draft ownership
- `F6` fork first GitHub identity resolution
- `F7` local branch, worktree, and promotion workflow
- `F8` plan-aware sidebar and activity status cues
- `F9` plan markdown preview and markdown rendering behavior

## Intake Summary

### Adopt

These changes are high value and low conflict with fork-owned behavior:

- provider cache write hardening
- provider probe and auth timeout fixes
- Windows command detection and PATH repair fixes
- desktop readiness coordination
- OpenCode runtime lifecycle fixes
- release workflow and packaging hardening
- Codex home expansion fixes
- stale projection snapshot rejection

### Adapt

These changes should be taken, but only through fork seams:

- model picker redesign and provider option arrays
- ACP adapter substrate and Cursor provider support
- provider registry and provider settings UI
- `ChatView`, `Sidebar`, `PlanSidebar`, and right-panel shell changes
- `GitHubCli` and `GitManager` where richer provider and repo context intersects fork identity
- command palette thread-status work
- desktop branding and update channel changes

### Reject

No large theme in this release line should be rejected wholesale.

Still reject during merge resolution:

- any provider shell resolution that flattens fork composer chrome
- any repo or issue identity logic that stops preferring the fork remote
- any settings or shell rewrite that obscures plan cues or protected markdown flows
- any branding change that removes Omarchy release identity

## File-Level Intake

### Provider Expansion And Runtime Hardening

Status:

- `adapt`

Primary upstream work:

- `9c64f12e`
- `ce94feee`
- `3b98fe35`
- `306ec4bb`
- `721b6b4c`
- `8dbcf92a`
- `b8305afa`
- `e25db3a5`

Files:

- `apps/server/src/provider`
- `packages/contracts/src/provider.ts`
- `packages/contracts/src/providerRuntime.ts`
- `apps/web/src/providerModels.ts`
- `apps/web/src/components/settings`

Why:

- the new provider substrate is valuable and likely reduces later drift
- it directly touches fork-owned model selection and shell surfaces
- the fork should take the runtime infrastructure early while preserving local model and shell semantics

Required fork behavior to preserve:

- fork-preferred provider defaults remain explicit
- draft ownership and composer controls stay intact during provider switching
- plan cues and side-panel behavior stay visible during provider UI churn

Recommended merge method:

1. Adopt provider contracts and server runtime pieces first.
2. Land settings and registry substrate next.
3. Reconcile model picker UX last against current fork shell behavior.

### Desktop Startup, Packaging, And Branding

Status:

- `adapt`

Primary upstream work:

- `40009735`
- `a7a44d06`
- `8dba2d64`
- `df9d3400`
- `055897f0`
- `c83bc5d4`

Files:

- `apps/desktop/src`
- `apps/desktop/scripts`
- `scripts/build-desktop-artifact.ts`
- desktop package manifests

Why:

- this release line contains meaningful desktop reliability work
- it also touches branding and release-channel behavior, which overlap `F1`

Required fork behavior to preserve:

- Omarchy naming remains authoritative
- desktop startup behavior remains compatible with local auth and screenshot workflows

### Shell Layout And Sidebar Presentation

Status:

- `adapt`

Primary upstream work:

- `6d1505c9`
- `d8d32969`
- `66c326b8`
- `3a1daa87`

Files:

- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/components/ChatMarkdown.tsx`
- `apps/web/src/components/PlanSidebar.tsx`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/CommandPalette.tsx`
- `apps/web/src/components/chat/ModelPickerSidebar.tsx`
- `apps/web/src/routes`

Why:

- these files already carry fork-owned shell and preview behavior
- upstream improvements are worth taking, but not by replacing the fork shell wholesale

Required fork behavior to preserve:

- floating access control and screenshot actions
- draft autonomy and rich composer state
- explicit plan progress cues
- protected markdown preview behavior

### Git Identity And Workflow Seam

Status:

- `adapt`

Primary upstream work:

- `188df6da`
- `0d55a428`
- `8d1d699f`

Files:

- `apps/server/src/git/Layers/GitHubCli.ts`
- `apps/server/src/git/Layers/GitManager.ts`

Why:

- this release does not fully replace the Git stack, but it expands provider and repo-context flows around it
- these files remain fork-owned seams for `F6` and `F7`

Required fork behavior to preserve:

- fork-first repo identity
- guarded promotion semantics
- isolation between Git actions and active draft ownership

## Implementation Order

1. adopt provider runtime hardening and contracts
2. adapt desktop startup and packaging reliability work
3. adapt provider settings and model picker substrate
4. adapt shell layout and command palette changes
5. recheck Git identity and workflow seams after the provider shell changes land

## Verification Focus

- provider probes and cache writes remain stable under restart and reconnect
- desktop startup, PATH hydration, and release packaging remain correct
- model picker behavior preserves fork defaults and shell affordances
- sidebar and plan cues remain explicit
- Git actions still prefer the fork remote and do not disturb active drafts

## Bottom Line

`v0.0.20 -> v0.0.21` should be integrated in slices, not as one merge.

The provider substrate and desktop hardening should land first.

The highest-risk fork seams are the model picker redesign, provider settings shell, and the `ChatView` and `Sidebar` churn around those features.
