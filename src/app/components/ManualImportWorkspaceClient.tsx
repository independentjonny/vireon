"use client";

import { useEffect, useState } from "react";

type Ingestion = {
  id: string;
  originalFileName: string | null;
  sourceType: string;
  status: string;
  receivedAt: string;
  warnings: string[];
};

type Candidate = {
  id: string;
  ingestionId: string;
  field: string;
  value: unknown;
  confidence: number;
  status: string;
};

type ApiResponse<T = unknown> = {
  ok: boolean;
  error?: string;
  result?: T;
  ingestions?: Ingestion[];
  health?: FinancialHealth;
};

type HealthMetric = {
  value: number;
  label: string;
  confidence: "High" | "Medium" | "Low";
  evidenceRecordIds: string[];
};

type FinancialHealth = {
  engineVersion: string;
  healthScore: number;
  healthRating: string;
  recordCount: number;
  transactionCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  cashFlow: {
    averageMonthlyIncome: HealthMetric;
    averageMonthlySpending: HealthMetric;
    monthlySurplus: HealthMetric;
    savingsRate: HealthMetric;
    burnRate: HealthMetric;
  };
  spending: {
    largestCategories: Array<{ category: string; amount: number; share: number }>;
    subscriptions: Array<{ merchant: string; monthlyAmount: number; occurrences: number }>;
    spendingTrend: HealthMetric;
  };
  debt: {
    totalDebt: HealthMetric;
    debtToIncomeRatio: HealthMetric;
    estimatedMonthlyInterest: HealthMetric;
  };
  safety: {
    emergencyFundMonths: HealthMetric;
    liquidity: HealthMetric;
  };
  wealth: {
    netWorth: HealthMetric;
    superProportion: HealthMetric;
    debtRatio: HealthMetric;
  };
  actions: Array<{
    id: string;
    priority: "Critical" | "High" | "Medium" | "Low";
    category: string;
    title: string;
    reason: string;
    recommendedAction: string;
    expectedImpact: string;
    reviewRequired: boolean;
  }>;
  aiCfoBriefingFacts: string[];
  missingData: string[];
};

const sample =
  "Date,Description,Debit,Credit\n01/07/2026,Salary,,8450.00\n02/07/2026,Mortgage repayment,3860.00,";

const mapping = {
  Date: "date",
  Description: "description",
  Debit: "debit",
  Credit: "credit",
};

function asCandidates(value: unknown): Candidate[] {
  if (Array.isArray(value)) return value as Candidate[];
  if (value && typeof value === "object" && Array.isArray((value as { candidates?: unknown }).candidates)) {
    return (value as { candidates: Candidate[] }).candidates;
  }
  return [];
}

