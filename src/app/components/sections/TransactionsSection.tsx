"use client";

import { useEffect, useState } from "react";
import ImportWorkflow from "../ImportWorkflow";

type Transaction = {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  date: string;
  recurring?: boolean;
  tags?: string[];
};

type TransactionsData = {
  ok: boolean;
  dataSource: string;
  transactions: Transaction[];
  summary: {
    income: number;
    spend: number;
    net: number;
    transactionCount: number;
  };
};

const CATEGORY_COLORS: Record<string, string> = {
  Income: "text-emerald-600",
  Groceries: "text-blue-600",
  Subscription: "text-purple-600",
  Dining: "text-orange-600",
  Transport: "text-amber-600",
  Utilities: "text-cyan-600",
  Health: "text-red-600",
  Entertainment: "text-pink-600",
  Shopping: "text-yellow-700",
  Savings: "text-teal-600",
  Investment: "text-blue-600",
};

export default function TransactionsSection() {
  const [data, setData] = useState<TransactionsData | null>(null);
  const [showImport, setShowImport] = useState(true);
  const [removingAll, setRemovingAll] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  function refresh() {
    fetch("/api/transactions")
      .then((r) => r.json())
      .then(setData)
      .catch(() => null);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleRemoveAll() {
    if (txs.length === 0 || removingAll) return;
    if (!window.confirm(`Remove all ${txs.length} transaction(s)?`)) return;

    setRemovingAll(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/transactions", { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        setStatusMsg(json.message ?? "Removed all transactions.");
        refresh();
      } else {
        setStatusMsg("Failed to remove transactions");
      }
    } catch {
      setStatusMsg("Failed to remove transactions");
    }
    setRemovingAll(false);
  }

  const txs = data?.transactions ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Income", value: `+$${summary.income.toLocaleString()}`, color: "text-emerald-600", bg: "border-emerald-100 bg-emerald-50" },
            { label: "Spend", value: `-$${summary.spend.toLocaleString()}`, color: "text-red-600", bg: "border-red-100 bg-red-50" },
            { label: "Net", value: `$${summary.net.toLocaleString()}`, color: summary.net >= 0 ? "text-emerald-600" : "text-red-600", bg: "border-slate-200 bg-white" },
            { label: "Transactions", value: String(summary.transactionCount), color: "text-slate-950", bg: "border-slate-200 bg-white" },
          ].map((s) => (
            <div key={s.label} className={`rounded-lg border px-4 py-4 ${s.bg}`}>
              <div className="text-xs font-medium text-slate-500">{s.label}</div>
              <div className={`mt-2 text-2xl font-semibold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-base font-semibold text-slate-950">Recent transactions</div>
            <p className="mt-1 text-sm text-slate-500">
              Review imported activity, recurring charges, and cash-flow changes.
            </p>
            {data?.dataSource && (
              <span className="mt-2 inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
                {data.dataSource}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleRemoveAll}
              disabled={txs.length === 0 || removingAll}
            >
              {removingAll ? "Removing..." : "Remove All Transactions"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              onClick={() => setShowImport((v) => !v)}
            >
              {showImport ? "Hide Import" : "Import CSV"}
            </button>
          </div>
        </div>

        {statusMsg && <div className="mb-3 text-xs text-emerald-700">{statusMsg}</div>}

        {txs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <div className="text-base font-semibold text-slate-950">No transactions imported yet</div>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Import a CSV to populate cash flow, recurring detection, and subscription insights.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {txs.slice(0, 12).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-base font-semibold text-slate-950">{tx.merchant}</span>
                    {tx.recurring && (
                      <span className="shrink-0 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                        recurring
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {tx.category} - {tx.date}
                  </div>
                </div>
                <div className={`ml-4 shrink-0 text-right text-lg font-semibold tabular-nums ${tx.amount >= 0 ? "text-emerald-600" : CATEGORY_COLORS[tx.category] ?? "text-slate-950"}`}>
                  {tx.amount >= 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showImport && <ImportWorkflow />}
    </div>
  );
}
