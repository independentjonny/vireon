import type { GoalEvaluation } from "./goalPlanning";
import type { TrajectorySettings } from "./wealthTrajectory";

// A missing target must never look like a zero-dollar funding gap.
export function hasGoalEstimate(evaluation: GoalEvaluation): boolean {
  return (
    evaluation.feasibility !== "INSUFFICIENT_DATA" &&
    evaluation.goal.targetAmount > 0 &&
    Boolean(evaluation.goal.targetDate) &&
    [
      evaluation.requiredMonthlyContribution,
      evaluation.fundingGap,
      evaluation.currentProgress,
    ].every(Number.isFinite)
  );
}

export function retirementDisplayTitle(
  settings: TrajectorySettings | null,
): string {
  return settings
    ? `Retirement at ${settings.retirementAge}`
    : "Retirement · set your retirement age";
}
