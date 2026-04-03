# Upstream Merge Policy

Date: 2026-03-13
Status: active

## Intent

Keep this fork current with upstream where that improves reliability, performance, security, or maintainability.

Preserve Omarchy specific product and design decisions as the governing source for this repository.

Treat upstream as a strong implementation reference, not the final authority for fork owned behavior.

## Fork Identity

This repository is an Omarchy tuned fork of T3 Code.

It intentionally carries product, desktop, and workflow opinions that may differ from upstream.

Those local decisions are part of the product contract for this fork and should not be removed only because upstream chose a different direction.

## Authority Order

- User request wins over repository policy.
- Repository governance wins over routine upstream defaults.
- Fork product and design decisions win over conflicting upstream product and design decisions.
- Upstream wins by default only when a change does not conflict with fork owned behavior or repository governance.

## Fork Owned Surfaces

The fork has final authority for these areas:

- branding, naming, and release identity
- Linux desktop behavior tied to Omarchy
- screenshot capture and attach flows tied to Omarchy tooling
- system theme behavior derived from Omarchy theme state
- GitHub panel behavior and local Git workflow guidance
- workspace promotion behavior and merge guidance
- governance files and repository process rules

## Protected Fork Features

Treat these as protected fork features during every upstream sync:

- fork first GitHub identity resolution for repo, issue, and panel context
- draft autonomy for composer text, screenshots, attachments, and local thread state
- Git panel isolation from active draft ownership and prompt state
- plan sidebar progress affordances and other fork specific status cues
- local branch, worktree, and promotion workflow behavior
- Omarchy specific desktop and screenshot integration behavior

Do not remove, replace, silently degrade, or route around these features without an intentional fork decision that is recorded in the merge notes.

## Upstream Intake Classes

Classify each meaningful upstream change into one of these outcomes:

- `adopt` when the upstream change improves shared behavior and does not conflict with fork owned surfaces
- `adapt` when the upstream change is valuable but must be reshaped to preserve fork behavior
- `reject` when the upstream change weakens Omarchy alignment or replaces a fork owned product decision

## Default Intake Rules

- Adopt upstream bug fixes, security fixes, performance improvements, and low risk maintainability work by default when they do not conflict with fork owned behavior.
- Adapt upstream changes that improve internals but touch fork owned UX, desktop integration, or workflow semantics.
- Reject upstream changes that make the product more generic at the expense of Omarchy specific behavior.
- Reject upstream changes that remove, obscure, or regress fork owned workflow guidance unless the fork intentionally changes that guidance.

## Merge Decision Rules

- When upstream and fork both touch the same file, preserve fork intent first, then port upstream improvements into the fork shape.
- Never discard Omarchy specific UX or desktop behavior only to reduce merge effort.
- Prefer small integration commits or pull requests that clearly describe what was adopted, adapted, and rejected.
- When a divergence becomes long lived, isolate the fork seam so future upstream sync work stays cheaper and safer.

## Required Fork Preservation Gate

Before an upstream sync, merge, or divergence update is ready for review or merge, complete this gate:

- identify the protected fork features touched by the incoming upstream change
- classify each meaningful change as `adopt`, `adapt`, or `reject`
- state the fork seam or owner module where reconciliation happens
- verify that no protected fork feature silently falls back to generic upstream behavior
- verify that active drafts, screenshots, attachments, and local Git context remain intact across the affected flows
- verify that fork specific sidebar, panel, and workflow affordances still render and behave as expected
- record the protected fork features reviewed in the pull request, merge notes, or commit body

If this gate is not completed, the upstream merge is not ready.

## Seam Strategy

- Prefer a narrow upstream facing capability layer plus a fork owned adapter or policy layer when the same domain changes frequently in both codebases.
- Keep upstream shaped contracts, process details, and transport mechanics on the upstream facing side of the seam.
- Keep fork owned product semantics, workflow policy, UX state shaping, and progress translation on the fork side of the seam.
- Treat the adapter or policy layer as the definitive place where upstream changes are reconciled into fork behavior.
- If an upstream merge repeatedly forces edits across web, server, and desktop for the same concern, extract or strengthen the seam before the next sync.
- Browser facing or desktop facing services should depend on fork domain contracts when practical, not directly on upstream shaped runtime details.
- Avoid pass through abstractions that only rename methods without encoding ownership or behavior boundaries.

## Conflict Resolution Rules

- Correctness and reliability win over convenience.
- On pure product or design conflict, fork decisions win.
- On pure bug fix, performance, or security conflict, upstream behavior should usually be integrated unless it breaks fork owned behavior.
- When both sides change the same workflow, keep the fork UX contract and reapply upstream internals under that contract when practical.
- When a conflict changes contracts, persisted state, or user visible workflow, call out the impact before merge.

## Operational Process

- Review upstream regularly.
- Use the external watch workflow to surface new upstream changes.
- For each upstream sync, record the adopted, adapted, and rejected changes in the pull request or commit body.
- For each upstream sync, explicitly record which protected fork features were checked and whether any were intentionally changed.
- Call out compatibility impact for desktop IPC, WebSocket contracts, persisted browser state, server side state, and user visible workflow.
- When adapting a shared domain, note where the authoritative fork seam lives so later merges have one clear reconciliation point.
- Before considering an upstream sync complete, ensure `bun fmt`, `bun lint`, and `bun typecheck` all pass.

## Non Goals

- blindly mirroring upstream product, UX, or workflow choices
- forcing zero divergence from upstream at all times
- replacing reviewer judgment with an automated merge rule
- defining one merge model for all repositories
