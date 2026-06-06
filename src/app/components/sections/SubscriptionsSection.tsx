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

function daysUntil(date: string): number {
  const today = new Date();
  const renewal = new Date(date);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const end = new Date(renewal.getFullYear(), renewal.getMonth(), renewal.getDate()).getTime();
  return Math.ceil((end - start) / (24 * 60 * 60 * 1000));
}

export default function SubscriptionsSection() {
  const [data, setData] = useState<SubscriptionsData | null>(null);
  const [addForm, setAddForm] = useState(false);
  const [form, setForm] = useState({ merchant: "", amount: "", cadence: "monthly" as "monthly" | "quarterly" | "annual" });
  const [saving, setSaving] = useState(false);
  const [removingAll, setRemovingAll] = useState(false);
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

  async function handleRemoveAll() {
    if (subs.length === 0 || removingAll) return;
    if (!window.confirm(`Remove all ${subs.length} subscription(s)?`)) return;

    setRemovingAll(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/subscriptions", { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        setSaveMsg(json.message ?? "Removed all subscriptions.");
        refresh();
      } else {
        setSaveMsg("Failed to remove subscriptions");
      }
    } catch {
      setSaveMsg("Failed to remove subscriptions");
    }
    setRemovingAll(false);
  }

  const subs = data?.subscriptions ?? [];
  const upcomingRenewals = subs
    .filter((sub) => sub.nextRenewalDate)
    .map((sub) => ({ ...sub, daysAway: daysUntil(sub.nextRenewalDate as string) }))
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Monthly Spend", value: `$${data.monthlySpend.toFixed(2)}`, color: "text-red-400", bg: "border-red-400/20 bg-red-400/[0.06]" },
            { label: "Annual Spend", value: `$${data.annualisedSpend.toFixed(2)}`, color: "text-amber-400", bg: "border-amber-400/20 bg-amber-400/[0.06]" },
            { label: "Subscriptions", value: String(subs.length), color: "text-white/80", bg: "border-white/[0.07] bg-white/[0.03]" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border px-4 py-4 ${s.bg}`}>
              <div className="text-xs font-medium text-white/55">{s.label}</div>
              <div className={`mt-2 text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.1] bg-white/[0.045] p-4 shadow-xl shadow-black/20 sm:p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Renewal calendar</h3>
            <p className="mt-1 text-sm text-white/55">Upcoming subscription renewals sorted by due date.</p>
          </div>
          <span className="text-xs text-white/45">{upcomingRenewals.length} upcoming</span>
        </div>

        {upcomingRenewals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.14] bg-black/10 px-4 py-6 text-center">
            <div className="text-sm font-semibold text-white">No upcoming renewals</div>
            <p className="mt-1 text-sm text-white/50">Add or import subscriptions to see renewal timing.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {upcomingRenewals.map((sub, i) => {
              const dueSoon = sub.daysAway <= 14;
              return (
                <div
                  key={sub.id ?? `${sub.merchant}-renewal-${i}`}
                  className={[
                    "rounded-xl border p-4",
                    dueSoon
                      ? "border-amber-300/30 bg-amber-300/[0.08]"
                      : "border-white/[0.07] bg-white/[0.025]",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{sub.merchant}</div>
                      <div className="mt-1 text-xs text-white/52">
                        {new Date(sub.nextRenewalDate as string).toLocaleDateString()}
                      </div>
                    </div>
                    <div className={`text-right text-sm font-bold ${dueSoon ? "text-amber-200" : "text-white/78"}`}>
                      {sub.daysAway <= 0 ? "Due now" : `${sub.daysAway}d`}
                    </div>
                  </div>
                  <div className="mt-3 text-lg font-bold tabular-nums text-red-300">
                    ${sub.amount.toFixed(2)}
                    <span className="ml-1 text-xs font-medium text-white/45">/{CADENCE_LABEL[sub.cadence] ?? "mo"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subscription list */}
      <div className="rounded-2xl border border-white/[0.1] bg-white/[0.045] p-4 shadow-xl shadow-black/20 sm:p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-base font-semibold text-white">
              Detected subscriptions
            </div>
            <p className="mt-1 text-sm text-white/55">
              Recurring merchants, cadence, next renewal, and estimated savings.
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
              disabled={subs.length === 0 || removingAll}
            >
              {removingAll ? "Removing..." : "Remove All Subscriptions"}
            </button>
            <button
              type="button"
              className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-400/20 transition"
              onClick={() => setAddForm((v) => !v)}
            >
              {addForm ? "Cancel" : "+ Add Subscription"}
            </button>
          </div>
        </div>

        {subs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.14] bg-black/10 px-4 py-8 text-center">
            <div className="text-base font-semibold text-white">No subscriptions detected</div>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
              Imported recurring transactions and manually added subscriptions will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {subs.map((sub, i) => (
              <div
                key={sub.id ?? `${sub.merchant}-${i}`}
                className="flex items-start justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-white/88">{sub.merchant}</span>
                      {sub.risk && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold border ${RISK_STYLES[sub.risk] ?? RISK_STYLES.low}`}>
                          {sub.risk}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-white/55 capitalize">
                      {sub.cadence}
                      {sub.nextRenewalDate && (
                        <> · renews {new Date(sub.nextRenewalDate).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 ml-4 text-right">
                  <div className="text-xl font-bold text-red-300 tabular-nums">
                    ${sub.amount.toFixed(2)}<span className="ml-1 text-xs font-medium text-white/45">/{CADENCE_LABEL[sub.cadence] ?? "mo"}</span>
                  </div>
                  {sub.savingsOpportunity != null && sub.savingsOpportunity > 0 && (
                    <div className="mt-1 text-xs text-emerald-300/80">
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
