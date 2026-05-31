# Patch Guide

Date: 2026-04-17
Status: active

## Intent

`patch.md` is the authoritative fork delta guide for this repository.

It defines the current expected behavior of fork owned features and the reconciliation rules to use when reviewing upstream changes.

Use it together with [Upstream Merge Policy](governance/upstream_merge_policy.md).

## Required Use

- Review this file before upstream sync, merge, or divergence work.
- Update this file in the same change whenever fork owned behavior changes.
- Keep each feature entry current for intent, owner modules, required behavior, and verification.
- Classify upstream changes against the relevant feature entry as `adopt`, `adapt`, or `reject`.
- If code and this file drift, fix the drift before merge.
- Treat this file as a current state guide, not a release log.

## Authority

- User request wins over this file.
- Repository governance wins over routine upstream defaults.
- This file defines authoritative expected behavior for fork owned features.
- When upstream differs from this file, preserve this file until the fork intentionally changes direction.

## Architectural Preference

Fork owned product behavior should usually be expressed through small, portable product modules that encode domain decisions without depending on a specific branch shape.

Prefer branch shaped adapter layers for router, store, transport, Git, source control, desktop, environment, and provider runtime details.

Prefer thin UI components that render product view models and call adapter callbacks instead of mixing fork policy directly into broad upstream shaped components.

This is a preference, not a hard rule. Direct edits to existing modules are acceptable when the behavior is narrow, the branch shape is stable, or an adapter would add more complexity than it removes.

When a feature is likely to be rebuilt onto future upstream `main` snapshots, bias toward pure product logic plus adapters so future rebuilds can replay product behavior first and branch integration second.

## Feature Index

- `F1` branding and release identity
- `F2` Omarchy system theme projection
- `F3` Omarchy screenshot capture and attach flow
- `F4` composer draft autonomy and composer chrome
- `F5` Git panel isolation from draft ownership
- `F6` fork first GitHub identity resolution
- `F7` local branch, worktree, and promotion workflow
- `F8` plan aware sidebar and activity status cues
- `F9` plan markdown preview and markdown rendering behavior
- `F10` Codex model and binary selection
- `F11` source control provider lane and publish workflow
- `F12` provider instance identity seam
- `F13` auth access management
- `F14` project management and inference dashboard

## F1 Branding And Release Identity

### Intent

Fork builds identify as `T3 Code Omarchy` instead of generic upstream `T3 Code`.

### Required Behavior

- Desktop naming uses the Omarchy product identity across packaged and development surfaces.
- Web branding uses the same Omarchy base identity.
- Release identity keeps fork naming visible and must not silently fall back to upstream naming.

### Owner Modules

- `apps/desktop/package.json`
- `packages/shared/src/productIdentity.ts`
- `apps/desktop/src/app/DesktopEnvironment.ts`
- `apps/desktop/scripts/electron-launcher.mjs`
- `apps/web/src/branding.ts`
- `scripts/build-desktop-artifact.ts`
- `scripts/resolve-nightly-release.ts`
- `scripts/notify-discord-release.ts`

### Upstream Intake Rule

- Reject upstream naming changes that replace fork identity.
- Adapt release workflow or packaging changes so fork naming survives.

### Verification

- Desktop window title and packaged product name use the Omarchy identity.
- Web visible product name uses the Omarchy identity.

## F2 Omarchy System Theme Projection

### Intent

System theme behavior on desktop Linux follows Omarchy theme state instead of generic upstream theme detection.

### Required Behavior

- Theme discovery reads Omarchy state from `~/.config/omarchy/current`.
- Theme source is `omarchy` when Omarchy theme data is available.
- Web theme variables project Omarchy accent, foreground, background, selection, and terminal colors into the UI.
- Missing Omarchy state degrades safely without pretending a generic upstream theme source is authoritative.

### Owner Modules

- `apps/desktop/src/fork/OmarchyThemeSource.ts`
- `apps/desktop/src/fork/DesktopSystemThemeService.ts`
- `apps/desktop/src/main.ts`
- `apps/desktop/src/preload.ts`
- `apps/desktop/src/ipc/channels.ts`
- `apps/desktop/src/ipc/methods/window.ts`
- `apps/web/src/hooks/useTheme.ts`
- `apps/web/src/index.css`

