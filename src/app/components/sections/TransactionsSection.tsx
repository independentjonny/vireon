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
  Income: "text-emerald-400",
  Groceries: "text-sky-300",
  Subscription: "text-violet-400",
  Dining: "text-orange-400",
  Transport: "text-amber-400",
  Utilities: "text-cyan-400",
  Health: "text-red-400",
  Entertainment: "text-pink-400",
  Shopping: "text-yellow-400",
  Savings: "text-teal-400",
  Investment: "text-blue-400",
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
      {/* Summary row */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Income", value: `+$${summary.income.toLocaleString()}`, color: "text-emerald-400", bg: "border-emerald-400/20 bg-emerald-400/[0.06]" },
            { label: "Spend", value: `-$${summary.spend.toLocaleString()}`, color: "text-red-400", bg: "border-red-400/20 bg-red-400/[0.06]" },
            { label: "Net", value: `$${summary.net.toLocaleString()}`, color: summary.net >= 0 ? "text-emerald-400" : "text-red-400", bg: "border-white/[0.07] bg-white/[0.03]" },
            { label: "Transactions", value: String(summary.transactionCount), color: "text-white/80", bg: "border-white/[0.07] bg-white/[0.03]" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border px-4 py-4 ${s.bg}`}>
              <div className="text-xs font-medium text-white/55">{s.label}</div>
              <div className={`mt-2 text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction list */}
      <div className="rounded-2xl border border-white/[0.1] bg-white/[0.045] p-4 shadow-xl shadow-black/20 sm:p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-base font-semibold text-white">
              Recent transactions
            </div>
            <p className="mt-1 text-sm text-white/55">
              Review imported activity, recurring charges, and cash-flow changes.
            </p>
            {data?.dataSource && (
              <span className="mt-2 inline-flex rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/45">
                {data.dataSource}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleRemoveAll}
              disabled={txs.length === 0 || removingAll}
            >
              {removingAll ? "Removing..." : "Remove All Transactions"}
            </button>
            <button
              type="button"
              className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-400/20 transition"
              onClick={() => setShowImport((v) => !v)}
            >
              {showImport ? "Hide Import" : "Import CSV"}
            </button>
          </div>
        </div>

        {statusMsg && <div className="mb-3 text-xs text-emerald-300">{statusMsg}</div>}

        {txs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.14] bg-black/10 px-4 py-8 text-center">
            <div className="text-base font-semibold text-white">No transactions imported yet</div>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
              Import a CSV to populate cash flow, recurring detection, and subscription insights.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {txs.slice(0, 12).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3.5 transition hover:bg-white/[0.055]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="truncate text-base font-semibold text-white/88">{tx.merchant}</span>
                      {tx.recurring && (
                        <span className="shrink-0 rounded-full border border-violet-300/30 bg-violet-300/[0.12] px-2 py-0.5 text-xs font-semibold text-violet-200">
                          recurring
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/48 mt-1">
                      {tx.category} · {tx.date}
                    </div>
                  </div>
                </div>
                <div className={`ml-4 shrink-0 text-right text-lg font-bold tabular-nums ${tx.amount >= 0 ? "text-emerald-300" : CATEGORY_COLORS[tx.category] ?? "text-white/82"}`}>
                  {tx.amount >= 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import workflow */}
      {showImport && <ImportWorkflow />}
    </div>
  );
}
