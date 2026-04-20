import { describe, expect, it } from "vitest";
import { ProjectId } from "@t3tools/contracts";

import type { Project, Thread } from "~/types";
import type { DraftThreadState } from "~/composerDraftStore";
import { resolveFilesPanelProject } from "./resolveFilesPanelProject";

function project(id: string): Project {
  return {
    id: ProjectId.makeUnsafe(id),
    name: id,
    cwd: `/workspace/${id}`,
    defaultModelSelection: null,
    scripts: [],
  };
}

describe("resolveFilesPanelProject", () => {
  it("uses the server thread project when available", () => {
    const serverProject = project("server");
    const draftProject = project("draft");

    expect(
      resolveFilesPanelProject({
        activeThread: { projectId: serverProject.id } satisfies Pick<Thread, "projectId">,
        activeDraftThread: {
          projectId: draftProject.id,
        } satisfies Pick<DraftThreadState, "projectId">,
        projects: [draftProject, serverProject],
      }),
    ).toBe(serverProject);
  });

  it("falls back to the draft thread project for new threads", () => {
    const draftProject = project("draft");

    expect(
      resolveFilesPanelProject({
        activeThread: null,
        activeDraftThread: {
          projectId: draftProject.id,
        } satisfies Pick<DraftThreadState, "projectId">,
        projects: [draftProject],
      }),
    ).toBe(draftProject);
  });

  it("returns null without a matching thread project", () => {
    expect(
      resolveFilesPanelProject({
        activeThread: null,
        activeDraftThread: null,
        projects: [project("other")],
      }),
    ).toBeNull();
  });
});