### Upstream Intake Rule

- Adapt upstream theme infrastructure changes under the Omarchy source model.
- Reject upstream behavior that replaces Omarchy as the authoritative desktop theme source on Linux.

### Verification

- Changing Omarchy theme state updates desktop theme projection.
- Web colors and terminal palette follow Omarchy theme values when available.

## F3 Omarchy Screenshot Capture And Attach Flow

### Intent

Screenshot capture and attach flows are tuned for Omarchy tooling and Linux desktop capability checks.

### Required Behavior

- Desktop capture prefers `omarchy-capture-screenshot` when available and still recognizes legacy `omarchy-cmd-screenshot`.
- Capture resolves the Omarchy screenshot output directory and handles Omarchy smart mode behavior.
- Capture waits for a complete PNG artifact before attaching it.
- Clipboard fallback remains available when Omarchy updates the clipboard instead of writing a file.
- Composer chrome exposes screenshot capture as a first class action and attaches the result into the active draft.

### Owner Modules

- `apps/desktop/src/fork/OmarchyScreenshotCapture.ts`
- `apps/desktop/src/main.ts`
- `apps/desktop/src/preload.ts`
- `apps/desktop/src/ipc/channels.ts`
- `apps/desktop/src/ipc/methods/window.ts`
- `apps/web/src/fork/composerScreenshot.ts`
- `apps/web/src/components/chat/ChatComposer.tsx`

### Upstream Intake Rule

- Adapt upstream screenshot or attachment changes under the Omarchy capture contract.
- Reject upstream flows that remove Omarchy specific capture probing or attach behavior.

### Verification

- Screenshot capture works through Omarchy tooling when available.
- Composer receives the captured image as a draft attachment.
- Failure paths keep clear user facing error handling.

## F4 Composer Draft Autonomy And Composer Chrome

### Intent

The composer owns its local draft state and preserves rich draft behavior under fork specific chrome and affordances.

### Required Behavior

- Draft text, images, screenshots, attachments, terminal context chips, and local thread draft state remain under composer ownership until explicit user action changes them.
- Runtime access control and screenshot actions stay in the floating top action chrome.
- Rich draft controls remain available and are not flattened into a generic upstream composer layout.
- Attachment previews and local persistence warnings remain visible when relevant.

### Owner Modules

- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/fork/composerScreenshot.ts`
- `apps/web/src/fork/composerRichDraft.ts`
- `apps/web/src/components/chat/ChatComposer.tsx`
- `apps/web/src/components/chat/ComposerRichDraftToolbar.tsx`
- `apps/web/src/composerDraftStore.ts`

### Upstream Intake Rule

- Adapt upstream composer improvements into the fork layout and ownership model.
- Reject upstream composer simplifications that remove fork specific draft affordances or move ownership away from the active draft.

### Verification

- Draft text and attachments survive nearby UI interactions.
- Runtime access and screenshot controls remain in the fork chrome position.
- Rich draft controls remain present when enabled and formatting actions update the active draft.

## F5 Git Panel Isolation From Draft Ownership

### Intent

Git panel flows must not take ownership of the active composer draft or silently reset it.

### Required Behavior

- Git panel actions operate on thread, branch, and worktree context without consuming draft text or attachments.
- Draft state remains intact while Git panel operations run.
- Git related thread routing keeps fork specific draft ownership semantics.
- Worktree discard completes active worktree thread teardown before primary workspace draft routing runs, so teardown does not race draft routing.
- Worktree discard never silently claims or clears unrelated composer content while switching back to the primary workspace.

### Owner Modules

- `apps/web/src/components/GitActionsControl.tsx`
- `apps/web/src/components/GitActionsControl.logic.ts`
- `apps/web/src/composerDraftStore.ts`
- `apps/web/src/components/ChatView.browser.tsx`
- `apps/web/src/lib/threadDeletionWorkflow.ts`

### Upstream Intake Rule

- Adapt upstream Git UX or routing changes so composer draft ownership remains isolated.
- Reject upstream coupling that makes Git panel interactions mutate unrelated draft state.

### Verification

- Opening and using Git panel flows does not clear the active draft.
- Branch and worktree routing preserves the expected draft thread state.
- Changing the Git base branch preserves prompt text, images, terminal context chips, and rich draft mode on the active draft.
- Worktree removal completes before fallback navigation when deleting the only thread linked to a dedicated worktree.
- Discarding a dedicated worktree returns the user to a stable primary workspace draft without losing unrelated draft content.

## F6 Fork First GitHub Identity Resolution

### Intent

GitHub context resolves to the fork remote first so repo, issue, and panel actions follow fork ownership by default.

### Required Behavior

- User facing GitHub repository context resolves to the fork remote before upstream.
- Issue and pull request context preserve fork first identity.
- Cross repository head handling may add remotes for pull request heads without replacing fork first default identity.

### Owner Modules

- `apps/server/src/git/Layers/GitHubCli.ts`
- `apps/server/src/git/Layers/GitManager.ts`

### Upstream Intake Rule

- Adapt upstream GitHub integration changes at the fork identity seam.
- Reject upstream behavior that silently redirects user facing GitHub actions to upstream by default.

### Verification

- Repo context, issue flows, and GitHub panel actions target the fork repository by default.
- Pull request prep preserves fork first remote identity while still supporting cross repository heads.

## F7 Local Branch, Worktree, And Promotion Workflow

### Intent

Local Git workflow semantics favor fork safety and explicit promotion behavior over generic upstream shortcuts.

### Required Behavior

- Promotion creates a backup branch under `t3code/promote-backup` before destructive follow through.
- Promotion merges source into target, pushes the target branch, and cleans up the source branch when the flow succeeds and cleanup is safe.
- Worktree preparation preserves fork upstream tracking behavior and local branch safety checks.
- Worktree close and discard use a shared lifecycle substrate for runtime stop, terminal teardown, worktree removal, query invalidation, and thread state cleanup.
- Worktree close releases the thread back to the primary checkout without deleting the thread.
- Worktree discard fully tears down the dedicated workspace, including thread cleanup, so failed worktrees can be thrown away cleanly.
- Local workflow guidance stays explicit about promotion and merge behavior.

### Owner Modules

- `apps/server/src/git/Layers/GitManager.ts`
- `apps/web/src/components/GitActionsControl.tsx`

### Upstream Intake Rule

- Adapt upstream Git workflow improvements under the fork promotion contract.
- Reject upstream simplifications that remove backup branch creation, safe cleanup, or fork specific worktree guarantees.

### Verification

- Promotion creates the backup branch and finishes with the expected target branch state.
- Source branch cleanup happens only after the guarded success path.
- Worktree flows preserve fork upstream tracking expectations.
- Closing and discarding a dedicated worktree leave no stale runtime or terminal state behind.

## F8 Plan Aware Sidebar And Activity Status Cues

### Intent

Thread and sidebar status cues reflect plan state directly instead of collapsing plan work into a generic running label.

### Required Behavior

- Sidebar and activity surfaces show explicit plan aware progress when plan data exists.
- Fractional plan progress such as `1/4` remains visible when a plan exposes step progress.
- Plan ready and active plan cues remain visible where the fork currently surfaces them.
- Plan sidebar affordances remain available from the active thread view.
- Optional logical project grouping may add sidebar group labels, but concrete project rows, thread rows, status dots, plan progress, rename, removal, and project path actions remain owned by the original project entries.
- Group labels are presentation only and must not become the source of GitHub identity, project identity, or workspace path decisions.

### Owner Modules

- `apps/web/src/components/Sidebar.logic.ts`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/PlanSidebar.tsx`
- `apps/web/src/components/ChatView.tsx`

### Upstream Intake Rule

- Adapt upstream activity and thread status changes so plan aware cues remain explicit.
- Reject upstream regressions that replace explicit plan progress with generic running labels.

