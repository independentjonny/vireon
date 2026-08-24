"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, GitCompare, RotateCcw, TrendingUp, WalletCards } from "lucide-react";
import type { ForecastComparison, ForecastEvent, ForecastScenarioDelta, ForecastSnapshot } from "@/lib/financialForecasting";

type ApiScenarioResponse = {
  ok: boolean;
  error?: string;
  snapshot?: ForecastSnapshot;
  comparison?: ForecastComparison;
};

function money(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value || 0)).toLocaleString("en-AU")}`;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}

function qualityClass(value: string): string {
  if (value === "HIGH") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "MODERATE") return "border-blue-200 bg-blue-50 text-blue-800";
  if (value === "LOW") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "risk" }) {
  const toneClass = tone === "good" ? "text-emerald-700" : tone === "risk" ? "text-red-700" : "text-slate-950";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function MiniBars({ snapshot, field }: { snapshot: ForecastSnapshot; field: "cashBalance" | "netWorth" | "debtBalance" | "surplus" }) {
  const values = snapshot.months.map((month) => month[field]);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-28 items-end gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {snapshot.months.map((month) => {
        const value = month[field];
        const height = ((value - min) / Math.max(1, max - min)) * 88 + 8;
        return <div key={`${field}-${month.month}`} title={`${month.month}: ${money(value)}`} className={`min-w-2 flex-1 rounded-t ${value < 0 ? "bg-red-500" : "bg-blue-600"}`} style={{ height }} />;
      })}
    </div>
  );
}

function EventRow({ event }: { event: ForecastEvent }) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[100px_1fr_auto] sm:items-center">
      <div className="text-sm font-semibold text-slate-950">{dateLabel(event.date)}</div>
      <div>
        <div className="font-semibold text-slate-950">{event.title}</div>
        <div className="mt-1 text-xs text-slate-500">{event.type.replaceAll("-", " ")} - {event.certainty} - {event.source}</div>
      </div>
      <div className={`text-sm font-semibold ${event.amount < 0 ? "text-red-700" : "text-slate-900"}`}>{money(event.amount)}</div>
    </div>
  );
}

export default function ForecastTimelineClient({ initialBaseline, embedded = false }: { initialBaseline: ForecastSnapshot; embedded?: boolean }) {
  const [baseline] = useState(initialBaseline);
  const [scenario, setScenario] = useState<ForecastSnapshot | null>(null);
  const [comparison, setComparison] = useState<ForecastComparison | null>(null);
  const [extraRepayment, setExtraRepayment] = useState(400);
  const [oneOffExpense, setOneOffExpense] = useState(5000);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Baseline forecast uses confirmed records and explicit assumptions only.");
  const final = baseline.months.at(-1) ?? baseline.months[0];
  const selected = scenario ?? baseline;
  const riskEvents = useMemo(() => selected.events.filter((event) => event.type === "cash-shortfall" || event.type === "emergency-fund-threshold").slice(0, 10), [selected]);

  useEffect(() => {
    void Promise.resolve().then(() => setReady(true));
  }, []);

  async function runScenario(deltas: ForecastScenarioDelta[], name: string) {
    setBusy(true);
    setMessage(`${name} scenario is calculating...`);
    try {
      const response = await fetch("/api/financial-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: { name, deltas } }),
      });
      const data = (await response.json()) as ApiScenarioResponse;
      if (!response.ok || !data.snapshot || !data.comparison) throw new Error(data.error ?? "Scenario failed");
      setScenario(data.snapshot);
      setComparison(data.comparison);
      setMessage(`${name} scenario calculated without mutating confirmed records.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Scenario failed");
    } finally {
      setBusy(false);
    }
  }

  const Wrapper = embedded ? "section" : "main";
  return (
    <Wrapper className="mx-auto max-w-7xl space-y-6">
      {!embedded && <header className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          <CalendarClock className="h-3.5 w-3.5" />
          Financial Timeline & Forecasting v1
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-slate-950">Forward financial timeline</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Vireon projects cash, debt and net worth from confirmed Financial Vault records and explicit assumptions. These are estimates, not guarantees or regulated advice.
        </p>
        <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{message}</div>
      </header>}

      {embedded && <header className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-xs text-slate-500">Forecast Timeline</div><div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-medium text-[#10243b]">How this decision changes your future</h2><p className="mt-1 text-sm text-slate-600">Compare the selected Digital Twin scenario with your confirmed baseline.</p></div><div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{message}</div></div></header>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Projected cash" value={money(final.cashBalance)} tone={final.cashBalance < 0 ? "risk" : "good"} />
        <Metric label="Projected debt" value={money(final.debtBalance)} />
        <Metric label="Projected net worth" value={money(final.netWorth)} tone="good" />
        <Metric label="Monthly surplus" value={money(final.surplus)} tone={final.surplus < 0 ? "risk" : "good"} />
        <div className={`rounded-lg border p-4 ${qualityClass(baseline.quality.class)}`}>
          <div className="text-xs font-semibold uppercase">Forecast quality</div>
          <div className="mt-2 text-xl font-semibold">{baseline.quality.class}</div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-950">Scenario manager</h2>
          </div>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Extra mortgage repayment
              <input type="number" value={extraRepayment} onChange={(event) => setExtraRepayment(Number(event.target.value))} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3" />
            </label>
            <button disabled={busy || !ready} onClick={() => void runScenario([{ kind: "increase-mortgage-repayment", amount: extraRepayment }], "Extra repayment")} className="w-full rounded-lg bg-[#10243b] px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">
              Compare extra repayment
            </button>
            <label className="block text-sm font-semibold text-slate-700">
              One-off expense in month 2
              <input type="number" value={oneOffExpense} onChange={(event) => setOneOffExpense(Number(event.target.value))} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3" />
            </label>
            <button disabled={busy || !ready} onClick={() => void runScenario([{ kind: "add-one-off-expense", amount: oneOffExpense, startMonth: 1 }], "One-off expense")} className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 disabled:text-slate-400">
              Compare one-off expense
            </button>
            <button disabled={!ready} onClick={() => { setScenario(null); setComparison(null); setMessage("Scenario reset to baseline."); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:text-slate-400">
              <RotateCcw className="h-4 w-4" />
              Reset scenario
            </button>
          </div>
          {comparison && (
            <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
              <div className="font-semibold">{comparison.scenarioName}</div>
              <div>Cash change: {money(comparison.projectedCashDelta)}</div>
              <div>Debt change: {money(comparison.projectedDebtDelta)}</div>
              <div>Interest change: {money(comparison.interestDelta)}</div>
              <div>Risk: {comparison.risk}</div>
            </div>
          )}
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Forecast charts</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div><div className="mb-2 text-xs font-semibold uppercase text-slate-500">Cash balance</div><MiniBars snapshot={selected} field="cashBalance" /></div>
            <div><div className="mb-2 text-xs font-semibold uppercase text-slate-500">Net worth</div><MiniBars snapshot={selected} field="netWorth" /></div>
            <div><div className="mb-2 text-xs font-semibold uppercase text-slate-500">Debt balance</div><MiniBars snapshot={selected} field="debtBalance" /></div>
            <div><div className="mb-2 text-xs font-semibold uppercase text-slate-500">Monthly surplus</div><MiniBars snapshot={selected} field="surplus" /></div>
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Upcoming events</h2>
          <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {selected.events.slice(0, 28).map((event) => <EventRow key={event.id} event={event} />)}
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-950">Risks and actions</h2>
          </div>
          <div className="mt-4 space-y-3">
            {selected.decisions.map((decision) => (
              <div key={decision.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-950">{decision.title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{decision.trigger}</div>
                <div className="mt-2 text-sm font-semibold text-slate-800">{decision.recommendedNextAction}</div>
              </div>
            ))}
            {riskEvents.map((event) => <EventRow key={`risk-${event.id}`} event={event} />)}
            {baseline.quality.warnings.map((warning) => (
              <div key={warning} className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">{warning}</div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <WalletCards className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-950">Current position</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric label="Opening cash" value={money(baseline.input.openingBalances.cash)} />
            <Metric label="Opening property" value={money(baseline.input.openingBalances.property)} />
            <Metric label="Opening super" value={money(baseline.input.openingBalances.super)} />
            <Metric label="Opening debt" value={money(baseline.input.openingBalances.mortgages + baseline.input.openingBalances.loans + baseline.input.openingBalances.creditCards)} />
          </div>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-950">AI CFO forecast context</h2>
          </div>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            {selected.aiCfoContext.baselineFacts.map((fact) => <li key={fact}>{fact}</li>)}
          </ul>
          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
            AI CFO may explain these forecast facts but cannot change deterministic values, hide low-quality assumptions, or present projections as guarantees.
          </div>
        </article>
      </section>

      <section className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Forecasts are projected and assumption-driven. They are not guaranteed returns, tax outcomes, approved borrowing, guaranteed refinancing or personal regulated financial advice.
      </section>
    </Wrapper>
  );
}
