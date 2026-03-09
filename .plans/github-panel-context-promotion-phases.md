# GitHub Panel Context And Promotion Phases

Date: 2026-03-09
Status: active
Owner: web

## Intent

Track the phased overhaul for GitHub panel correctness, workspace awareness, repo switching, responsiveness, and promotion state integration.

## Progress

| Phase | Goal | Status | Checks | Commit | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Define canonical panel context and scope ownership | DONE | PASS | `refactor(web): define canonical github panel context` | Repo scope and workspace scope are explicit |
| 2 | Reset stale panel state and query results on context change | DONE | PASS | `fix(web): reset github panel state on context changes` | Context switches now clear local panel state and force a fresh fetch |
| 3 | Make project and thread switching rules explicit | DONE | PASS | `refactor(web): align project clicks with panel scope` | Project header clicks now activate that project thread context |
| 4 | Split panel into repo and workspace sections and improve responsiveness | DONE | PASS | `refactor(web): reorganize github panel layout for workspace flows` | Repo scope is explicit and narrow layouts stack cleanly |
| 5 | Integrate promotion state and next action guidance | DONE | PASS | `feat(web): show workspace promotion state guidance` | First slice derives workspace promotion state from available Git facts |
| 6 | Compact panel composition and review architecture cleanliness | DONE | PASS | `refactor(web): compact github panel composition` | Final pass compacted repeated panel layout and recorded the architecture review |

## Phase 1

### Goal

Create one canonical context model for the GitHub panel and make ownership of repo scoped data and workspace scoped data explicit.

### Detailed implementation plan

| Step | Change | Files | Done criteria |
| --- | --- | --- | --- |
| 1.1 | Add a pure `GitPanelContext` resolver with explicit repo root, workspace cwd, project id, workspace kind, and context key | `apps/web/src/lib/gitPanelContext.ts` | DONE |
| 1.2 | Update `ChatView` to derive and pass the canonical panel context | `apps/web/src/components/ChatView.tsx` | DONE |
| 1.3 | Refactor `GitHubPanel` props to use explicit `repoRoot` and `workspaceCwd` naming | `apps/web/src/components/GitHubPanel.tsx` | DONE |
| 1.4 | Key the panel by context identity at the mount site | `apps/web/src/components/ChatView.tsx` | DONE |
| 1.5 | Add focused tests for the resolver if adjacent test patterns exist | `apps/web/src/lib` | DONE |

### Implementation notes

- Repo scoped GitHub queries must use repo root only
- Workspace scoped Git queries and mutations must use workspace cwd only
- The context key should include project id, repo root, workspace cwd, and active thread id
- Phase 1 should not reshape the panel layout yet

### Validation

- `bun lint`
- `bun typecheck`
- `bun run test -- --run src/lib/gitPanelContext.test.ts` from `apps/web`

## Phase 2

### Goal

Eliminate stale panel state after thread changes, project changes, worktree creation, worktree removal, and merge actions.

### Detailed implementation plan

| Step | Change | Files | Done criteria |
| --- | --- | --- | --- |
| 2.1 | Reset merge and issue filter state when panel context changes | `apps/web/src/components/GitHubPanel.tsx` | DONE |
| 2.2 | Audit Git and GitHub query invalidation after branch and worktree mutations | `apps/web/src/lib/gitReactQuery.ts`, `apps/web/src/lib/githubReactQuery.ts` | DONE |
| 2.3 | Review `keepMounted` behavior and tighten remount rules | `apps/web/src/components/ChatView.tsx` | DONE |
| 2.4 | Fix live branch display to prefer current Git facts over stale thread metadata | `apps/web/src/components/GitHubPanel.tsx`, `apps/web/src/components/BranchToolbar.tsx`, `apps/web/src/components/ChatView.tsx` | DONE |

### Validation

- Switch between threads in the same project without stale merge state
- Switch between projects without stale repo slug or branch labels
- `bun lint`
- `bun typecheck`

## Phase 3

### Goal

Make the active entity rules explicit so the panel consistently follows the intended thread or project.

### Detailed implementation plan

| Step | Change | Files | Done criteria |
| --- | --- | --- | --- |
| 3.1 | Define active panel scope rules for thread scoped and project scoped views | `apps/web/src/lib/gitPanelContext.ts`, `docs/workspace_promotion_spec.md` | DONE |
| 3.2 | Audit sidebar project clicks and thread selection behavior | `apps/web/src/components/Sidebar.tsx` | DONE |
| 3.3 | Add explicit UI copy that names the current panel scope | `apps/web/src/components/GitHubPanel.tsx` | DONE |
| 3.4 | Ensure empty project states and draft thread states resolve correctly | `apps/web/src/components/ChatView.tsx`, `apps/web/src/components/GitHubPanel.tsx` | DONE |

### Validation

- Click between projects and verify the panel scope rule holds
- Create a new draft thread in another project and verify scope changes cleanly
- `bun lint`
- `bun typecheck`

