# Upstream Intake `v0.0.19 -> v0.0.20`

## Goal

Define the intake plan for integrating upstream `v0.0.19 -> v0.0.20` into the fork while preserving the protected fork surfaces described in `patch.md`.

## Status

Complete.

The release workflow dependency install ordering was adopted.

The settings guard was adapted through schema backed client settings hydration in the web and desktop persistence paths. The exact upstream optional chaining hunks were not applied because this fork no longer carries the upstream sidebar project grouping override fields.

## Release Shape

This release line is tiny.

It is mostly:

- release workflow finalization
- one guard against missing sidebar project grouping overrides

That makes `v0.0.19 -> v0.0.20` a low-risk checkpoint that should be taken as a clean parity marker before the much larger `v0.0.20 -> v0.0.21` range.

## Protected Surfaces Touched

- `F8` plan-aware sidebar and activity status cues

## Intake Summary

### Adopt

These changes are high value and low conflict with fork-owned behavior:

- release workflow dependency install ordering in `.github/workflows/release.yml`
- defensive settings handling for missing sidebar grouping overrides

### Adapt

These changes are worth taking, but need a quick fork-shaped review:

- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/logicalProject.ts`
- `apps/web/src/hooks/useSettings.ts`
- `apps/desktop/src/clientPersistence.ts`

### Reject

No upstream behavior in this release line should be rejected outright.

Still reject during merge resolution:

- any incidental sidebar resolution that weakens explicit fork plan cues
- any grouping fallback that masks fork-first project identity assumptions

## File-Level Intake

### Release Workflow Finalization

Status:

- `adopted`

Primary upstream work:

- `b2cca674`

Files:

- `.github/workflows/release.yml`

Why:

- this is routine release hardening
- it does not collide with fork-owned product behavior

### Sidebar Grouping Guard

Status:

- `adapted`

Primary upstream work:

- `54904386`

Files:

- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/hooks/useSettings.ts`
- `apps/web/src/logicalProject.ts`
- `apps/desktop/src/clientPersistence.ts`

Why:

- the change is small, but it touches sidebar grouping state, which sits close to `F8`
- the fork should take the null-safety fix without disturbing current sidebar status semantics
- the fork no longer has `sidebarProjectGroupingOverrides`, so the durable equivalent is validating hydrated client settings through `ClientSettingsSchema`

Required fork behavior to preserve:

- explicit plan cues stay visible
- fork thread grouping and project identity remain stable

Recommended merge method:

1. Adopt the defensive settings fallback.
2. Recheck sidebar rendering for plan status and grouped project behavior.

## Implementation Order

1. Adopt the release workflow change.
2. Adapt the sidebar grouping guard.
3. Use this release line as the first explicit parity checkpoint after the existing `.19` branch base.

## Verification Focus

- release workflow still resolves dependencies correctly
- sidebar renders correctly when grouping overrides are missing
- fork plan status cues remain unchanged
- legacy partial client settings hydrate with defaults in web and desktop persistence tests

## Bottom Line

`v0.0.19 -> v0.0.20` has been absorbed.

The release is small, low-risk, and useful as a clean checkpoint before the larger provider and shell work in `v0.0.20 -> v0.0.21`.
