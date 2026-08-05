"use client";

import { useState } from "react";
import { Archive, Flag, Home, Pause, PiggyBank, Target, TrendingUp } from "lucide-react";
import type { FinancialGoal, GoalPlanningSnapshot, GoalPriority, GoalScenarioVariant, GoalType } from "@/lib/goalPlanning";

type GoalsApiResponse = {
  ok: boolean;
  error?: string;
  snapshot?: GoalPlanningSnapshot;
  goals?: FinancialGoal[];
  scenarios?: GoalScenarioVariant[];
};

const typeOptions: Array<{ value: GoalType; label: string }> = [
  { value: "EMERGENCY_FUND", label: "Emergency fund" },
  { value: "HOME_PURCHASE", label: "Home purchase" },
  { value: "DEBT_REPAYMENT", label: "Debt repayment" },
  { value: "RETIREMENT", label: "Retirement" },
  { value: "VEHICLE_PURCHASE", label: "Vehicle" },
  { value: "SAVINGS", label: "Savings" },
  { value: "CUSTOM", label: "Custom" },
];

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value || 0)).toLocaleString("en-AU")}`;
}

function dateLabel(value: string | null): string {
  if (!value) return "Not calculated yet";
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}

function forecastQualityLabel(value?: string): string {
  if (!value || value === "INSUFFICIENT") return "Needs confirmed data";
  return value.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function statusLabel(value: string): string {
  if (value === "INSUFFICIENT_DATA") return "Needs confirmed data";
  return value.replaceAll("_", " ");
}

function statusClass(value: string): string {
  if (value === "ON_TRACK" || value === "ACHIEVED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "AT_RISK" || value === "UNLIKELY") return "border-amber-200 bg-amber-50 text-amber-900";
  if (value === "INSUFFICIENT_DATA") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-950">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-500">{note}</div>
    </article>
  );
}

export default function GoalsPlanningClient({ initialSnapshot, initialGoals, initialScenarios }: { initialSnapshot: GoalPlanningSnapshot; initialGoals: FinancialGoal[]; initialScenarios: GoalScenarioVariant[] }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [, setGoals] = useState(initialGoals);
  const [, setScenarios] = useState(initialScenarios);
  const [type, setType] = useState<GoalType>("EMERGENCY_FUND");
  const [title, setTitle] = useState("Emergency fund");
  const [targetAmount, setTargetAmount] = useState(30000);
  const [currentAmount, setCurrentAmount] = useState(5000);
  const [targetDate, setTargetDate] = useState("2027-08-01");
  const [priority, setPriority] = useState<GoalPriority>("high");
  const [contributionAmount, setContributionAmount] = useState(1000);
  const [scenarioContribution, setScenarioContribution] = useState(1500);
  const [message, setMessage] = useState("Goals use confirmed records, the baseline forecast and explicit assumptions only.");
  const [busy, setBusy] = useState(false);
  const activeCount = snapshot.activeGoals.length;
  const atRiskCount = snapshot.activeGoals.filter((item) => item.goal.status === "AT_RISK").length;
  const earliestMilestone = snapshot.aiCfoContext.milestones[0] ?? null;
  const scenarioComparisons = snapshot.aiCfoContext.scenarioComparisons;

  async function mutate(payload: unknown, success: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as GoalsApiResponse;
      if (!response.ok || !data.snapshot || !data.goals || !data.scenarios) throw new Error(data.error ?? "Goal update failed");
      setSnapshot(data.snapshot);
      setGoals(data.goals);
      setScenarios(data.scenarios);
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Goal update failed");
    } finally {
      setBusy(false);
    }
  }

  function applyTemplate(next: GoalType) {
    setType(next);
    if (next === "EMERGENCY_FUND") { setTitle("Emergency fund"); setTargetAmount(30000); setCurrentAmount(5000); setContributionAmount(1000); }
    if (next === "HOME_PURCHASE") { setTitle("Home deposit"); setTargetAmount(260000); setCurrentAmount(80000); setContributionAmount(3500); }
    if (next === "DEBT_REPAYMENT") { setTitle("Debt payoff"); setTargetAmount(18000); setCurrentAmount(2500); setContributionAmount(900); }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          <Target className="h-3.5 w-3.5" />
          Goals & Scenario Planning v1
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">Goal planning</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Define a target, compare deterministic paths, and see the contribution, milestone and cash-flow implications before changing real commitments.
        </p>
        <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{message}</div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active goals" value={String(activeCount)} note="Archived goals are excluded from planning." />
        <Metric label="At-risk goals" value={String(atRiskCount)} note="Based on deterministic feasibility, not probability." />
        <Metric label="Next milestone" value={earliestMilestone ? dateLabel(earliestMilestone.date) : "None"} note={earliestMilestone?.title ?? "Create a goal to generate milestones."} />
        <Metric label="Forecast quality" value={forecastQualityLabel(snapshot.activeGoals[0]?.forecastQuality)} note="Inherited from the confirmed-record forecast." />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-950">Create goal</h2>
          </div>
          <div className="mt-4 grid gap-3">
            <div className="grid grid-cols-3 gap-2">
              {(["EMERGENCY_FUND", "HOME_PURCHASE", "DEBT_REPAYMENT"] as GoalType[]).map((item) => (
                <button key={item} type="button" onClick={() => applyTemplate(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                  {typeOptions.find((option) => option.value === item)?.label}
                </button>
              ))}
            </div>
            <label className="text-sm font-semibold text-slate-700">
              Goal type
              <select value={type} onChange={(event) => setType(event.target.value as GoalType)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3">
                {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Target amount<input aria-label="Target amount" type="number" value={targetAmount} onChange={(event) => setTargetAmount(Number(event.target.value))} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3" /></label>
              <label className="text-sm font-semibold text-slate-700">Current amount<input aria-label="Current amount" type="number" value={currentAmount} onChange={(event) => setCurrentAmount(Number(event.target.value))} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3" /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">Target date<input aria-label="Target date" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3" /></label>
              <label className="text-sm font-semibold text-slate-700">Monthly contribution<input aria-label="Monthly contribution" type="number" value={contributionAmount} onChange={(event) => setContributionAmount(Number(event.target.value))} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3" /></label>
            </div>
            <label className="text-sm font-semibold text-slate-700">
              Priority
              <select value={priority} onChange={(event) => setPriority(event.target.value as GoalPriority)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3">
                {["critical", "high", "medium", "low"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <button disabled={busy} onClick={() => void mutate({ action: "create-goal", goal: { type, title, targetAmount, currentAmount, targetDate, priority, contributionAmount } }, `${title} goal created.`)} className="rounded-lg bg-[#10243b] px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">
              Save goal
            </button>
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-950">Goal overview</h2>
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.activeGoals.map((evaluation) => (
              <div key={evaluation.goal.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{evaluation.goal.title}</div>
                    <div className="mt-1 text-sm text-slate-500">{evaluation.goal.type.replaceAll("_", " ")} - {evaluation.goal.priority}</div>
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(evaluation.goal.status)}`}>{statusLabel(evaluation.goal.status)}</div>
                </div>
                <div className="mt-4 h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(100, evaluation.currentProgress)}%` }} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <Metric label="Progress" value={`${Math.round(evaluation.currentProgress)}%`} note={`${money(evaluation.currentProgress / 100 * evaluation.goal.targetAmount)} funded`} />
                  <Metric label="Required monthly" value={money(evaluation.requiredMonthlyContribution)} note="Needed for the selected target date." />
                  <Metric label="Funding gap" value={money(evaluation.fundingGap)} note={`Projected completion ${dateLabel(evaluation.projectedCompletionDate)}`} />
                  <Metric label="Feasibility" value={evaluation.feasibility} note="Probability-free deterministic class." />
                </div>
                {evaluation.homePurchase && (
                  <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                    Indicative loan {money(evaluation.homePurchase.indicativeLoanAmount)}; indicative repayment {money(evaluation.homePurchase.indicativeMonthlyRepayment)} per month. This is not borrowing approval or credit advice.
                  </div>
                )}
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <button disabled={busy} onClick={() => void mutate({ action: "save-scenario", scenario: { goalId: evaluation.goal.id, name: "accelerated", contributionAmount: scenarioContribution } }, "Accelerated scenario compared.")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">
                    Compare accelerated
                  </button>
                  <button disabled={busy} onClick={() => void mutate({ action: "pause-goal", goalId: evaluation.goal.id }, "Goal paused.")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">
                    <Pause className="h-4 w-4" /> Pause goal
                  </button>
                  <button disabled={busy} onClick={() => void mutate({ action: "archive-goal", goalId: evaluation.goal.id }, "Goal archived.")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold">
                    <Archive className="h-4 w-4" /> Archive goal
                  </button>
                </div>
              </div>
            ))}
            {!snapshot.activeGoals.length && (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm leading-6 text-slate-600">
                No goals have been created yet. Add one target, such as an emergency fund or home deposit, to generate a deterministic contribution path and first milestone.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-950">Scenario comparison</h2>
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Accelerated monthly contribution
            <input aria-label="Accelerated monthly contribution" type="number" value={scenarioContribution} onChange={(event) => setScenarioContribution(Number(event.target.value))} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3" />
          </label>
          <div className="mt-4 space-y-3 text-sm">
            {scenarioComparisons.map((comparison) => (
              <div key={`${comparison.goalId}-${comparison.comparedScenarioId}`} className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-blue-900">
                Completion change: {comparison.projectedCompletionDeltaMonths == null ? "not comparable" : `${comparison.projectedCompletionDeltaMonths} months`}. Cash-flow change: {money(comparison.cashFlowDelta)}.
              </div>
            ))}
            {!scenarioComparisons.length && <div className="text-slate-500">Save a scenario variant to compare against the baseline. Vireon will show what changes and which assumptions were used.</div>}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Milestones</h2>
          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {snapshot.aiCfoContext.milestones.map((milestone) => (
              <div key={milestone.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="font-semibold text-slate-950">{milestone.title}</div>
                <div className="mt-1 text-slate-500">{dateLabel(milestone.date)} - {money(milestone.amount)}</div>
              </div>
            ))}
            {!snapshot.aiCfoContext.milestones.length && <div className="text-sm text-slate-500">Milestones appear once a goal has a contribution path.</div>}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Decision Centre actions</h2>
          <div className="mt-4 space-y-3">
            {snapshot.decisions.map((decision) => (
              <div key={decision.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6">
                <div className="font-semibold text-slate-950">{decision.title}</div>
                <div className="text-slate-600">{decision.nextAction}</div>
              </div>
            ))}
            {!snapshot.decisions.length && (
              <div className="text-sm leading-6 text-slate-500">
                No goal actions are ready yet. Add a goal and confirm income, spending and cash balances so Vireon can calculate a safe next step.
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Planning framework</h2>
          <ol className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            <li>1. Immediate cash shortfall</li>
            <li>2. Minimum debt obligations</li>
            <li>3. Emergency fund</li>
            <li>4. High-interest debt</li>
            <li>5. Contractual obligations</li>
            <li>6. Discretionary goals</li>
          </ol>
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This ordering is a deterministic safety framework. Priorities remain user-controlled.</div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-950">AI CFO goal context</h2>
          </div>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            {snapshot.aiCfoContext.activeGoals.map((goal) => (
              <li key={goal.id}>{goal.title}: {Math.round(goal.progress)}% funded, {goal.feasibility}, funding gap {money(goal.fundingGap)}.</li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">{snapshot.aiCfoContext.instruction}</div>
        </article>
      </section>

      <section className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Goal outcomes are projected and assumption-driven. Vireon does not guarantee achievement, borrowing approval, tax outcomes, investment returns or retirement results.
      </section>
    </main>
  );
}
