import { describe, expect, it } from "vitest";

import {
  applyComposerRichDraftEdit,
  buildComposerRichDraftEdit,
  serializeComposerPromptForSubmission,
} from "./composerRichDraft";

describe("buildComposerRichDraftEdit", () => {
  it("wraps a selection in bold markdown", () => {
    const edit = buildComposerRichDraftEdit({
      text: "hello world",
      selectionStart: 6,
      selectionEnd: 11,
      format: "bold",
    });

    expect(applyComposerRichDraftEdit("hello world", edit)).toEqual({
      text: "hello **world**",
      cursor: 15,
    });
  });

  it("inserts a link scaffold at the cursor", () => {
    const edit = buildComposerRichDraftEdit({
      text: "see ",
      selectionStart: 4,
      selectionEnd: 4,
      format: "link",
    });

    expect(applyComposerRichDraftEdit("see ", edit)).toEqual({
      text: "see [link text](https://)",
      cursor: 24,
    });
  });

  it("prefixes selected lines as a bullet list", () => {
    const edit = buildComposerRichDraftEdit({
      text: "first\nsecond",
      selectionStart: 0,
      selectionEnd: 12,
      format: "bullet-list",
    });

    expect(applyComposerRichDraftEdit("first\nsecond", edit)).toEqual({
      text: "- first\n- second",
      cursor: 16,
    });
  });

  it("toggles list markers off when every line is already bulleted", () => {
    const edit = buildComposerRichDraftEdit({
      text: "- first\n- second",
      selectionStart: 0,
      selectionEnd: 16,
      format: "bullet-list",
    });

    expect(applyComposerRichDraftEdit("- first\n- second", edit)).toEqual({
      text: "first\nsecond",
      cursor: 12,
    });
  });

  it("uses fenced code blocks for multi-line selections", () => {
    const edit = buildComposerRichDraftEdit({
      text: "alpha\nbeta",
      selectionStart: 0,
      selectionEnd: 10,
      format: "code",
    });

    expect(applyComposerRichDraftEdit("alpha\nbeta", edit)).toEqual({
      text: "```\nalpha\nbeta\n```",
      cursor: 18,
    });
  });
});

describe("serializeComposerPromptForSubmission", () => {
  it("normalizes carriage returns into line feeds", () => {
    expect(serializeComposerPromptForSubmission("one\r\ntwo\rthree")).toBe("one\ntwo\nthree");
  });
});
