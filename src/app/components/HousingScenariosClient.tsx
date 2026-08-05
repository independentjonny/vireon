"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  CheckCircle2,
  Home,
  Loader2,
  PiggyBank,
  Scale,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import type {
  HousingAffordabilityState,
  HousingScenario,
  HousingScenarioInput,
  PurchaseState,
} from "@/lib/housingAffordabilityTypes";

const states: PurchaseState[] = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const disclaimer = "Estimates are indicative only and do not constitute financial, credit, tax, legal, or lending advice.";

function money(value: number, compact = false) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value || 0);
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function outcomeLabel(value: string) {
  return value.replace("_", " ");
}

function riskClass(value: string) {
  if (value === "critical") return "border-red-100 bg-red-50 text-red-700";
  if (value === "high") return "border-orange-100 bg-orange-50 text-orange-700";
  if (value === "medium") return "border-amber-100 bg-amber-50 text-amber-700";
  return "border-emerald-100 bg-emerald-50 text-emerald-700";
}

function ScoreBar({ label, value, tone = "bg-blue-600" }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-semibold tabular-nums text-slate-950">{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function Meter({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-3 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-[#10243b]" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-950">{note}</div>
    </div>
  );
}

function ScenarioComparison({ scenarios }: { scenarios: HousingScenario[] }) {
  const labels = ["Scenario A", "Scenario B", "Scenario C", "Scenario D"];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
      <div className="mb-5 flex items-center gap-3">
        <BarChart3 className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-slate-950">Scenario comparison</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-4">
        {scenarios.slice(0, 4).map((scenario, index) => (
          <article key={scenario.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">{labels[index] ?? "Scenario"}</div>
                <div className="mt-2 text-xl font-semibold text-slate-950">{money(scenario.propertyPrice)}</div>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${riskClass(scenario.riskLevel)}`}>
                {scenario.riskLevel}
              </span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><span className="text-slate-500">Repayment</span><span className="font-semibold text-slate-950">{money(scenario.estimatedMonthlyRepayment)}/mo</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Cash-flow</span><span className={scenario.monthlySurplusAfter >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{money(scenario.monthlySurplusAfter)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Borrowing gap</span><span className="font-semibold text-slate-950">{money(scenario.borrowingGap)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Savings required</span><span className="font-semibold text-slate-950">{money(scenario.savingsRequired)}</span></div>
            </div>
            <div className="mt-4">
              <ScoreBar label="Affordability" value={scenario.affordabilityScore} tone={scenario.affordabilityScore >= 70 ? "bg-emerald-500" : scenario.affordabilityScore >= 50 ? "bg-amber-500" : "bg-red-500"} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function downloadReport(html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vireon-home-purchase-report-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HousingScenariosClient({
  initialHousing,
  openAiAvailable,
}: {
  initialHousing: HousingAffordabilityState;
  openAiAvailable: boolean;
}) {
  const [housing, setHousing] = useState(initialHousing);
  const [busy, setBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<HousingScenarioInput>({
    propertyPrice: 1300000,
    deposit: 250000,
    purchaseState: "NSW",
    estimatedInterestRate: 6.24,
    loanTermYears: 30,
    stampDutyOverride: null,
    expectedRentalIncome: 0,
    partnerIncome: 0,
    futureSalaryIncrease: 0,
  });

  const primary = housing.housing_scenarios[0];
  const primaryObstacles = primary ? housing.housing_obstacles.filter((item) => item.scenarioId === primary.id) : [];
  const coach = primary ? housing.housing_ai_analysis.find((item) => item.scenarioId === primary.id) : null;

  const cashflowRows = useMemo(() => {
    if (!primary) return [];
    const currentCore = primary.monthlySurplusBefore + primary.estimatedMonthlyRepayment;
    return [
      ["Current monthly position", primary.monthlySurplusBefore, currentCore],
      ["After purchase", primary.monthlySurplusAfter, primary.estimatedMonthlyRepayment],
    ] as const;
  }, [primary]);

  function updateNumber(key: keyof HousingScenarioInput, value: string) {
    setForm((current) => ({ ...current, [key]: value === "" ? 0 : Number(value) }));
  }

  async function analyse() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/housing-scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "Unable to analyse affordability.");
      setHousing(data.housing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyse affordability.");
    } finally {
      setBusy(false);
    }
  }

  async function generateReport() {
    if (!primary) return;
    setReportBusy(true);
    try {
      const response = await fetch("/api/housing-scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-report", scenarioId: primary.id }),
      });
      const data = await response.json();
      if (response.ok && data.housing) setHousing(data.housing);
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Home className="h-3.5 w-3.5" />
            Home Affordability Intelligence
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">Housing Scenarios</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Ask whether a property fits your current Financial Profile Vault. Vireon models borrowing power, cash-flow impact, obstacles, and next actions.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_34px_rgba(15,23,42,0.035)]">
          <div className="text-xs font-semibold uppercase text-slate-500">House readiness</div>
          <div className="mt-1 text-3xl font-semibold text-slate-950">{housing.house_readiness_score.score}</div>
          <div className="mt-1 text-sm font-semibold text-blue-700">{housing.house_readiness_score.band}</div>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
          <h2 className="text-lg font-semibold text-slate-950">Can I afford this home?</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">Property price<input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950" type="number" value={form.propertyPrice} onChange={(e) => updateNumber("propertyPrice", e.target.value)} /></label>
            <label className="text-sm font-semibold text-slate-700">Deposit available<input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950" type="number" value={form.deposit} onChange={(e) => updateNumber("deposit", e.target.value)} /></label>
            <label className="text-sm font-semibold text-slate-700">Purchase state<select className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950" value={form.purchaseState} onChange={(e) => setForm((current) => ({ ...current, purchaseState: e.target.value as PurchaseState }))}>{states.map((state) => <option key={state}>{state}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">Interest rate<input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950" type="number" step="0.01" value={form.estimatedInterestRate} onChange={(e) => updateNumber("estimatedInterestRate", e.target.value)} /></label>
            <label className="text-sm font-semibold text-slate-700">Loan term years<input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950" type="number" value={form.loanTermYears} onChange={(e) => updateNumber("loanTermYears", e.target.value)} /></label>
            <label className="text-sm font-semibold text-slate-700">Stamp duty override<input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950" type="number" value={form.stampDutyOverride ?? ""} onChange={(e) => setForm((current) => ({ ...current, stampDutyOverride: e.target.value === "" ? null : Number(e.target.value) }))} /></label>
            <label className="text-sm font-semibold text-slate-700">Expected rental income<input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950" type="number" value={form.expectedRentalIncome} onChange={(e) => updateNumber("expectedRentalIncome", e.target.value)} /></label>
            <label className="text-sm font-semibold text-slate-700">Partner income<input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950" type="number" value={form.partnerIncome} onChange={(e) => updateNumber("partnerIncome", e.target.value)} /></label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Future salary increase<input className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-slate-950" type="number" value={form.futureSalaryIncrease} onChange={(e) => updateNumber("futureSalaryIncrease", e.target.value)} /></label>
          </div>
          {error && <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <button onClick={analyse} disabled={busy} className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#10243b] px-5 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Analyse Affordability
          </button>
        </article>

        {primary && (
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{money(primary.propertyPrice)} affordability result</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{coach?.executiveSummary ?? "Run analysis to generate the coach summary."}</p>
              </div>
              <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${riskClass(primary.riskLevel)}`}>{outcomeLabel(primary.outcome)}</span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Meter label="Borrowing capacity gauge" value={Math.min(100, (primary.estimatedBorrowingCapacity / Math.max(primary.estimatedLoanAmount, 1)) * 100)} note={`${money(primary.estimatedBorrowingCapacity)} capacity`} />
              <Meter label="Affordability score" value={primary.affordabilityScore} note={`${primary.affordabilityScore}/100`} />
              <Meter label="Debt-to-income meter" value={Math.min(100, primary.debtToIncomeRatio * 16)} note={`${primary.debtToIncomeRatio}x gross income`} />
              <Meter label="Savings progress" value={Math.min(100, (primary.deposit / Math.max(primary.totalPurchaseCost, 1)) * 100)} note={`${money(primary.deposit)} deposit`} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ["Loan amount", money(primary.estimatedLoanAmount)],
                ["Monthly repayment", `${money(primary.estimatedMonthlyRepayment)}/mo`],
                ["Repayment-to-income", percent(primary.repaymentToIncomeRatio)],
                ["Serviceability buffer", money(primary.serviceabilityBuffer)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
                  <div className="mt-2 text-xl font-semibold text-slate-950">{value}</div>
                </div>
              ))}
            </div>
          </article>
        )}
      </section>

      {primary && (
        <>
          <ScenarioComparison scenarios={housing.housing_scenarios} />

          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
              <div className="mb-5 flex items-center gap-3">
                <Scale className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-950">Monthly cash-flow impact</h2>
              </div>
              <div className="space-y-4">
                {cashflowRows.map(([label, surplus, housingCost]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <div className="font-semibold text-slate-950">{label}</div>
                      <div className={surplus >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>{money(surplus)} remaining</div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-white p-3 text-sm"><span className="block text-xs text-slate-500">Core expenses</span>{money(Math.max(0, primary.monthlySurplusBefore + primary.estimatedMonthlyRepayment - surplus))}</div>
                      <div className="rounded-lg bg-white p-3 text-sm"><span className="block text-xs text-slate-500">Housing cost</span>{money(housingCost)}</div>
                      <div className="rounded-lg bg-white p-3 text-sm"><span className="block text-xs text-slate-500">Risk zone</span>{surplus < 0 ? "Deficit" : surplus < 1000 ? "Tight" : "Buffer"}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-900">
                You would have approximately {money(primary.monthlySurplusAfter)} remaining each month after core expenses.
              </p>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
              <div className="mb-5 flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-orange-600" />
                <h2 className="text-lg font-semibold text-slate-950">Risk summary and obstacles</h2>
              </div>
              <div className="space-y-3">
                {primaryObstacles.map((obstacle) => (
                  <div key={`${obstacle.category}-${obstacle.description}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{obstacle.category}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{obstacle.description}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${riskClass(obstacle.severity)}`}>{obstacle.severity}</span>
                    </div>
                    <div className="mt-3 text-xs font-semibold text-blue-700">{obstacle.recommendedAction}</div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
            <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
              <div className="mb-5 flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold text-slate-950">Action plan generator</h2>
              </div>
              <div className="space-y-3">
                {housing.housing_action_plans.map((action) => (
                  <div key={`${action.priority}-${action.action}`} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[80px_1fr_auto] sm:items-start">
                    <div className="text-sm font-semibold text-blue-700">Priority {action.priority}</div>
                    <div>
                      <div className="font-semibold text-slate-950">{action.action}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{action.estimatedImpact}</p>
                    </div>
                    <div className="text-sm text-slate-500">{action.timeframe}</div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <PiggyBank className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-slate-950">House readiness score</h2>
                </div>
                <span className="text-2xl font-semibold text-slate-950">{housing.house_readiness_score.score}</span>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800">{housing.house_readiness_score.band}</div>
              <div className="mt-5 space-y-4">
                {housing.house_readiness_score.components.map((component) => (
                  <div key={component.label}>
                    <ScoreBar label={component.label} value={component.score} tone="bg-blue-600" />
                    <p className="mt-1 text-xs leading-5 text-slate-500">{component.explanation}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
              <h2 className="text-lg font-semibold text-slate-950">GPT financial coach</h2>
              <div className="mt-2 text-sm text-slate-500">{openAiAvailable ? "OpenAI key detected. If the model call fails, Vireon falls back deterministically." : "OpenAI unavailable. Deterministic summary is active."}</div>
              {coach && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{coach.executiveSummary}</div>
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Recommendations</div>
                    <ul className="space-y-2 text-sm text-slate-700">
                      {coach.recommendations.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Home purchase report</h2>
                  <p className="mt-1 text-sm text-slate-500">HTML report now. PDF export can be added later.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={generateReport} disabled={reportBusy} className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900">
                    {reportBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Generate Home Purchase Report
                  </button>
                  {housing.purchase_readiness_report && (
                    <button onClick={() => downloadReport(housing.purchase_readiness_report?.html ?? "")} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#10243b] px-5 text-sm font-semibold text-white">
                      <ArrowDownToLine className="h-4 w-4" />
                      HTML
                    </button>
                  )}
                </div>
              </div>
              {housing.purchase_readiness_report && (
                <pre className="mt-5 max-h-[360px] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-5 text-xs leading-5 text-slate-100">
                  {JSON.stringify(housing.purchase_readiness_report.json, null, 2)}
                </pre>
              )}
            </article>
          </section>
        </>
      )}

      <section className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{disclaimer} Vireon does not claim approval, guaranteed borrowing power, or guaranteed affordability.</span>
        </div>
      </section>
    </div>
  );
}
