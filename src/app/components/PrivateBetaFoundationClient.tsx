"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, Flag, MessageSquareWarning, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import type { BetaOnboardingState, DeterministicBriefing, FreshnessResult, PrivateBetaReadinessReport, ProvenanceView } from "@/lib/privateBetaFoundation";
import type { FinancialHealthSnapshot } from "@/lib/financialHealthEngine";
import type { ForecastSnapshot } from "@/lib/financialForecasting";
import type { GoalPlanningSnapshot } from "@/lib/goalPlanning";
import { FINANCIAL_DATA_RESET_CONFIRMATION, totalFinancialDataDeleted, type FinancialDataResetResult } from "@/lib/financialDataReset";

type Props = {
  initialOnboarding: BetaOnboardingState;
  readiness: PrivateBetaReadinessReport;
  briefing: DeterministicBriefing;
  health: FinancialHealthSnapshot;
  forecast: ForecastSnapshot;
  goals: GoalPlanningSnapshot;
  provenance: ProvenanceView[];
};

const stepLabels: Record<string, string> = {
  welcome: "Welcome",
  household: "Household",
  income: "Income",
  "property-housing": "Property",
  "accounts-cash": "Cash",
  debts: "Debts",
  "super-investments": "Super",
  "recurring-expenses": "Expenses",
  "first-goal": "Goal",
  "csv-import": "CSV import",
  "review-confirmed": "Review",
  "first-results": "Results",
};

const stepGuidance: Record<string, { why: string; unlocks: string; minutes: string }> = {
  welcome: {
    why: "Confirms the beta safety boundaries before any financial data is used.",
    unlocks: "Guided setup and private-beta controls.",
    minutes: "1 min",
  },
  household: {
    why: "Sets the household context used by affordability, goals and cash-flow projections.",
    unlocks: "Household-aware forecasts.",
    minutes: "2 min",
  },
  income: {
    why: "Income is the main input for surplus, borrowing capacity and goal timing.",
    unlocks: "Health score and cash-flow estimates.",
    minutes: "3 min",
  },
  "property-housing": {
    why: "Property and housing details drive mortgage, equity and affordability modelling.",
    unlocks: "Housing scenarios and refinance checks.",
    minutes: "3 min",
  },
  "accounts-cash": {
    why: "Cash balances determine emergency runway and near-term resilience.",
    unlocks: "Runway and net-worth inputs.",
    minutes: "2 min",
  },
  debts: {
    why: "Debt balances and repayments shape risk, borrowing and payoff decisions.",
    unlocks: "Debt actions and safer borrowing ranges.",
    minutes: "3 min",
  },
  "super-investments": {
    why: "Long-term assets complete the wealth picture without changing deterministic rules.",
    unlocks: "Net-worth and retirement context.",
    minutes: "2 min",
  },
  "recurring-expenses": {
    why: "Recurring spending determines true monthly surplus.",
    unlocks: "Cash-flow confidence and savings opportunities.",
    minutes: "3 min",
  },
  "first-goal": {
    why: "A goal gives Vireon something practical to optimise toward.",
    unlocks: "Milestones and contribution paths.",
    minutes: "2 min",
  },
  "csv-import": {
    why: "A transaction import helps verify spending patterns without Open Banking.",
    unlocks: "Spending summaries and recurring expense checks.",
    minutes: "4 min",
  },
  "review-confirmed": {
    why: "Only reviewed data should drive private-beta recommendations.",
    unlocks: "Higher confidence calculations.",
    minutes: "3 min",
  },
  "first-results": {
    why: "Shows the first deterministic insight once enough information is confirmed.",
    unlocks: "Dashboard, Daily Review and goal planning.",
    minutes: "1 min",
  },
};

function tone(status: string) {
  if (status === "READY" || status === "complete" || status === "CURRENT") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "BLOCKED" || status === "STALE") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function money(value: number) {
  return `$${Math.round(value).toLocaleString("en-AU")}`;
}

function privateBetaMutationHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.NEXT_PUBLIC_VIREON_DEV_AUTH_BYPASS === "true" && process.env.NODE_ENV !== "production") {
    headers.Authorization = "Bearer __vireon_local_dev_proxy_session__";
  }
  return headers;
}