## Phase 4

### Goal

Separate repo and workspace concerns in the layout and make the panel responsive under narrow and wide widths.

### Detailed implementation plan

| Step | Change | Files | Done criteria |
| --- | --- | --- | --- |
| 4.1 | Split the panel into repo, workspace, actions, auth, and issues sections | `apps/web/src/components/GitHubPanel.tsx` and child components | DONE |
| 4.2 | Rework long branch and path presentation | `apps/web/src/components/GitHubPanel.tsx` | DONE |
| 4.3 | Stack merge controls and action groups for narrow widths | `apps/web/src/components/GitHubPanel.tsx` | DONE |
| 4.4 | Collapse low priority metadata behind a disclosure area | `apps/web/src/components/GitHubPanel.tsx` | DEFERRED |
| 4.5 | Polish loading and refresh affordances on context switch | `apps/web/src/components/GitHubPanel.tsx` | DONE |

### Validation

- Verify narrow sheet layout
- Verify standard rail layout
- Verify long branch and path values remain readable
- `bun lint`
- `bun typecheck`

## Phase 5

### Goal

Integrate promotion state into the active workspace card and make next action guidance explicit.

### Detailed implementation plan

| Step | Change | Files | Done criteria |
| --- | --- | --- | --- |
| 5.1 | Add a pure promotion state calculator from Git facts | `apps/web/src/lib/workspacePromotionState.ts` | DONE |
| 5.2 | Add overlays for publish and review status | `apps/web/src/components/GitHubPanel.tsx` | DONE |
| 5.3 | Show next suggested action by state | `apps/web/src/components/GitHubPanel.tsx` | DONE |
| 5.4 | Surface conflict resolution as a first class state | `apps/web/src/components/GitHubPanel.tsx` | DONE |
| 5.5 | Draft short thread guidance on state changes | `apps/web/src/components/GitHubPanel.tsx` or adjacent helper | DEFERRED |

### Validation

- Verify seeded, draft, committed, needs sync, conflicted, ready, merged, and retired cases
- Verify loop closure rules after merge
- `bun lint`
- `bun typecheck`

## Phase 6

### Goal

Compact the GitHub panel composition, reduce repeated layout code, and complete a focused review of architecture, cleanliness, and maintainability before closing the rollout.

### Detailed implementation plan

| Step | Change | Files | Done criteria |
| --- | --- | --- | --- |
| 6.1 | Add small reusable panel primitives for repeated section and field layout | `apps/web/src/components/GitHubPanel.tsx` | DONE |
| 6.2 | Centralize active workspace summary presentation to reduce duplicated display logic | `apps/web/src/components/GitHubPanel.tsx` | DONE |
| 6.3 | Compact merge and workspace presentation without losing clarity on narrow widths | `apps/web/src/components/GitHubPanel.tsx` | DONE |
| 6.4 | Review the changed panel architecture for scope boundaries, cleanliness, and maintainability | `.plans/github-panel-context-promotion-phases.md`, `apps/web/src/components/GitHubPanel.tsx` | DONE |
| 6.5 | Re run required checks and capture review outcome in the plan | `.plans/github-panel-context-promotion-phases.md` | DONE |

### Review requirements

- Compact repeated render markup where the same layout pattern appears more than once
- Preserve the repo scope versus workspace scope boundary from earlier phases
- Prefer local extraction over broad new component sprawl unless a split clearly improves ownership
- Review the final code for readability, naming, duplication, and responsiveness regressions
- Record review findings and any intentional deferrals in this plan file before closing the phase

### Validation

- Verify repository and active workspace sections still read clearly after compaction
- Verify narrow layouts still wrap branch, path, and action content cleanly
- `bun lint`
- `bun typecheck`
- `bun run test -- --run src/lib/workspacePromotionState.test.ts src/lib/gitPanelContext.test.ts` from `apps/web`

### Review outcome

- Kept repo scope and workspace scope separated. Repo data still reads from `repoCwd`, while workspace actions still bind to `workspaceCwd`.
- Compacted repeated repository, workspace, auth, and issues card markup into local panel primitives inside `apps/web/src/components/GitHubPanel.tsx`.
- Centralized active workspace presentation into one derived summary so labels, badges, next action copy, and merge target copy stay aligned.
- Kept the compaction local to the panel file instead of splitting more files. The mutation and query ownership is still tightly coupled to this component.
- Deferred a larger file split for now. The current helper extraction improved readability without scattering ownership across many small files.

## Commit strategy

Use one focused commit per phase.

Recommended subjects:

- `design(web): phase github panel context and promotion overhaul`
- `refactor(web): define canonical github panel context`
- `fix(web): reset stale github panel state on context changes`
- `refactor(web): align project switching with panel scope rules`
- `design(web): reorganize github panel layout for responsive workspace flows`
- `feat(web): derive workspace promotion state in github panel`
- `refactor(web): compact github panel composition`
