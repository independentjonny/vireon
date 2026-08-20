"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Subscription = { name: string; monthlyAmount: number; approved: boolean };

function money(value: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);
}

export default function DocumentEvidenceReviewClient({ documentId, accountBalance, estimatedAnnualIncomeAfterTax, otherValues, initialSubscriptions }: {
  documentId: string;
  accountBalance: number | null;
  estimatedAnnualIncomeAfterTax: number;
  otherValues: Array<{ label: string; value: string }>;
  initialSubscriptions: Subscription[];
}) {
  const router = useRouter();
  const [annualIncome, setAnnualIncome] = useState(String(Math.round(estimatedAnnualIncomeAfterTax * 100) / 100));
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/financial-vault/imports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "review-document", documentId, estimatedAnnualIncomeAfterTax: annualIncome, subscriptions }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "The review could not be saved.");
      setMessage("Approved updates saved to your Financial Position.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The review could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-6">
    <h2 className="font-semibold">Values linked to this document</h2>
    <div className="mt-4 space-y-3">
      {accountBalance !== null ? <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4"><span className="text-sm text-slate-600">Account Balance</span><span className="font-semibold text-slate-950">{money(accountBalance)}</span></div> : null}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <label className="text-sm font-semibold text-slate-800" htmlFor="after-tax-income">Estimated annual income after tax</label>
        <p className="mt-1 text-xs text-slate-500">Estimated using a 27% tax allowance. Update this estimate if your actual after-tax income differs.</p>
        <div className="mt-3 flex gap-2"><input id="after-tax-income" inputMode="decimal" value={annualIncome} onChange={(event) => setAnnualIncome(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 font-semibold" /><button type="button" onClick={() => void save()} disabled={busy} className="rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white disabled:bg-slate-400">Approve / update</button></div>
      </div>
      {otherValues.map((item) => <div key={item.label} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4"><span className="text-sm text-slate-600">{item.label}</span><span className="font-semibold text-slate-950">{item.value}</span></div>)}
      <div className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">Recurring subscriptions</h3><p className="mt-1 text-xs text-slate-500">Approve genuine recurring payments or remove incorrectly detected items.</p></div><span className="font-semibold">{money(subscriptions.filter((item) => item.approved).reduce((sum, item) => sum + item.monthlyAmount, 0))}/mo</span></div>
        <div className="mt-3 space-y-2">{subscriptions.length ? subscriptions.map((item, index) => <div key={`${item.name}-${index}`} className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{item.name}</div><div className="text-xs text-slate-500">{money(item.monthlyAmount)} per month</div></div><span className={"text-xs font-semibold " + (item.approved ? "text-emerald-700" : "text-rose-700")}>{item.approved ? "Approved" : "Removed"}</span><button type="button" onClick={() => setSubscriptions((items) => items.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, approved: !candidate.approved } : candidate))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700">{item.approved ? "Remove" : "Approve"}</button></div>) : <p className="text-sm text-slate-500">No individual recurring subscriptions were detected.</p>}</div>
        {subscriptions.length ? <button type="button" onClick={() => void save()} disabled={busy} className="mt-3 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-400">Save subscription review</button> : null}
      </div>
      {message ? <div role="status" className={"rounded-xl p-3 text-sm font-semibold " + (message.startsWith("Approved") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{message}</div> : null}
    </div>
  </section>;
}