function money(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(value || 0)).toLocaleString("en-AU")}`;
}

function priorityClass(priority: string) {
  if (priority === "Critical") return "border-red-200 bg-red-50 text-red-800";
  if (priority === "High") return "border-amber-200 bg-amber-50 text-amber-800";
  if (priority === "Medium") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function HealthMetricCard({ label, metric }: { label: string; metric: HealthMetric }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-950">{metric.label}</div>
      <div className="mt-1 text-xs text-slate-500">{metric.confidence} confidence</div>
    </div>
  );
}

export default function ManualImportWorkspaceClient() {
  const [hydrated, setHydrated] = useState(false);
  const [imports, setImports] = useState<Ingestion[]>([]);
  const [health, setHealth] = useState<FinancialHealth | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [text, setText] = useState(sample);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Balances are not live. Import data must be reviewed and confirmed.");
  const hasConfirmableCandidate = candidates.some((candidate) => candidate.status !== "REJECTED");

  async function api<T = unknown>(body?: Record<string, unknown>) {
    const response = await fetch(
      "/api/financial-vault/imports",
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : undefined,
    );
    const value = (await response.json()) as ApiResponse<T>;
    if (!response.ok) throw new Error(value.error ?? "Request failed");
    return value;
  }

  async function refresh() {
    const value = await api();
    setImports(value.ingestions ?? []);
    setHealth(value.health ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    const hydrationTimer = window.setTimeout(() => {
      if (!cancelled) setHydrated(true);
    }, 0);
    fetch("/api/financial-vault/imports")
      .then((response) => response.json() as Promise<ApiResponse>)
      .then((value) => {
        if (!cancelled) {
          setImports(value.ingestions ?? []);
          setHealth(value.health ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setMessage("Could not load saved imports.");
      });
    return () => {
      cancelled = true;
      window.clearTimeout(hydrationTimer);
    };
  }, []);

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      const created = (
        await api<Ingestion>({
          action: "create-import",
          sourceType: "CSV",
          fileName: "manual-bank-import.csv",
          mimeType: "text/csv",
          text,
        })
      ).result;
      if (!created) throw new Error("Import was not created.");

      await api({ action: "preview-csv", ingestionId: created.id, text, mapping });
      const stagedResponse = await api<Candidate[]>({ action: "stage-csv", ingestionId: created.id, mapping });
      const staged = asCandidates(stagedResponse.result);
      if (staged.length === 0) throw new Error("No reviewable transactions were staged from this CSV.");

      await refresh();
      setSelected(created.id);
      setCandidates(staged);
      setMessage(`${staged.length} transaction(s) staged. Nothing has been written to the Vault.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function review(candidate: Candidate, action: "accept" | "reject") {
    const ingestionId = candidate.ingestionId || selected;
    if (!ingestionId) return;
    setSelected(ingestionId);
    setBusy(true);
    try {
      await api({
        action: "review",
        ingestionId,
        actions: [{ candidateId: candidate.id, action }],
      });
      setCandidates((items) =>
        items.map((item) => (item.id === candidate.id ? { ...item, status: action === "accept" ? "CONFIRMED" : "REJECTED" } : item)),
      );
      setMessage("Review saved. Confirm the import to create canonical transactions.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!selected || !hasConfirmableCandidate) return;
    setBusy(true);
    try {
      const pendingAcceptances = candidates
        .filter((candidate) => candidate.status === "UNREVIEWED")
        .map((candidate) => ({ candidateId: candidate.id, action: "accept" as const }));
      if (pendingAcceptances.length > 0) {
        await api({
          action: "review",
          ingestionId: selected,
          actions: pendingAcceptances,
        });
        setCandidates((items) => items.map((item) => (item.status === "UNREVIEWED" ? { ...item, status: "CONFIRMED" } : item)));
      }
      const value = await api<unknown[]>({ action: "confirm", ingestionId: selected });
      setMessage(`${value.result?.length ?? 0} canonical transaction(s) created with provenance.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Confirmation failed");
    } finally {
      setBusy(false);
    }
  }

  async function rollback() {
    if (!selected) return;
    setBusy(true);
    try {
      await api({ action: "rollback", ingestionId: selected });
      setCandidates([]);
      setSelected(null);
      setMessage("Unconfirmed import rolled back and archived.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rollback failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="text-xs font-semibold uppercase text-blue-700">Manual financial data</div>
        <h1 className="mt-2 text-3xl font-semibold">Import review workspace</h1>
        <p className="mt-2 text-sm text-slate-600">Preview and confirm imported records before they become Financial Vault facts.</p>
        <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{message}</div>
      </header>

      {health && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase text-emerald-700">Financial Health Engine v1</div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">{health.healthRating}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Deterministic health score {health.healthScore}/100 from {health.recordCount} confirmed record{health.recordCount === 1 ? "" : "s"} and {health.transactionCount} transaction{health.transactionCount === 1 ? "" : "s"}.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {health.periodStart && health.periodEnd ? `${health.periodStart} to ${health.periodEnd}` : "No confirmed transaction period yet"}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <HealthMetricCard label="Income" metric={health.cashFlow.averageMonthlyIncome} />
            <HealthMetricCard label="Spending" metric={health.cashFlow.averageMonthlySpending} />
            <HealthMetricCard label="Surplus" metric={health.cashFlow.monthlySurplus} />
            <HealthMetricCard label="Savings Rate" metric={health.cashFlow.savingsRate} />
            <HealthMetricCard label="Emergency Fund" metric={health.safety.emergencyFundMonths} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h3 className="text-sm font-semibold uppercase text-slate-500">Deterministic actions</h3>
              <div className="mt-3 space-y-3">
                {health.actions.slice(0, 5).map((action) => (
                  <article key={action.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-slate-950">{action.title}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{action.reason}</p>
                        <p className="mt-2 text-sm font-semibold text-slate-800">{action.recommendedAction}</p>
                      </div>
                      <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${priorityClass(action.priority)}`}>
                        {action.priority}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{action.expectedImpact}{action.reviewRequired ? " - review before acting" : ""}</div>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase text-slate-500">What changed into AI CFO context</h3>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <ul className="space-y-2 text-sm leading-6 text-slate-700">
                  {health.aiCfoBriefingFacts.slice(0, 6).map((fact) => (
                    <li key={fact}>{fact}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">Debt</div>
                  <div className="mt-1 font-semibold text-slate-950">{health.debt.totalDebt.label}</div>
                  <div className="text-xs text-slate-500">Interest {health.debt.estimatedMonthlyInterest.label}</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">Wealth</div>
                  <div className="mt-1 font-semibold text-slate-950">{health.wealth.netWorth.label}</div>
                  <div className="text-xs text-slate-500">Debt ratio {health.wealth.debtRatio.label}</div>
                </div>
              </div>
              {health.spending.largestCategories.length > 0 && (
                <div className="mt-4 rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">Largest categories</div>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    {health.spending.largestCategories.slice(0, 4).map((item) => (
                      <div key={item.category} className="flex justify-between gap-3">
                        <span>{item.category}</span>
                        <span className="font-semibold">{money(item.amount)} - {item.share}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">CSV preview</h2>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="mt-4 h-52 w-full rounded-lg border border-slate-200 p-3 font-mono text-xs"
            aria-label="CSV content"
          />
          <button
            onClick={() => void create()}
            disabled={!hydrated || busy}
            className="mt-3 rounded bg-[#10243b] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Preview and map CSV
          </button>

          <h3 className="mt-6 font-semibold">Saved imports</h3>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {imports.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item.id)}
                className="block w-full rounded-lg border border-slate-200 p-3 text-left"
              >
                <div className="font-semibold">{item.originalFileName}</div>
                <div className="text-xs text-slate-500">
                  {item.sourceType} - {item.status}
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Review transactions</h2>
          <div className="mt-4 space-y-3">
            {candidates.map((candidate) => (
              <div key={candidate.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex justify-between">
                  <span className="font-semibold">{candidate.field}</span>
                  <span className="text-xs text-slate-500">{candidate.status}</span>
                </div>
                <pre className="mt-3 overflow-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(candidate.value, null, 2)}</pre>
                <div className="mt-3 flex gap-2">
                  <button
                    onMouseDown={() => void review(candidate, "accept")}
                    disabled={busy}
                    className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Accept
                  </button>
                  <button
                    onMouseDown={() => void review(candidate, "reject")}
                    disabled={busy}
                    className="rounded border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>

          {candidates.length > 0 && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => void confirm()}
                disabled={busy || !hasConfirmableCandidate}
                className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Confirm import
              </button>
              <button
                onClick={() => void rollback()}
                disabled={busy}
                className="rounded border border-slate-200 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Rollback
              </button>
            </div>
          )}
        </article>
      </section>
    </>
  );
}
