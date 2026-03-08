# Compatibility Policy

Date: 2026-03-07
Status: active

## Intent

This repository prioritizes clarity, performance, and reliability over broad backward compatibility.

## Rules

- Backward incompatible changes are allowed when they improve correctness, ownership, or operational predictability.
- Any backward incompatible change must be called out to the user before commit.
- Compatibility impact must be explicit for these surfaces:
- desktop IPC contracts
- WebSocket protocol contracts
- persisted browser state
- server side state and attachment storage
- user visible workflow behavior
- Commit messages must reflect severity through conventional commit rules.
- Use `type!:` or `type(scope)!:` for breaking changes.
- Add a `BREAKING CHANGE:` footer with a concise migration note.

## Migration Bias

- Prefer additive transitions when the old and new paths can coexist cheaply.
- Prefer direct replacement when a compatibility layer would add material complexity or failure risk.
- When removing an old path, document the migration impact in the commit and any related release notes.
