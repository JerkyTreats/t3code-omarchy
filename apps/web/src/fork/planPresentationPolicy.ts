export type PlanStepStatus = "pending" | "inProgress" | "completed";

export interface PlanProgressPresentation {
  completedAllSteps: boolean;
  currentStepNumber: number;
  totalSteps: number;
  label: `${number}/${number}`;
  pulse: boolean;
}

export function derivePlanProgressPresentation(
  steps: ReadonlyArray<{
    status: PlanStepStatus;
  }>,
): PlanProgressPresentation | null {
  const totalSteps = steps.length;
  if (totalSteps === 0) {
    return null;
  }

  const completedCount = steps.filter((step) => step.status === "completed").length;
  const inProgressIndex = steps.findIndex((step) => step.status === "inProgress");
  const completedAllSteps = completedCount >= totalSteps;
  const currentStepNumber = completedAllSteps
    ? totalSteps
    : inProgressIndex >= 0
      ? inProgressIndex + 1
      : Math.min(completedCount + 1, totalSteps);

  return {
    completedAllSteps,
    currentStepNumber,
    totalSteps,
    label: `${currentStepNumber}/${totalSteps}`,
    pulse: !completedAllSteps,
  };
}
