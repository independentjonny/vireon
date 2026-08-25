import { Activity, BadgeDollarSign, ChartPie, Landmark, ShieldCheck } from "lucide-react";
import type { FinancialHealthSnapshot } from "@/lib/financialHealthEngine";
import type { GoalPlanningSnapshot } from "@/lib/goalPlanning";

type Indicator = {
  label: string;
  value: string;
  assessment: string;
  tone: "positive" | "neutral" | "attention";
  icon: typeof Activity;
};

function rounded(value: number, suffix = "%"): string {
  return `${Math.round(value * 10) / 10}${suffix}`;
}

function assessmentClass(tone: Indicator["tone"]): string {
  if (tone === "positive") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "attention") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function buildFinancialHealthIndicators(health: FinancialHealthSnapshot, goals: GoalPlanningSnapshot): Indicator[] {
  const hasCashFlow = health.cashFlow.averageMonthlyIncome.value > 0 && health.cashFlow.averageMonthlySpending.value > 0;
  const savingsRate = health.cashFlow.savingsRate.value;
  const savingsAssessment = savingsRate >= 25 ? "Excellent" : savingsRate >= 15 ? "Good" : "Monitor";
  const hasDebtRatio = health.cashFlow.averageMonthlyIncome.value > 0 && health.debt.totalDebt.evidenceRecordIds.length > 0;
  const debtRatio = health.debt.debtToIncomeRatio.value;
  const debtAssessment = debtRatio <= 20 ? "Low" : debtRatio <= 35 ? "Good" : "Monitor";
  const hasEmergencyFund = health.safety.liquidity.evidenceRecordIds.length > 0 && health.cashFlow.averageMonthlySpending.value > 0;
  const emergencyMonths = health.safety.emergencyFundMonths.value;
  const emergencyAssessment = emergencyMonths >= 6 ? "Excellent" : emergencyMonths >= 3 ? "Good" : "Monitor";
  const invested = health.wealth.assetAllocation.filter((item) => /invest|share|etf|fund|managed/i.test(item.category));
  const investmentValue = invested.length >= 2 ? "Diversified" : invested.length === 1 ? "Concentrated" : "Needs data";
  const retirement = goals.activeGoals.find((item) => item.goal.type === "RETIREMENT");
  const hasRetirementTarget = Boolean(retirement && retirement.goal.targetAmount > 0);
  const retirementProgress = retirement?.currentProgress ?? 0;

  return [
    { label: "Savings rate", value: hasCashFlow ? rounded(savingsRate) : "Needs data", assessment: hasCashFlow ? savingsAssessment : "Needs data", tone: hasCashFlow && savingsRate >= 15 ? "positive" : hasCashFlow ? "attention" : "neutral", icon: BadgeDollarSign },
    { label: "Debt to income", value: hasDebtRatio ? rounded(debtRatio) : "Needs data", assessment: hasDebtRatio ? debtAssessment : "Needs data", tone: hasDebtRatio && debtRatio <= 35 ? "positive" : hasDebtRatio ? "attention" : "neutral", icon: Landmark },
    { label: "Emergency fund", value: hasEmergencyFund ? rounded(emergencyMonths, " months") : "Needs data", assessment: hasEmergencyFund ? emergencyAssessment : "Needs data", tone: hasEmergencyFund && emergencyMonths >= 3 ? "positive" : hasEmergencyFund ? "attention" : "neutral", icon: ShieldCheck },
    { label: "Investment allocation", value: investmentValue, assessment: invested.length >= 2 ? "Good" : invested.length === 1 ? "Monitor" : "Needs data", tone: invested.length >= 2 ? "positive" : invested.length === 1 ? "attention" : "neutral", icon: ChartPie },
    { label: "Retirement progress", value: hasRetirementTarget ? `${Math.round(retirementProgress)}% of target` : "Needs setup", assessment: hasRetirementTarget ? (retirementProgress >= 90 ? "Good" : "Monitor") : "Needs data", tone: hasRetirementTarget && retirementProgress >= 90 ? "positive" : hasRetirementTarget ? "attention" : "neutral", icon: Activity },
  ];
}

export default function FinancialHealthIndicatorsWidget({ health, goals }: { health: FinancialHealthSnapshot; goals: GoalPlanningSnapshot }) {
  const indicators = buildFinancialHealthIndicators(health, goals);

  return (
    <section data-testid="dashboard-financial-health-indicators" className="rounded-lg border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Financial Health Indicators</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">A concise check of the factors that most affect your resilience and ability to fund Integrated Goals.</p>
      </div>
      <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
        {indicators.map(({ label, value, assessment, tone, icon: Icon }) => (
          <div key={label} className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-4 py-3 sm:grid-cols-[1.2fr_0.8fr_auto]">
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
              <span className="text-sm font-semibold text-slate-800">{label}</span>
            </div>
            <div className="text-right text-sm font-semibold tabular-nums text-slate-950 sm:text-left">{value}</div>
            <span className={`hidden rounded-full border px-3 py-1 text-xs font-semibold sm:inline-flex ${assessmentClass(tone)}`}>{assessment}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Indicators use confirmed records and deterministic calculations. They are planning signals, not guarantees or financial advice.</p>
    </section>
  );
}
