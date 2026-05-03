# Upstream Intake `v0.0.17 -> v0.0.19`

## Goal

Define the intake plan for integrating upstream `v0.0.17 -> v0.0.19` into the fork while preserving the protected fork surfaces described in `patch.md`.

## Release Shape

There is no upstream `v0.0.18` tag.

This release line is a broad multi-theme intake that mixes:

- provider and server lifecycle hardening
- desktop startup, release-channel, and Windows packaging work
- command palette and filesystem browse substrate
- large sidebar and chat shell churn
- markdown file link and document UX improvements

That makes `v0.0.17 -> v0.0.19` a high-risk release line, but the risk is concentrated in a few fork-owned seams rather than spread uniformly across the codebase.

## Protected Surfaces Touched

- `F1` branding and release identity
- `F4` composer draft autonomy and composer chrome
- `F5` Git panel isolation from draft ownership
- `F6` fork first GitHub identity resolution
- `F7` local branch, worktree, and promotion workflow
- `F8` plan aware sidebar and activity status cues
- `F9` plan markdown preview and markdown rendering behavior

## Intake Summary

### Adopt

These changes are high value and low conflict with fork-owned behavior:

- provider status caching and desktop startup gating from `008ac5c3`
- Claude session leak cleanup, reaping, archive handling, and stale session monitoring from `e0117b27`
- shell PATH hydration and desktop backend readiness hardening from `2e42f3fd` and `850c9125`
- shell snapshot queries, projection backfill, and stale approval cleanup from `f7fa62aa` and `c9b07d66`
- lost provider session recovery from `d18e43b6`
- branch rename and worktree refresh correctness from `9dcea68b`
- empty server thread worktree bootstrap support from `801b83e9`
- text generation option reset cleanup from `7a08fcf2`
- negative repository identity cache extension from `d90e15d1`
- Windows ARM and release manifest fixes from `6891c77d` and `b7df3dfc`
- launch args setting substrate for Claude provider from `5e1dd56d`
- built-in Claude model catalog update from `3e07f5a6`

### Adapt

These changes should be taken, but only through fork seams:

- command palette substrate and UI from `934037cb` and `44afe784`
- filesystem browse contracts and local API wiring from `44afe784`
- sidebar project grouping from `188a40c3`
- markdown file link UX in `ChatMarkdown` from `68061af0`
- responsive plan sidebar and narrow composer layout work from `19d47408`
- chat shell list virtualization, autoscroll, and timeline churn from `96c9306d` and `33dadb5a`
- sidebar tooltip, warm subscription, and thread ordering changes from `cadd7086`, `569fea87`, and `6f699346`
- assistant message copy action from `26cc1fff`
- worktree draft reuse and active draft branch fixes from `5f7ec73a` and `e2316814`
- any desktop window chrome integration from `dff8784a`
- nightly release channel and branding work where it intersects fork identity from `409ff90a`, `f9580ff0`, and related packaging changes

### Reject

No large upstream theme in this release should be rejected outright.

Still reject during merge resolution:

- any branding or release naming change that drops the Omarchy identity
- any command palette or sidebar resolution that weakens fork plan cues or diff access
- any chat shell rewrite that moves composer ownership away from the active draft
- any markdown link behavior that regresses fork plan preview navigation or document readability
- any GitHub or project grouping behavior that displaces fork-first repo identity

## File-Level Intake

### Provider Lifecycle And Desktop Startup Hardening

Status:

- `adopt`

Primary upstream work:

- `008ac5c3`
- `e0117b27`
- `d18e43b6`
- `2e42f3fd`
- `850c9125`

Files:

- `apps/server/src/provider`
- `apps/server/src/serverRuntimeStartup.ts`
- `apps/server/src/ws.ts`
- `apps/desktop/src/main.ts`
- `apps/desktop/src/backendReadiness.ts`
- `apps/desktop/src/syncShellEnvironment.ts`

Why:

- this is the highest-value reliability work in the release line
- it aligns directly with repository priorities for predictable restart, reconnect, and provider session behavior
- it has little overlap with fork-owned product semantics beyond desktop boot sequencing

Merge notes:

