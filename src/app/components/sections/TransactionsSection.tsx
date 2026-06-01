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
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    fetch("/api/transactions")
      .then((r) => r.json())
      .then(setData)
      .catch(() => null);
  }, []);

  const txs = data?.transactions ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Income", value: `+$${summary.income.toLocaleString()}`, color: "text-emerald-400", bg: "border-emerald-400/20 bg-emerald-400/[0.06]" },
            { label: "Spend", value: `-$${summary.spend.toLocaleString()}`, color: "text-red-400", bg: "border-red-400/20 bg-red-400/[0.06]" },
            { label: "Net", value: `$${summary.net.toLocaleString()}`, color: summary.net >= 0 ? "text-emerald-400" : "text-red-400", bg: "border-white/[0.07] bg-white/[0.03]" },
            { label: "Transactions", value: String(summary.transactionCount), color: "text-white/80", bg: "border-white/[0.07] bg-white/[0.03]" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.bg}`}>
              <div className="text-[10px] text-white/35 uppercase tracking-wide">{s.label}</div>
              <div className={`mt-1 text-lg font-bold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction list */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/40">
            Recent Transactions
            {data?.dataSource && (
              <span className="ml-2 rounded px-1.5 py-0.5 text-[9px] bg-white/5 text-white/25 border border-white/10">
                {data.dataSource}
              </span>
            )}
          </div>
          <button
            className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-400/20 transition"
            onClick={() => setShowImport((v) => !v)}
          >
            {showImport ? "Hide Import" : "Import CSV"}
          </button>
        </div>

        {txs.length === 0 ? (
          <p className="text-sm text-white/35 text-center py-6">No transactions yet. Import a CSV to get started.</p>
        ) : (
          <div className="space-y-1">
            {txs.slice(0, 12).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-white/[0.04]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm text-white/80 truncate">{tx.merchant}</span>
                      {tx.recurring && (
                        <span className="rounded px-1 py-0.5 text-[9px] font-semibold bg-violet-400/10 text-violet-400 border border-violet-400/20 shrink-0">
                          recurring
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/30 mt-0.5">
                      {tx.category} · {tx.date}
                    </div>
                  </div>
                </div>
                <div className={`tabular-nums text-sm font-semibold shrink-0 ml-4 ${tx.amount >= 0 ? "text-emerald-400" : CATEGORY_COLORS[tx.category] ?? "text-white/70"}`}>
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
