"use client";

import { useEffect, useState } from "react";

type Subscription = {
  id?: string;
  merchant: string;
  amount: number;
  cadence: "monthly" | "quarterly" | "annual";
  risk?: "low" | "medium" | "high";
  nextRenewalDate?: string;
  savingsOpportunity?: number;
  active?: boolean;
};

type SubscriptionsData = {
  ok: boolean;
  dataSource: string;
  storageMode: string;
  subscriptions: Subscription[];
  monthlySpend: number;
  annualisedSpend: number;
  optimisationCount: number;
};

const RISK_STYLES: Record<string, string> = {
  high: "bg-red-400/10 text-red-400 border-red-400/20",
  medium: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  low: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
};

const CADENCE_LABEL: Record<string, string> = {
  monthly: "mo",
  quarterly: "qtr",
  annual: "yr",
};

export default function SubscriptionsSection() {
  const [data, setData] = useState<SubscriptionsData | null>(null);
  const [addForm, setAddForm] = useState(false);
  const [form, setForm] = useState({ merchant: "", amount: "", cadence: "monthly" as "monthly" | "quarterly" | "annual" });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  function refresh() {
    fetch("/api/subscriptions")
      .then((r) => r.json())
      .then(setData)
      .catch(() => null);
  }

  useEffect(() => { refresh(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.merchant || !form.amount) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant: form.merchant, amount: parseFloat(form.amount), cadence: form.cadence }),
      });
      const json = await res.json();
      if (json.ok) {
        setSaveMsg(`Added ${form.merchant}`);
        setForm({ merchant: "", amount: "", cadence: "monthly" });
        setAddForm(false);
        refresh();
      }
    } catch {
      setSaveMsg("Failed to save");
    }
    setSaving(false);
  }

  const subs = data?.subscriptions ?? [];

  return (
    <div className="space-y-4">
      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Monthly Spend", value: `$${data.monthlySpend.toFixed(2)}`, color: "text-red-400", bg: "border-red-400/20 bg-red-400/[0.06]" },
            { label: "Annual Spend", value: `$${data.annualisedSpend.toFixed(2)}`, color: "text-amber-400", bg: "border-amber-400/20 bg-amber-400/[0.06]" },
            { label: "Subscriptions", value: String(subs.length), color: "text-white/80", bg: "border-white/[0.07] bg-white/[0.03]" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border px-4 py-3 ${s.bg}`}>
              <div className="text-[10px] text-white/35 uppercase tracking-wide">{s.label}</div>
              <div className={`mt-1 text-lg font-bold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Subscription list */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-5 shadow-xl shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/40">
            Active Subscriptions
            {data?.dataSource && (
              <span className="ml-2 rounded px-1.5 py-0.5 text-[9px] bg-white/5 text-white/25 border border-white/10">
                {data.dataSource}
              </span>
            )}
          </div>
          <button
            className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-400/20 transition"
            onClick={() => setAddForm((v) => !v)}
          >
            {addForm ? "Cancel" : "+ Add Subscription"}
          </button>
        </div>

        {subs.length === 0 ? (
          <p className="text-sm text-white/35 text-center py-6">No subscriptions detected yet.</p>
        ) : (
          <div className="space-y-2">
            {subs.map((sub, i) => (
              <div
                key={sub.id ?? `${sub.merchant}-${i}`}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white/80">{sub.merchant}</span>
                      {sub.risk && (
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold border ${RISK_STYLES[sub.risk] ?? RISK_STYLES.low}`}>
                          {sub.risk}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/30 mt-0.5 capitalize">
                      {sub.cadence}
                      {sub.nextRenewalDate && (
                        <> · renews {new Date(sub.nextRenewalDate).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 ml-4 text-right">
                  <div className="text-sm font-semibold text-red-400 tabular-nums">
                    ${sub.amount.toFixed(2)}<span className="text-[10px] text-white/30">/{CADENCE_LABEL[sub.cadence] ?? "mo"}</span>
                  </div>
                  {sub.savingsOpportunity != null && sub.savingsOpportunity > 0 && (
                    <div className="text-[10px] text-emerald-400/70 mt-0.5">
                      save ${sub.savingsOpportunity.toFixed(0)}/yr
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add form */}
      {addForm && (
        <form onSubmit={handleAdd} className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.04] p-5 space-y-3">
          <div className="text-xs font-semibold text-sky-300 uppercase tracking-wide mb-1">Add Subscription</div>
          <div className="flex flex-wrap gap-3">
            <input
              className="flex-1 min-w-[140px] rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-sky-400/40"
              placeholder="Merchant (e.g. Netflix)"
              value={form.merchant}
              onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
              required
            />
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-28 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 placeholder:text-white/25 focus:outline-none focus:border-sky-400/40"
              placeholder="Amount"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
            <select
              className="rounded-xl border border-white/10 bg-[#07111f] px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-sky-400/40"
              value={form.cadence}
              onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value as "monthly" | "quarterly" | "annual" }))}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-sky-400 px-5 py-2 text-sm font-semibold text-[#07111f] hover:bg-sky-300 transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add"}
          </button>
          {saveMsg && <div className="text-xs text-emerald-300">{saveMsg}</div>}
        </form>
      )}
    </div>
  );
}
