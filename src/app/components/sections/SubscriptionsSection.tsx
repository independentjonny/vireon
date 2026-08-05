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
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
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

  useEffect(() => {
    refresh();
  }, []);

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
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Monthly Spend", value: `$${data.monthlySpend.toFixed(2)}`, color: "text-red-600", bg: "border-red-100 bg-red-50" },
            { label: "Annual Spend", value: `$${data.annualisedSpend.toFixed(2)}`, color: "text-amber-700", bg: "border-amber-100 bg-amber-50" },
            { label: "Subscriptions", value: String(subs.length), color: "text-slate-950", bg: "border-slate-200 bg-white" },
          ].map((s) => (
            <div key={s.label} className={`rounded-lg border px-4 py-4 ${s.bg}`}>
              <div className="text-xs font-medium text-slate-500">{s.label}</div>
              <div className={`mt-2 text-2xl font-semibold tabular-nums ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950">Renewal calendar</h3>
            <p className="mt-1 text-sm text-slate-500">Upcoming subscription renewals sorted by due date.</p>
          </div>
          <span className="text-xs text-slate-500">{upcomingRenewals.length} upcoming</span>
        </div>

        {upcomingRenewals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
            <div className="text-sm font-semibold text-slate-950">No upcoming renewals</div>
            <p className="mt-1 text-sm text-slate-500">Add or import subscriptions to see renewal timing.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {upcomingRenewals.map((sub, i) => {
              const dueSoon = sub.daysAway <= 14;
              return (
                <div key={sub.id ?? `${sub.merchant}-renewal-${i}`} className={`rounded-lg border p-4 ${dueSoon ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{sub.merchant}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {new Date(sub.nextRenewalDate as string).toLocaleDateString()}
                      </div>
                    </div>
                    <div className={`text-right text-sm font-semibold ${dueSoon ? "text-amber-700" : "text-slate-700"}`}>
                      {sub.daysAway <= 0 ? "Due now" : `${sub.daysAway}d`}
                    </div>
                  </div>
                  <div className="mt-3 text-lg font-semibold tabular-nums text-red-600">
                    ${sub.amount.toFixed(2)}
                    <span className="ml-1 text-xs font-medium text-slate-500">/{CADENCE_LABEL[sub.cadence] ?? "mo"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-base font-semibold text-slate-950">Detected subscriptions</div>
            <p className="mt-1 text-sm text-slate-500">
              Recurring merchants, cadence, next renewal, and estimated savings.
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
              disabled={subs.length === 0 || removingAll}
            >
              {removingAll ? "Removing..." : "Remove All Subscriptions"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              onClick={() => setAddForm((v) => !v)}
            >
              {addForm ? "Cancel" : "+ Add Subscription"}
            </button>
          </div>
        </div>

        {subs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <div className="text-base font-semibold text-slate-950">No subscriptions detected</div>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Imported recurring transactions and manually added subscriptions will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {subs.map((sub, i) => (
              <div key={sub.id ?? `${sub.merchant}-${i}`} className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-slate-950">{sub.merchant}</span>
                    {sub.risk && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold border ${RISK_STYLES[sub.risk] ?? RISK_STYLES.low}`}>
                        {sub.risk}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-slate-500 capitalize">
                    {sub.cadence}
                    {sub.nextRenewalDate && <> - renews {new Date(sub.nextRenewalDate).toLocaleDateString()}</>}
                  </div>
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <div className="text-xl font-semibold tabular-nums text-red-600">
                    ${sub.amount.toFixed(2)}
                    <span className="ml-1 text-xs font-medium text-slate-500">/{CADENCE_LABEL[sub.cadence] ?? "mo"}</span>
                  </div>
                  {sub.savingsOpportunity != null && sub.savingsOpportunity > 0 && (
                    <div className="mt-1 text-xs text-emerald-700">
                      save ${sub.savingsOpportunity.toFixed(0)}/yr
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {addForm && (
        <form onSubmit={handleAdd} className="space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-5">
          <div className="mb-1 text-xs font-semibold uppercase tracking-normal text-blue-700">Add Subscription</div>
          <div className="flex flex-wrap gap-3">
            <input
              className="min-w-[140px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none"
              placeholder="Merchant (e.g. Netflix)"
              value={form.merchant}
              onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
              required
            />
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400 focus:border-blue-300 focus:outline-none"
              placeholder="Amount"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 focus:border-blue-300 focus:outline-none"
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
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add"}
          </button>
          {saveMsg && <div className="text-xs text-emerald-700">{saveMsg}</div>}
        </form>
      )}
    </div>
  );
}