- preserve the current `v0.0.16` auth bootstrap path as authoritative
- preserve Omarchy desktop identity and theme wiring while adopting startup gating
- do not mix desktop window chrome work into this slice

### Worktree, Thread, And Shell Summary Reliability

Status:

- `adopt`

Primary upstream work:

- `f7fa62aa`
- `c9b07d66`
- `801b83e9`
- `9dcea68b`
- `7a08fcf2`
- `d90e15d1`

Files:

- `apps/server/src/orchestration`
- `apps/server/src/persistence`
- `apps/server/src/git/Layers/GitManager.ts`
- `apps/server/src/project/Layers/RepositoryIdentityResolver.ts`
- `apps/web/src/store.ts`

Why:

- these changes improve shell summary projection, stale cleanup, and worktree lifecycle correctness
- they support the fork branch and promotion workflow instead of fighting it
- they also lower later merge cost because command palette and grouping work build on cleaner project and thread state

Merge notes:

- preserve `F6` and `F7` decision points in `GitManager`
- adopt projection and refresh mechanics first
- recheck worktree thread teardown against the fork draft ownership rules in `F5`

### Command Palette And Filesystem Browse Substrate

Status:

- `adapt`

Primary upstream work:

- `934037cb`
- `44afe784`

Files:

- `packages/contracts/src/filesystem.ts`
- `packages/contracts/src/ipc.ts`
- `apps/web/src/commandPaletteStore.ts`
- `apps/web/src/components/CommandPalette.tsx`
- `apps/web/src/components/CommandPalette.logic.ts`
- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/environmentApi.ts`
- `apps/web/src/localApi.ts`
- `apps/server/src/workspace`
- `apps/server/src/ws.ts`
- `apps/desktop/src/main.ts`
- `apps/desktop/src/preload.ts`

Why:

- the fork currently does not have this stack at all
- upstream command palette work is valuable, but it enters through `ChatView`, `Sidebar`, route chrome, and local API seams that the fork already owns
- the filesystem browse substrate is useful even if the first UI landing is narrower than upstream

Required fork behavior to preserve:

- composer focus and draft ownership remain stable while palette actions run
- diff and plan surfaces remain first-class and not hidden behind a generic shell
- thread routing and draft reuse stay consistent with fork worktree behavior

Recommended merge method:

1. adopt contracts, browse RPC, and local API substrate
2. land the palette store and action model behind the current shell
3. add only the commands that fit current fork chrome cleanly
4. postpone broad shell-level UI rewrites until the substrate is stable

### Sidebar Project Grouping And Thread Presentation

Status:

- `adapt`

Primary upstream work:

- `188a40c3`
- `569fea87`
- `cadd7086`
- `6f699346`

Files:

- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/Sidebar.logic.ts`
- `apps/web/src/sidebarProjectGrouping.ts`
- `apps/web/src/logicalProject.ts`
- `apps/web/src/environmentGrouping`
- `apps/web/src/routes/__root.tsx`

Why:

- upstream introduces configurable logical project grouping and deeper cross-environment thread presentation
- this directly overlaps `F8`, and indirectly overlaps `F6` because grouped projects can affect which repository context appears dominant
- the fork currently lacks this stack, so direct file replacement would be high risk

Required fork behavior to preserve:

- plan aware cues remain explicit and visible
- grouped project presentation must not hide fork thread state or diff access
- repository identity for grouped projects must still respect fork-first GitHub rules

Recommended merge method:

1. adopt the logical grouping helpers and settings substrate
2. keep current fork sidebar rendering while data structures settle
3. reapply fork plan cues after the grouped project model lands
4. only then consider larger sidebar UI adoption

### Chat Shell And Timeline Churn

Status:

- `adapt`

Primary upstream work:

- `96c9306d`
- `33dadb5a`
- `26cc1fff`
- `57d7746a`

Files:

- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/components/chat/MessagesTimeline.tsx`
- `apps/web/src/components/chat/MessageCopyButton.tsx`
- `apps/web/src/components/BranchToolbar.tsx`

Why:

- upstream changes chat scrolling, timeline rendering, branch list behavior, and message actions in a part of the shell that the fork already owns
- some of this is useful correctness work, especially autoscroll behavior and assistant message copy
- the full `LegendList` migration and surrounding shell churn would be expensive to reconcile blindly

Required fork behavior to preserve:

- composer autonomy and chrome from `F4`
- plan-aware activity presentation from `F8`
- markdown preview and diff navigation access from `F9`

Recommended merge method:

1. adopt narrowly scoped bug fixes and helper logic
2. land assistant message copy and autoscroll correctness first
3. postpone broad list virtualization and shell structure rewrites unless performance data justifies them

### Markdown File Link And Document UX

Status:

- `adapt`

Primary upstream work:

- `68061af0`

Files:

- `apps/web/src/markdown-links.ts`
- `apps/web/src/components/ChatMarkdown.tsx`
- `apps/web/src/filePathDisplay.ts`
- `apps/web/src/index.css`

Why:

- this is strong upstream UX work for file links, workspace-relative display, and safer file URL handling
- it directly overlaps `F9`, because the fork owns plan markdown preview and protected markdown rendering behavior
- this area is high value but should be merged carefully to avoid regressing fullscreen plan preview and document link expectations

Required fork behavior to preserve:

- plan preview route return behavior
- workspace path, local anchor, and external link handling in protected markdown surfaces
- wide markdown content remains readable and scrollable

Recommended merge method:

1. adopt parsing and path display helpers
2. adapt `ChatMarkdown` rendering against current fork preview behavior
3. verify plan preview and document surfaces before broader markdown churn

### Responsive Plan Sidebar And Narrow Composer Layout

Status:

- `adapt`

Primary upstream work:

- `19d47408`

Files:

- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/components/PlanSidebar.tsx`
- `apps/web/src/components/RightPanelSheet.tsx`
- `apps/web/src/routes/_chat.$environmentId.$threadId.tsx`

Why:

- upstream fixes real layout pressure on narrow widths and makes the plan sidebar more responsive
- the change overlaps both `F4` and `F8`
- this is worth taking, but only after command palette and markdown seams are understood

Merge notes:

- preserve the fork diff panel and floating composer chrome
- keep `F9` fullscreen plan preview behavior authoritative

### Desktop Release Channel And Window Chrome Work

Status:

- `adapt`

Primary upstream work:

- `409ff90a`
- `f9580ff0`
- `dff8784a`
- `6891c77d`
- `b7df3dfc`

Files:

- `apps/desktop/src/main.ts`
- `apps/desktop/src/appBranding.ts`
- `apps/desktop/src/updateChannels.ts`
- release workflow and packaging scripts

Why:

- this work improves nightly channel handling, Windows packaging, and desktop chrome integration
- it overlaps `F1` directly and desktop shell behavior indirectly
- the fork should take the packaging and manifest reliability work, but not at the cost of Omarchy identity

Required fork behavior to preserve:

- Omarchy naming across desktop and release surfaces
- existing fork expectations for desktop chrome and exposed actions

## Implementation Order

1. adopt provider lifecycle and desktop startup hardening
2. adopt shell summary, stale cleanup, and worktree reliability fixes
3. adopt filesystem browse contracts and RPC substrate
4. adapt command palette store and narrow action set
5. adapt markdown file link UX
6. adapt responsive plan sidebar layout fixes
7. adapt grouped project sidebar model
8. evaluate whether broad chat shell virtualization is still needed after the earlier slices land

## Verification Focus

- provider sessions recover cleanly after restart and stale Claude sessions are reaped
- desktop startup waits for provider readiness without regressing current auth bootstrap behavior
- worktree setup, branch rename, and empty-thread worktree bootstrap still respect fork workflow rules
- command palette actions do not steal or reset composer draft state
- filesystem browse stays scoped and predictable across local and saved environments
- grouped project presentation does not hide fork plan cues or fork-first GitHub identity
- markdown file links behave correctly in chat and plan preview surfaces
- narrow layouts keep plan and diff access usable without flattening fork chrome
- release identity remains Omarchy across desktop packaging and channels

## Bottom Line

`v0.0.17 -> v0.0.19` should be integrated in slices, not as one merge.

The server and provider reliability work should be adopted early.

The highest-risk fork seams are the command palette stack, grouped sidebar model, markdown file link UX, and the broad chat shell churn around `ChatView`, `Sidebar`, and `MessagesTimeline`.
