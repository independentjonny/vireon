import Link from "next/link";
import { confirmedBalance, confirmedPositionSummary } from "@/lib/confirmedPositionSummary";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";
import type { FinancialPositionReadModel } from "@/server/services/financialPositionReadService";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

const format = (value: number | null) => value === null ? "Unavailable" : money.format(value);

function DetailList({ records, empty }: { records: CanonicalFinancialRecord[]; empty: string }) {
  if (!records.length) return <p className="py-5 text-sm text-slate-500">{empty}</p>;
  return (
    <div className="grid gap-x-8 md:grid-cols-2">
      {records.map((record) => (
        <div key={record.id} className="border-b border-slate-200 py-3 last:border-b-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-medium text-slate-900">{record.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{record.subtype || "Confirmed financial record"}</div>
            </div>
            <strong className="text-base font-semibold text-slate-900">{format(confirmedBalance(record))}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BaselineFinancialPosition({ position }: { position: FinancialPositionReadModel }) {
  const summary = confirmedPositionSummary(position);
  const { assets, liabilities, netPosition: netWorth, assetGroups } = summary;
  const monthlyIncome = position.monthlyCashFlow.monthlyIncome;
  const annualIncome = monthlyIncome === null ? null : monthlyIncome * 12;
  const liabilityRatio = assets !== null && assets > 0 && liabilities !== null ? liabilities / assets * 100 : null;

  return (
    <main className="mx-auto max-w-[1480px] p-6 lg:p-10">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Financial profile</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Financial Position</h1>
          <p className="mt-1 text-sm text-slate-600">{summary.note}</p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div><div className="text-xs text-slate-500">Known net position</div><div className="mt-1 text-3xl font-semibold text-slate-900">{format(netWorth)}</div></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Known records only</span>
          </div>
          <div className="mt-6 rounded-lg bg-slate-50 p-5 text-sm text-slate-600">History unavailable. Recorded balances over time are needed to show changes in your position.</div>

        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Assets</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Where your wealth sits</h2></div><div className="text-right"><strong className="text-lg text-slate-900">{format(assets)}</strong><div><Link href="/financial-profile/add-data" className="text-xs font-medium text-blue-700">Manage data</Link></div></div></div>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">{assetGroups.filter((item) => item.value !== null && item.value > 0).map((item) => <div key={item.label} style={{ width: `${(item.value ?? 0) / Math.max(assets ?? 0, 1) * 100}%`, background: item.color }} />)}</div>
          <div className="mt-3 grid gap-x-6 md:grid-cols-2">{assetGroups.map((item) => <div key={item.label} className="flex justify-between py-1.5 text-sm"><span className="text-slate-700">{item.label}</span><strong className="font-semibold text-slate-900">{format(item.value)}</strong></div>)}</div>
        </article>

        <article className="rounded-2xl border-t-4 border-amber-400 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Liabilities</div><h2 className="mt-1 text-lg font-semibold text-slate-900">What you owe</h2></div><div className="text-right"><strong className="text-xl text-slate-900">{format(liabilities)}</strong><div className="text-xs text-slate-500">{liabilityRatio === null ? "Unavailable" : `${liabilityRatio.toFixed(1)}%`} of assets</div></div></div>
          <DetailList records={summary.liabilityRecords} empty="No current confirmed liability balances. This does not mean you have no debt." />
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500"><span>Debt-to-assets ratio</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-amber-400" style={{ width: `${Math.min(100, liabilityRatio ?? 0)}%` }} /></div><strong>{liabilityRatio === null ? "Unavailable" : `${liabilityRatio.toFixed(1)}%`}</strong></div>
        </article>

        <article className="rounded-2xl border-t-4 border-indigo-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Income</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Where your income comes from</h2></div><div className="text-right"><strong className="text-xl text-slate-900">{format(annualIncome)}/year</strong><div className="text-xs text-slate-500">Annualised from recorded monthly income</div></div></div>
          {position.monthlyCashFlow.incomeLines.length ? <ul className="mt-3 space-y-2 text-sm">{position.monthlyCashFlow.incomeLines.map((line) => <li key={line.id} className="flex justify-between gap-4"><span>{line.label}{line.approximate ? " (estimated)" : ""}</span><strong>{format(line.monthlyAmount)}/month</strong></li>)}</ul> : <p className="py-5 text-sm text-slate-500">No income with a usable amount and frequency.</p>}
          <p className="mt-3 text-xs text-slate-500">{position.monthlyCashFlow.basis}</p>
          <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm"><span className="text-slate-500">Average monthly income</span><strong>{format(monthlyIncome)}</strong></div>
        </article>
      </section>
    </main>
  );
}
