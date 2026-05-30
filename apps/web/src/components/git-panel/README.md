# Git Panel

## Purpose

This folder keeps the Git panel split by boundary so the container stays shallow and each workflow has one clear home.

## Structure

- `GitPanel.tsx`
  - Container and composition shell
- `Git*Section.tsx`
  - Section rendering only
- `Git*Dialog.tsx`
  - Dialog UI and local form state
- `useGitPanel*.ts`
  - Workflow hooks for routing, merge, workspace, stacked actions, and GitHub actions
- `*.logic.ts`
  - Pure derivation helpers

## Placement Rules

- New view only pieces belong in section or primitive files.
- New imperative flows belong in hooks.
- New labels, guards, and summaries belong in logic files.
- Avoid pushing workflow code back into `GitPanel.tsx`.