### Verification

- Threads with active plan steps show fractional progress when the data exists.
- Plan ready and in progress cues render in sidebar and thread activity surfaces.
- Plan sidebar remains reachable from the thread view.
- Enabling logical project grouping keeps concrete project actions and plan aware thread cues visible.

## F9 Plan Markdown Preview And Document Markdown Rendering Behavior

### Intent

Plan review, project document preview, and markdown presentation preserve fork specific preview flows, navigation behavior, and readability guarantees instead of falling back to a narrower generic upstream markdown surface.

### Required Behavior

- Proposed plans can open into a fullscreen in memory markdown preview without requiring a workspace file write first.
- Plan preview keeps plan specific actions such as copy, download, and explicit save to workspace.
- Plan preview keeps route driven return behavior so the user can move back to chat cleanly.
- Chat markdown, plan preview markdown, and project document markdown all preserve horizontal overflow handling for wide tables and code blocks.
- Document markdown owns a richer rendering surface than chat markdown, including stable heading ids, local heading anchors, code copy controls, syntax highlighting, safe raw HTML support for document oriented tags, and readable document typography.
- Mermaid fenced code blocks render as diagrams in document preview surfaces, with a readable failure state that can expose source when rendering fails.
- Markdown image links in document previews resolve through the document asset pipeline when possible and support image preview or lightbox behavior without breaking external image links.
- Plan preview and project document links keep fork specific navigation behavior for workspace paths, local anchors, and external links.
- Workspace relative links navigate within the document preview or files preview route instead of forcing an editor open when an in app preview target exists.
- External links open through the native shell or supported local API boundary instead of being treated as workspace paths.
- Local hash links scroll to the matching generated heading anchor inside the current document preview.
- The document renderer can hide the source footer when the preview is virtual rather than backed by a real workspace file.
- Project files preview remains part of this feature area because it is the primary in app consumer of document markdown navigation, document preview routing, image resolution, and source file open behavior.
- Document outline affordances remain available when a document preview exposes heading structure.

### Owner Modules

