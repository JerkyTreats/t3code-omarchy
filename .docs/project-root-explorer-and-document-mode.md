# Project Root Explorer and Document Mode

Recreated in `.docs` from the authoritative plan captured in the thread after the original root file was no longer present on disk.

## Summary

Add a new right side panel type named `files` that provides a standard project explorer tree rooted at `project.cwd`.

The explorer is not a standalone feature. It becomes part of a broader document browsing mode for the chat screen:

- Header explorer toggle opens the `files` panel in the right side slot
- The right side slot stays exclusive across `files`, `diff`, and `git`
- Selecting a file in the explorer opens that file in the document view
- When the document view is expanded, the main thread content area shows the file preview and the right side panel swaps to the explorer tree
- When the document view is collapsed, the right side panel swaps back to the selected file preview and the main thread content returns to the normal message timeline
- Thread header and composer stay in place throughout
- Chrome styling uses the same subtle radial and linear gradient language already used by the markdown render surface

## Authoritative Defaults

- Root the explorer at `project.cwd`
- Do not switch the explorer root to a worktree path
- Use one exclusive right side panel slot across `files`, `diff`, and `git`
- Add a new header toggle for `files`
- Selecting a file from the explorer enters expanded document mode immediately
- Collapsing expanded document mode returns to half preview mode, not explorer only mode
- Keep thread header and composer visible while document mode is active
- Do not add explorer search in this slice
- Do not render deleted file ghosts in the explorer
- Keep git styling subtle and subordinate to the document chrome

## Route Model

Use one unified chat panel route model:

- `panel?: "diff" | "git" | "files"`
- `diffTurnId?: TurnId`
- `diffFilePath?: string`
- `diffView?: "preview" | "diff"`
- `docPath?: string`
- `docExpanded?: "1"`

State rules:

- `panel=files`, no `docPath`
  - right side shows explorer only
  - main area stays on timeline
- `panel=files`, `docPath`, no `docExpanded`
  - right side shows selected file preview
  - main area stays on timeline
- `panel=files`, `docPath`, `docExpanded=1`
  - main area shows selected file preview
  - right side shows explorer

## Backend Seams

Add two workspace RPCs:

- `projects.listDirectory`
  - returns direct children for a project relative directory
- `projects.readFile`
  - returns live workspace file preview data using the same union shape as checkpoint preview

Also extend git status file entries with:

- `status`
  - `modified`
  - `added`
  - `deleted`
  - `renamed`
  - `untracked`
  - `conflicted`

## Shared Chrome

Use shared document chrome for:

- side preview
- expanded document mode
- explorer side panel next to expanded content

Chrome classes:

- `document-chrome-shell`
- `document-chrome-shell--explorer`
- `document-viewport`

Keep the same subtle gradient and shadow language as the markdown render surface.

## Explorer Tree

Behavior:

- fetch root children when the files panel opens
- lazily fetch direct children when a directory expands
- cache child lists by project id and directory path
- auto expand ancestors of the selected file
- support keyboard navigation with arrow keys, enter, and space
- use `VscodeEntryIcon` for files
- use lucide folder icons for directories
- show a subtle git status pip only for changed paths

Directory git priority:

1. conflicted
2. modified
3. added
4. renamed
5. untracked
6. clean

## Preview Surface

Split preview loading from preview rendering:

- `FilePreviewSurface`
  - pure renderer for loaded preview data
- `CheckpointFilePreviewSurface`
  - checkpoint loader wrapper
- `ProjectFilePreviewSurface`
  - live workspace loader wrapper

Markdown uses `DocumentMarkdownRenderer`.

Non markdown text uses `SourceFilePreview`.

Images, binary, missing, and too large states reuse the current preview behavior.

## Header And Mode Transitions

- Add a files toggle beside terminal and diff
- Opening files closes diff and git
- Opening diff or git clears files mode state
- Selecting a file from the explorer sets `panel=files`, `docPath`, and `docExpanded=1`
- Collapsing expanded document mode clears only `docExpanded`
- Closing the files panel clears `panel`, `docPath`, and `docExpanded`

## Verification

Before completion:

- `bun fmt`
- `bun lint`
- `bun typecheck`
