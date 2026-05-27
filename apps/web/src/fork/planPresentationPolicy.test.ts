import { describe, expect, it } from "vitest";

import { derivePlanProgressPresentation } from "./planPresentationPolicy";

describe("derivePlanProgressPresentation", () => {
  it("shows the in-progress step number", () => {
    expect(
      derivePlanProgressPresentation([
        { status: "completed" },
        { status: "completed" },
        { status: "inProgress" },
        { status: "pending" },
        { status: "pending" },
      ]),
    ).toEqual({
      completedAllSteps: false,
      currentStepNumber: 3,
      totalSteps: 5,
      label: "3/5",
      pulse: true,
    });
  });

  it("shows completed progress when all steps are complete", () => {
    expect(
      derivePlanProgressPresentation([{ status: "completed" }, { status: "completed" }]),
    ).toEqual({
      completedAllSteps: true,
      currentStepNumber: 2,
      totalSteps: 2,
      label: "2/2",
      pulse: false,
    });
  });

  it("shows the first step when all steps are pending", () => {
    expect(
      derivePlanProgressPresentation([{ status: "pending" }, { status: "pending" }]),
    ).toMatchObject({
      completedAllSteps: false,
      currentStepNumber: 1,
      totalSteps: 2,
      label: "1/2",
    });
  });

  it("returns null for empty plans", () => {
    expect(derivePlanProgressPresentation([])).toBeNull();
  });

  it("uses the first in-progress step when multiple are present", () => {
    expect(
      derivePlanProgressPresentation([
        { status: "completed" },
        { status: "inProgress" },
        { status: "inProgress" },
        { status: "pending" },
      ]),
    ).toMatchObject({
      currentStepNumber: 2,
      totalSteps: 4,
      label: "2/4",
    });
  });
});