- `apps/web/src/components/ChatMarkdown.tsx`
- `apps/web/src/components/DocumentMarkdownRenderer.tsx`
- `apps/web/src/components/DocumentOutlineRail.tsx`
- `apps/web/src/components/PlanConversationDocument.tsx`
- `apps/web/src/components/SourceFilePreview.tsx`
- `apps/web/src/components/CheckpointFilePreviewSurface.tsx`
- `apps/web/src/components/CheckpointImageLightbox.tsx`
- `apps/web/src/components/useCheckpointAssetResolver.ts`
- `apps/web/src/components/files-panel/FilesConversationDocument.tsx`
- `apps/web/src/components/files-panel/FilesPanelRouteAdapter.tsx`
- `apps/web/src/components/files-panel/ProjectExplorerPanel.tsx`
- `apps/web/src/components/chat/ProposedPlanCard.tsx`
- `apps/web/src/components/PlanSidebar.tsx`
- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/chatPanelRouteSearch.ts`
- `apps/web/src/diffRouteSearch.ts`
- `apps/web/src/markdown-links.ts`
- `apps/web/src/routes/_chat.$threadId.tsx`
- `apps/web/src/routes/_chat.$environmentId.$threadId.tsx`
- `apps/web/src/index.css`

### Upstream Intake Rule

- Adapt upstream markdown and document preview changes under the fork plan preview contract.
- Preserve the richer document markdown renderer when upstream changes chat markdown internals.
- Preserve route based document preview navigation when upstream changes diff, files, plan, or chat route search state.
- Reject upstream changes that remove fullscreen in memory plan preview, remove in app project document preview, regress plan or document navigation, remove document outline behavior, disable Mermaid or image preview support, or reintroduce clipped markdown content in protected surfaces.

### Verification

- A proposed plan can open in fullscreen markdown preview from the timeline card and the plan sidebar.
- Returning from fullscreen plan preview restores the chat route without forcing a workspace write.
- Wide markdown tables and code blocks remain horizontally scrollable instead of stretching or clipping the layout in chat markdown, plan preview, and project document preview.
- Workspace path links, local heading links, and external links keep the expected fork navigation behavior in plan preview and markdown document surfaces.
- Relative markdown links can navigate between in app document previews without opening an external editor when a preview route is available.
- Local heading links scroll to generated heading anchors inside the current document preview.
- Mermaid fenced code renders a diagram or a readable source backed failure state.
- Markdown images in document previews resolve through the asset pipeline and can open in a preview or lightbox when available.
- Document outline entries reflect rendered heading structure and navigate to the selected heading.
- Virtual plan preview hides source file footer while real project document previews keep source open behavior available.

## F10 Codex Model And Binary Selection

### Intent

Codex provider setup follows the installed Codex app-server capability surface instead of relying on stale hardcoded model lists or ambiguous shell binary resolution.

### Required Behavior

- Codex provider models prefer `model/list` from the selected Codex app-server when available.
- Codex provider skills prefer `skills/list` from the selected Codex app-server when available.
- Built in Codex models remain only as a fallback when app-server model discovery is unavailable.
- Custom Codex models configured by the user remain merged into the provider model list.
- App-server initialization uses the resolved Codex CLI version as the client version so newer models are not rejected as requiring a newer Codex.
- Settings expose detected supported Codex binaries when available.
- An explicit non bare Codex binary path selected by the user remains pinned and must not be silently replaced by another PATH or environment candidate.
- Desktop launch preserves an explicit configured Codex binary path for the backend child process.

### Owner Modules

- `apps/desktop/scripts/electron-launcher.mjs`
- `apps/desktop/src/main.ts`
- `apps/server/src/codexAppServerManager.ts`
- `apps/server/src/provider/Layers/CodexProvider.ts`
- `apps/server/src/provider/codexAppServer.ts`
- `apps/server/src/provider/codexCliBinary.ts`
- `apps/server/src/provider/providerSnapshot.ts`
- `apps/web/src/components/settings/SettingsPanels.tsx`
- `packages/contracts/src/server.ts`

### Upstream Intake Rule

- Adapt upstream provider model changes so Codex app-server model discovery remains authoritative when available.
- Reject upstream changes that reintroduce a hardcoded Codex only model catalog as the primary source.
- Reject upstream binary resolution changes that silently replace an explicit user selected Codex binary path.

### Verification

- A Codex app-server `model/list` response containing a new model such as `gpt-5.5` appears in the Codex model selector without a code update to the built in fallback list.
- A Codex app-server `skills/list` response containing an enabled skill appears in provider status and can be used by the composer.
- App-server initialize sends the resolved Codex CLI version as `clientInfo.version`.
- Settings show detected supported Codex binaries and selecting one persists its absolute path.
- Restarting the desktop app keeps the configured Codex binary path for the backend process.
- Explicit binary path pinning does not fall through to a newer PATH or environment binary unless the user selected bare `codex`.

## F11 Source Control Provider Lane And Publish Workflow

### Intent

Source control support exposes GitHub, GitLab, Azure DevOps, and Bitbucket through one provider lane while preserving fork Git workflow guardrails.

### Required Behavior

- Source control discovery reports real provider readiness for GitHub, GitLab, Azure DevOps, and Bitbucket.
- Repository lookup, clone, and publish are exposed through additive source control RPC and native API capabilities.
- Sidebar add project supports local path and clone remote modes, with provider clone lookup using SSH by default and raw Git URL clone bypassing provider lookup.
- Git panel publish is the publish surface for repositories without an origin remote.
- Publish creates the remote repository, ensures the requested remote, and pushes to the actual remote returned by remote wiring.
- Empty local repositories create and wire the remote but return `remote_added` without pushing.
- GitHub issue UI remains GitHub only.
- Pull request and merge request workflows resolve through the repository provider when available, while GitHub CLI fallback remains available for GitHub and unknown provider cases.
- Fork promotion, worktree, cross repository, and protected default branch behavior from `F6` and `F7` remains authoritative.

### Owner Modules

- `packages/contracts/src/rpc.ts`
- `packages/contracts/src/ipc.ts`
- `apps/server/src/sourceControl`
- `apps/server/src/git/Layers/GitCore.ts`
- `apps/server/src/git/Layers/GitHubCli.ts`
- `apps/server/src/git/Layers/GitManager.ts`
- `apps/server/src/server.ts`
- `apps/server/src/ws.ts`
- `apps/web/src/lib/sourceControlReactQuery.ts`
- `apps/web/src/wsRpcClient.ts`
- `apps/web/src/wsNativeApi.ts`
- `apps/web/src/forkNativeApiAdapter.ts`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/GitActionsControl.tsx`
- `apps/web/src/sourceControlPresentation.ts`