export default function PrivateBetaFoundationClient({ initialOnboarding, readiness, briefing, health, forecast, goals, provenance }: Props) {
  const router = useRouter();
  const [onboarding, setOnboarding] = useState(initialOnboarding);
  const [feedbackStatus, setFeedbackStatus] = useState("Not submitted");
  const [exportStatus, setExportStatus] = useState("No export requested");
  const [deletionStatus, setDeletionStatus] = useState("No financial-data reset performed");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetResult, setResetResult] = useState<FinancialDataResetResult | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const completeCount = Object.values(onboarding.steps).filter((status) => status === "complete" || status === "skipped").length;
  const progress = Math.round((completeCount / Object.keys(onboarding.steps).length) * 100);
  const stale = briefing.dataFreshness.filter((item) => item.class === "STALE");
  const topForecast = forecast.months.at(-1);
  const topGoal = goals.activeGoals[0];
  const firstRisk = forecast.decisions[0] ?? health.actions[0];
  const readinessCritical = readiness.checklist.filter((item) => item.critical && item.status === "BLOCKED");

  const firstValue = useMemo(() => [
    ["Health", health.healthRating],
    ["Net worth", health.wealth.netWorth.label],
    ["Monthly surplus", health.cashFlow.monthlySurplus.label],
    ["Emergency fund", health.safety.emergencyFundMonths.label],
    ["12m cash forecast", topForecast ? money(topForecast.cashBalance) : "Not calculated yet"],
    ["Top goal", topGoal?.goal.title ?? "Create first goal"],
  ], [health, topForecast, topGoal]);

  async function updateStep(step: string, status: "complete" | "skipped") {
    setBusy(true);
    setOnboardingStatus(null);
    try {
      const response = await fetch("/api/private-beta/onboarding", { method: "POST", headers: privateBetaMutationHeaders(), body: JSON.stringify({ step, status, consent: { betaTermsAccepted: true, financialDataStorage: true } }) });
      const data = await response.json();
      if (response.ok && data.ok) {
        setOnboarding(data.onboarding);
        const label = stepLabels[step] ?? step;
        const guidance = stepGuidance[step];
        setOnboardingStatus(
          status === "complete"
            ? `${label} saved. ${guidance ? `This unlocks ${guidance.unlocks.toLowerCase()}.` : "Your progress is saved."}`
            : `${label} skipped for now. You can return when the information is ready.`
        );
      } else {
        setOnboardingStatus(`Onboarding update failed ${data.referenceId ?? data.error ?? ""}`.trim());
      }
    } catch {
      setOnboardingStatus("Onboarding update failed offline.");
    } finally {
      setBusy(false);
    }
  }

  async function submitFeedback() {
    setBusy(true);
    setFeedbackStatus("Submitting feedback");
    try {
      const response = await fetch("/api/private-beta/feedback", { method: "POST", headers: privateBetaMutationHeaders(), body: JSON.stringify({ type: "confusing-result", page: "/beta-onboarding", feature: "first-value-summary", description: "This beta test feedback excludes financial context by default." }) });
      const data = await response.json();
      setFeedbackStatus(data.ok ? `Submitted ${data.feedback.diagnosticReference}` : `Feedback failed ${data.referenceId ?? ""}`.trim());
    } catch {
      setFeedbackStatus("Feedback failed offline");
    } finally {
      setBusy(false);
    }
  }

  async function resetFinancialData() {
    setBusy(true);
    setDeletionStatus("Deleting financial data");
    try {
      const response = await fetch("/api/private-beta/financial-data-reset", { method: "POST", headers: privateBetaMutationHeaders(), body: JSON.stringify({ confirmation: resetConfirmation }) });
      const data = await response.json();
      if (!data.ok) {
        setDeletionStatus(data.error ?? "Financial-data reset failed. No data was deleted.");
        return;
      }
      const result = data.result as FinancialDataResetResult;
      window.sessionStorage.removeItem("vireon-add-financial-data-draft-v1");
      window.localStorage.removeItem("vireon-ai-decision-status-v1");
      setResetResult(result);
      setResetOpen(false);
      setResetConfirmation("");
      setDeletionStatus(`${totalFinancialDataDeleted(result).toLocaleString("en-AU")} financial records deleted.`);
      router.refresh();
    } catch {
      setDeletionStatus("Financial-data reset failed offline. No data was deleted.");
    } finally {
      setBusy(false);
    }
  }

  async function requestExport() {
    setBusy(true);
    setExportStatus("Requesting export");
    try {
      const response = await fetch("/api/private-beta/export", { method: "POST", headers: privateBetaMutationHeaders() });
      const data = await response.json();
      setExportStatus(data.ok ? `Export requested ${data.export.id}` : `Export request failed ${data.referenceId ?? data.code ?? ""}`.trim());
    } catch {
      setExportStatus("Export request failed offline");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.045)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Private beta foundation
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-slate-950">Set up Vireon safely</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Complete the highest-impact Vault sections first. Most beta users can reach their first deterministic insight in about 15 minutes. Live AI and Open Banking are disabled.
            </p>
          </div>
          <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${readiness.deploymentBlocked ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {readiness.deploymentBlocked ? "Beta blocked" : "Beta controls ready"}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Guided onboarding</h2>
            <span className="text-sm font-semibold text-blue-700">{progress}%</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Estimated time: 15 minutes for the core path. Each completed section unlocks more reliable forecasts and fewer assumptions.
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Onboarding progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div className="h-full bg-blue-600" style={{ width: `${progress}%` }} />
          </div>
          {progress === 100 ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              Setup complete. Your Dashboard can now use reviewed Vault data for deterministic insights.
            </div>
          ) : null}
          <div className="mt-4 grid gap-2">
            {onboardingStatus && (
              <div aria-live="polite" className={`rounded-lg border px-3 py-2 text-sm font-semibold ${onboardingStatus.includes("failed") ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                {onboardingStatus}
              </div>
            )}
            {Object.entries(onboarding.steps).map(([step, status]) => {
              const guidance = stepGuidance[step];
              return (
              <div key={step} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className={`h-2.5 w-2.5 rounded-full ${status === "complete" ? "bg-emerald-500" : status === "skipped" ? "bg-amber-500" : "bg-slate-300"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-950">{stepLabels[step] ?? step}</div>
                  <div className="text-xs text-slate-500">{status.replace("-", " ")}{guidance ? ` - ${guidance.minutes}` : ""}</div>
                  {guidance ? (
                    <div className="mt-1 text-xs leading-5 text-slate-600">
                      {guidance.why} Unlocks: {guidance.unlocks}
                    </div>
                  ) : null}
                </div>
                {!busy && status === "not-started" ? (
                  <div className="flex gap-2">
                    <button onClick={() => updateStep(step, "complete")} className="rounded-md bg-[#10243b] px-3 py-1.5 text-xs font-semibold text-white">Save</button>
                    <button onClick={() => updateStep(step, "skipped")} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Skip</button>
                  </div>
                ) : null}
              </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">First-value summary</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {firstValue.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-500">{label}</div>
                <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="font-semibold">Top deterministic risk</div>
            <div className="mt-1">{firstRisk?.title ?? "Complete the Financial Vault"}</div>
          </div>
          <div className="mt-4 grid gap-2">
            {health.actions.slice(0, 3).map((action) => (
              <div key={action.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <div className="font-semibold text-slate-950">{action.title}</div>
                <div className="mt-1 text-xs text-slate-600">{action.recommendedAction}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {briefing.sections.slice(1, 7).map((section) => (
          <article key={section.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-950">{section.title}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{section.body}</p>
            <div className="mt-3 text-xs text-slate-500">Sources: {section.sourceRecordIds.length || "none"}; warnings: {section.warnings.length || "none"}</div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Why am I seeing this?</h2>
          <div className="mt-4 grid gap-3">
            {provenance.slice(0, 6).map((item) => (
              <details key={item.valueId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-950">{item.label}: {item.value}</summary>
                <div className="mt-3 grid gap-1 text-xs leading-5 text-slate-600">
                  <span>Source: {item.sourceType}</span>
                  <span>Calculation: {item.calculation}</span>
                  <span>Version: {item.calculationVersion}</span>
                  <span>Confirmed status: {item.confirmedStatus}</span>
                  <span>Records: {item.sourceRecordIds.length || "none"}</span>
                </div>
              </details>
            ))}
          </div>
        </article>

        <article id="financial-data-controls" className="scroll-mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Freshness and controls</h2>
          <div className="mt-4 grid gap-2">
            {(stale.length ? stale : briefing.dataFreshness.slice(0, 5)).map((item: FreshnessResult) => (
              <div key={item.recordId} className={`rounded-lg border px-3 py-2 text-sm ${tone(item.class)}`}>
                <div className="font-semibold">{item.label}</div>
                <div className="mt-1 text-xs">{item.reason} Next: {item.refreshAction}.</div>
              </div>
            ))}
            {briefing.dataFreshness.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                No confirmed records are available yet. Complete Household, Income and Cash first to unlock your first health score and forecast.
              </div>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button onClick={requestExport} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"><Download className="h-4 w-4" /> Export</button>
            <button onClick={submitFeedback} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><MessageSquareWarning className="h-4 w-4" /> Feedback</button>
            <button onClick={() => setResetOpen(true)} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 disabled:text-red-300"><Trash2 className="h-4 w-4" /> Delete financial data</button>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-slate-500">
            <span>{exportStatus}</span>
            <span>{feedbackStatus}</span>
            <span>{deletionStatus}</span>
          </div>
          {resetResult && (
            <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Financial-data reset completed</div>
              <p className="mt-2 leading-6">Deleted {totalFinancialDataDeleted(resetResult).toLocaleString("en-AU")} financial records. Your account, personal details, authentication, onboarding, preferences and security audit history were retained.</p>
              <Link href="/" className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-[#10243b] px-4 font-semibold text-white">View empty Dashboard</Link>
            </div>
          )}
        </article>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-950">
          <Flag className="h-5 w-5 text-blue-600" />
          Private-beta readiness checklist
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {readiness.checklist.map((item) => (
            <article key={item.category} className={`rounded-lg border p-4 ${tone(item.status)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold capitalize">{item.category}</div>
                {item.status === "READY" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              </div>
              <p className="mt-2 text-xs leading-5">{item.detail}</p>
            </article>
          ))}
        </div>
        {readinessCritical.length > 0 ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Critical blockers: {readinessCritical.map((item) => item.category).join(", ")}
          </div>
        ) : null}
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <RefreshCw className="mr-2 inline h-4 w-4" />
          Open Banking: {readiness.openBankingState}. Live AI: {readiness.liveAiState}. Persistence backend: {readiness.persistenceBackend}.
        </div>
      </section>

      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="financial-reset-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-50 p-2 text-red-700"><Trash2 className="h-5 w-5" /></div>
              <div>
                <h2 id="financial-reset-title" className="text-xl font-semibold text-slate-950">Delete financial data now?</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">This is immediate and cannot be undone. It affects only your authenticated Vireon user.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="text-sm font-semibold text-red-900">Will be permanently deleted</div>
                <ul className="mt-2 space-y-1 text-sm leading-5 text-red-800">
                  <li>Financial records and history</li>
                  <li>Financial documents and evidence</li>
                  <li>Transactions and subscriptions</li>
                  <li>Calculations, reviews and scenarios</li>
                  <li>Financial goals, decisions and workflows</li>
                </ul>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm font-semibold text-emerald-900">Will be retained</div>
                <ul className="mt-2 space-y-1 text-sm leading-5 text-emerald-800">
                  <li>Your Vireon account</li>
                  <li>Email, name and authentication</li>
                  <li>Access and onboarding</li>
                  <li>Non-financial preferences</li>
                  <li>Feedback and security audit history</li>
                </ul>
              </div>
            </div>

            <label htmlFor="financial-reset-confirmation" className="mt-5 block text-sm font-semibold text-slate-800">Type <span className="font-mono text-red-700">{FINANCIAL_DATA_RESET_CONFIRMATION}</span> to confirm</label>
            <input
              id="financial-reset-confirmation"
              value={resetConfirmation}
              onChange={(event) => setResetConfirmation(event.target.value)}
              autoComplete="off"
              className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => { setResetOpen(false); setResetConfirmation(""); }} disabled={busy} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">Cancel</button>
              <button type="button" onClick={resetFinancialData} disabled={busy || resetConfirmation !== FINANCIAL_DATA_RESET_CONFIRMATION} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-red-200"><Trash2 className="h-4 w-4" /> {busy ? "Deleting financial data…" : "Delete financial data now"}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
