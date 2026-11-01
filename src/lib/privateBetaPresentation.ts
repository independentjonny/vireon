import type { FinancialHealthSnapshot } from "@/lib/financialHealthEngine";
import type { ForecastSnapshot } from "@/lib/financialForecasting";
import type { GoalPlanningSnapshot } from "@/lib/goalPlanning";

export function buildPrivateBetaFirstValues(input: {
  health: FinancialHealthSnapshot;
  forecast: ForecastSnapshot;
  goals: GoalPlanningSnapshot;
}): Array<[string, string]> {
  const hasRecords = input.health.recordCount > 0;
  const final = input.forecast.quality.class !== "INSUFFICIENT" ? input.forecast.months.at(-1) : undefined;
  return [
    ["Health", input.health.healthRating],
    ["Net worth", hasRecords ? input.health.wealth.netWorth.label : "Not added"],
    ["Monthly surplus", hasRecords ? input.health.cashFlow.monthlySurplus.label : "Not available yet"],
    ["Emergency fund", hasRecords ? input.health.safety.emergencyFundMonths.label : "Not available yet"],
    ["12m cash forecast", hasRecords && final ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(final.cashBalance) : "Not calculated yet"],
    ["Top goal", input.goals.activeGoals[0]?.goal.title ?? "Create first goal"],
  ];
}