### Upstream Intake Rule

- Adapt upstream source control changes through the provider registry and repository service instead of adding provider specific UI paths.
- Preserve fork Git workflow semantics when upstream behavior conflicts with promotion, worktree, protected branch, or fork identity behavior.
- Reject upstream changes that make GitHub issues appear provider neutral before non GitHub issue parity exists.

### Verification

- Source control provider registry, repository service, provider CLI/API, GitCore, GitManager, server, and web native/RPC tests pass.
- Publishing with commits pushes to the remote returned by `ensureRemote`.
- Publishing an empty repository returns `remote_added`.
- Sidebar clone by provider and raw Git URL both create projects at the cloned cwd.
- Git panel publish remains hidden or disabled when source control capability is unavailable.

## F12 Provider Instance Identity Seam

### Intent

Provider status and settings can carry provider instance identity without collapsing every runtime view back to one provider kind row.

### Required Behavior

- Provider snapshots preserve legacy `provider` while carrying additive `instanceId` and `driver` fields when available.
- Provider status aggregation keys snapshots by instance identity so two snapshots with the same driver kind do not overwrite each other.
- Server settings accept and preserve the `providerInstances` envelope for custom instance definitions.
- Web provider instance projection uses `instanceId` as the routing identity and `driver` as presentation and capability context, with legacy provider kind fallback for older snapshots.
- Provider adapter routing, provider sessions, runtime events, recovery, and stop flows carry `providerInstanceId` while preserving legacy provider kind fallback.
- Custom provider instances materialize as provider registry snapshots without duplicating singleton adapter event streams.
- Provider settings expose custom instance add, enable, disable, and delete controls in the fork settings layout.
- Provider snapshots may carry provider slash commands, and the composer slash command menu must read commands from the active provider instance snapshot.
- Provider snapshots may carry provider skills, and the composer skill menu must read skills from the active provider instance snapshot.
- Composer skill tokens render as `$skill` chips when metadata is available while preserving the raw prompt token value.
- Full custom adapter materialization and turn routing remain owned by the provider runtime seam and must preserve fork composer draft ownership plus Codex model and binary selection behavior.

### Owner Modules

