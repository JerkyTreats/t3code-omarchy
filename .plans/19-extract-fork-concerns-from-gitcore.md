# Plan: Extract Fork Concerns from GitCore

## Summary

Refactor the server Git stack so `GitCore` owns repository primitives and `GitManager` owns fork-specific workflow behavior. Keep behavior stable while reducing future upstream merge conflicts in the Git layer.

## Target Boundary

- `GitCore` owns raw command execution, repository metadata, branch and worktree primitives, merge primitives, status parsing, and push or pull mechanics.
- `GitManager` owns browser-facing workflow policy, protected remote guardrails, publish target choice, repository context shaping for product behavior, progress events, promote flows, and issue-aware stacked actions.
- A pure policy module should hold fork rules that do not need runtime state.

## Rules

- Do not add fork product terms to `GitCore`.
- Do not add user-facing workflow copy to `GitCore` when it can live in `GitManager`.
- Keep `GitCore` return values raw unless a primitive contract already requires shaping.
- Route browser-facing Git methods through `GitManager` when they need policy decisions.
- Prefer pure helpers for remote policy so they are easy to test in isolation.

## Validation Gate

- `bun fmt`
- `bun lint`
- `bun typecheck`

## Phase 1

| Progress | Workstream | Scope | Exit criteria |
| --- | --- | --- | --- |
| Done | Lock current behavior | Add characterization coverage for pull routing and repository context seams | Current ownership is explicit in tests |
| Done | Verify checks | Run formatting, lint, and typecheck | Validation gate passes |

## Phase 2

| Progress | Workstream | Scope | Exit criteria |
| --- | --- | --- | --- |
| Done | Document ownership | Clarify primitive versus workflow responsibilities in service contracts and this plan | Contributors can place new Git logic without reading merge history |
| Done | Verify checks | Run formatting, lint, and typecheck | Validation gate passes |

## Phase 3

| Progress | Workstream | Scope | Exit criteria |
| --- | --- | --- | --- |
| Done | Extract pure policy | Move protected remote and publish target rules into a policy module with no behavior change | `GitCore` no longer implements fork policy inline |
| Done | Expand tests | Add policy tests and keep core tests green | Policy logic is isolated and covered |
| Done | Verify checks | Run formatting, lint, and typecheck | Validation gate passes |

## Phase 4

| Progress | Workstream | Scope | Exit criteria |
| --- | --- | --- | --- |
| Pending | Move browser workflows | Add manager methods for pull and repository context, then route websocket calls through the manager | UI actions no longer bypass workflow policy |
| Pending | Preserve behavior | Keep fork guardrails and existing RPC shapes stable | No user-visible regression |
| Pending | Verify checks | Run formatting, lint, and typecheck | Validation gate passes |

## Phase 5

| Progress | Workstream | Scope | Exit criteria |
| --- | --- | --- | --- |
| Pending | Slim core | Remove fork policy and browser context shaping from `GitCore` | Core file is primitive-focused |
| Pending | Rebalance tests | Keep `GitCore` tests primitive-focused and `GitManager` tests workflow-focused | Test ownership mirrors runtime ownership |
| Pending | Verify checks | Run formatting, lint, and typecheck | Validation gate passes |

## Done Criteria

- `GitCore` contains repository primitives only.
- Browser-facing Git policy lives in `GitManager` or pure policy helpers.
- WebSocket routes use the workflow layer for policy-aware operations.
- Tests reflect the new ownership boundary.
- `bun fmt` passes.
- `bun lint` passes.
- `bun typecheck` passes.