- `packages/contracts/src/providerInstance.ts`
- `packages/contracts/src/orchestration.ts`
- `packages/contracts/src/server.ts`
- `packages/contracts/src/settings.ts`
- `packages/shared/src/model.ts`
- `apps/server/src/provider/providerSnapshot.ts`
- `apps/server/src/provider/providerStatusCache.ts`
- `apps/server/src/provider/providerInstanceSettings.ts`
- `apps/server/src/provider/Services/ProviderAdapterRegistry.ts`
- `apps/server/src/provider/Services/ProviderSessionDirectory.ts`
- `apps/server/src/provider/Layers/ProviderRegistry.ts`
- `apps/server/src/provider/Layers/ProviderAdapterRegistry.ts`
- `apps/server/src/provider/Layers/ProviderService.ts`
- `apps/server/src/provider/Layers/ProviderSessionDirectory.ts`
- `apps/server/src/provider/Layers/ClaudeProvider.ts`
- `apps/server/src/provider/Layers/CodexAdapter.ts`
- `apps/server/src/provider/Layers/ClaudeAdapter.ts`
- `apps/server/src/provider/Layers/CursorAdapter.ts`
- `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts`
- `apps/server/src/codexAppServerManager.ts`
- `apps/web/src/providerInstances.ts`
- `apps/web/src/providerModels.ts`
- `apps/web/src/modelSelection.ts`
- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/components/chat/ComposerCommandMenu.tsx`
- `apps/web/src/components/chat/composerSlashCommandSearch.ts`
- `apps/web/src/providerSkillPresentation.ts`
- `apps/web/src/composer-editor-mentions.ts`
- `apps/web/src/composer-logic.ts`
- `apps/web/src/components/ComposerPromptEditor.tsx`
- `apps/web/src/components/chat/ProviderModelPicker.tsx`
- `apps/web/src/components/settings/SettingsPanels.tsx`

### Upstream Intake Rule

- Adapt upstream provider instance work through the provider runtime seam so fork composer draft ownership, screenshot controls, and Codex model discovery remain intact.
- Preserve legacy provider kind compatibility until all persisted thread, model selection, and session routing paths are instance aware.
- Reject changes that drop unknown or unavailable instance data during settings decode or provider status projection.

### Verification

- Legacy provider snapshots decode without instance fields.
- Instance aware provider snapshots decode with `instanceId`, `driver`, display metadata, and continuation metadata.
- Provider status cache and aggregation preserve distinct snapshots that share a driver kind.
- Web provider instance helpers keep custom instances distinct from default instances.
- Provider service routes start, send, recover, and stop flows through `providerInstanceId`.
- Composer model selection preserves custom instance ids across draft and persisted selections.
- Settings can create, enable, disable, and delete custom provider instances.
- Claude slash commands discovered from provider capabilities appear in the composer slash command menu for the active provider instance.
- Selecting a provider slash command inserts the command into the draft without changing active draft ownership.
- Codex skills discovered from provider capabilities appear in the composer skill menu for the active provider instance.
- Selecting a provider skill inserts the `$skill` token into the draft without changing active draft ownership.
- Existing prompts without skill metadata remain editable as plain text.

## F13 Auth Access Management

### Intent

Auth access management is exposed through the fork native API and Connections settings so pairing links and client sessions can be managed without CLI work while preserving local-first desktop and saved environment flows.

### Required Behavior

- The server exposes auth access snapshot, pairing link creation, pairing link revocation, client session revocation, and other-client session revocation through additive WebSocket RPC methods.
- RPC errors use the shared auth access error contract instead of leaking server-only auth service errors.
- NativeApi exposes the auth access surface through the RPC-backed adapter.
- Native API capability detection reports access management availability and disables controls when the active transport cannot support it.
- Connections settings can create temporary pairing links, list and revoke active pairing links, list client sessions, revoke non-current client sessions, and revoke other client sessions.
- Current session revocation remains disabled in the settings UI.
- Existing paste pairing-link, saved environment reconnect, disconnect, forget, SSH connect, and local-first desktop fallback flows remain unchanged.

### Owner Modules

- `packages/contracts/src/auth.ts`
- `packages/contracts/src/rpc.ts`
- `packages/contracts/src/ipc.ts`
- `apps/server/src/ws.ts`
- `apps/web/src/wsRpcClient.ts`
- `apps/web/src/wsNativeApi.ts`
- `apps/web/src/forkNativeApiAdapter.ts`
- `apps/web/src/components/settings/ConnectionsSettings.tsx`
- `apps/web/src/environments`

### Upstream Intake Rule

- Adapt upstream auth and hosted connectivity changes through the fork NativeApi and Connections settings surface.
- Preserve local-first desktop behavior and saved environment workflows when upstream changes pairing or access management flows.
- Reject changes that expose destructive session revocation without current-session protection or transport capability gating.

### Verification

- Connections settings can create a pairing link and refresh the access snapshot.
- Connections settings can revoke active pairing links.
- Connections settings can list client sessions, revoke non-current sessions, and revoke other sessions.
- NativeApi forwards auth access actions through RPC in browser-backed and desktop-backed web flows.
- Saved environment pairing, reconnect, disconnect, forget, and SSH connect flows continue to work unchanged.

## F14 Project Management And Inference Dashboard

### Intent

Project level management gives each concrete project a first class workspace page for repository operations, project scripts, editor actions, linked threads, and inference usage without collapsing project identity into sidebar grouping or thread only surfaces.

### Required Behavior

- Project management is reachable from sidebar project actions and command palette project actions.
- Project routes preserve concrete project identity, including environment identity when multiple environments can expose projects with overlapping ids.
- Logical project grouping remains presentation only and must not become the source of workspace path, repository identity, or project route decisions.
- The management page exposes project name, workspace path, repository summary, new thread action, latest active thread navigation, editor open actions, and project script actions.
- Project scoped Git management works without requiring an active thread while preserving thread scoped Git actions where they remain meaningful.
- Project scoped Git management must not take ownership of, clear, or reroute unrelated composer draft content.
- The inference dashboard is reachable from project management and summarizes project wide model work across linked project threads.
- Inference rollups use the latest usage snapshot per turn and preserve provider reported total processed tokens when available.
- Inference rollups handle cached input tokens without double counting cached input when providers report cached input as a subset of input.
- The dashboard shows lifetime burn, recent burn, projected thirty day burn, input, cached input, output, tracked turns, and a ranked thread leaderboard.
- Thread links from the project page and dashboard preserve environment aware thread routing.
- Missing project data after bootstrap redirects or degrades safely instead of rendering stale project content.

### Owner Modules

- `apps/web/src/routes/_chat.projects.$projectId.tsx`
- `apps/web/src/routes/_chat.projects.$environmentId.$projectId.tsx`
- `apps/web/src/components/ProjectOverviewPage.tsx`
- `apps/web/src/components/ProjectInferenceDashboardPage.tsx`
- `apps/web/src/components/ProjectOverview.logic.ts`
- `apps/web/src/components/ProjectInference.logic.ts`
- `apps/web/src/components/useProjectPageData.ts`
- `apps/web/src/components/ProjectManagementHeader.tsx`
- `apps/web/src/components/ProjectPageShell.tsx`
- `apps/web/src/components/ProjectPanel.tsx`
- `apps/web/src/components/ProjectPanelSection.tsx`
- `apps/web/src/components/ProjectScriptsControl.tsx`
- `apps/web/src/components/git-panel/GitPanel.tsx`
- `apps/web/src/components/git-panel/GitPanelRouteAdapter.tsx`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/CommandPalette.tsx`
- `apps/web/src/threadRoutes.ts`
- `apps/web/src/storeSelectors.ts`

### Upstream Intake Rule

- Adapt upstream project page, dashboard, and route changes so concrete project identity and environment aware routing remain explicit.
- Preserve fork sidebar grouping rules so grouped labels never replace concrete project identity for management actions.
- Preserve fork Git panel draft isolation and source control guardrails when project scoped Git actions are added or changed.
- Reject upstream changes that make inference totals depend only on prompt and response tokens when provider processed token totals are available.
- Reject upstream changes that remove project level access to scripts, editor actions, latest thread navigation, or dashboard navigation.

### Verification

- Sidebar and command palette project actions open the management page for the intended concrete project.
- Environment scoped project routes distinguish projects with the same id or path across saved environments.
- Grouped sidebar projects keep group labels presentation only while concrete project actions still target concrete projects.
- Project management can start a new thread, open the latest active thread, open the project in an available editor, and run project scripts.
- Project scoped Git management renders repository state without an active thread and does not clear active composer drafts.
- The inference dashboard counts only the latest usage snapshot for each turn.
- The inference dashboard preserves `totalProcessedTokens` and falls back to `usedTokens` plus token components when needed.
- Cached input handling avoids double counting when cached input is reported as an input subset.
- Dashboard leaderboard links navigate to the correct environment scoped threads.
- Missing or removed project state after bootstrap exits the page without stale project details.

## Change Procedure

- Update the affected feature entry in the same change that modifies fork behavior.
- Add a new feature entry before merge if a new fork owned surface is introduced.
- Remove a feature entry only when the fork intentionally drops that behavior and the replacement is documented here in the same change.
