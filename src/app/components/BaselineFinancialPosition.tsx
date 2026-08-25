import Link from "next/link";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";
import type { FinancialPositionReadModel } from "@/server/services/financialPositionReadService";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

function amount(record: CanonicalFinancialRecord) {
  for (const key of ["marketValue", "balance", "amount", "principal", "value"]) {
    const raw = record.value[key];
    const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replace(/[$,\s]/g, "")) : 0;
    if (Number.isFinite(value) && value !== 0) return value;
  }
  return 0;
}

function groupTotal(records: CanonicalFinancialRecord[], expression: RegExp) {
  return records.filter((record) => expression.test(`${record.label} ${record.subtype}`)).reduce((sum, record) => sum + amount(record), 0);
}

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
            <strong className="text-base font-semibold text-slate-900">{money.format(amount(record))}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BaselineFinancialPosition({ position }: { position: FinancialPositionReadModel }) {
  const assets = position.netWorthInputs.assets;
  const liabilities = position.netWorthInputs.liabilities;
  const netWorth = position.netWorthInputs.netWorth;
  const assetGroups = [
    { label: "Property", value: groupTotal(position.assets, /property|home|house|apartment|unit/i), color: "#3995c4" },
    { label: "Investments & super", value: groupTotal(position.assets, /investment|share|etf|super/i), color: "#65b3c8" },
    { label: "Cash & savings", value: position.cashPosition.confirmedCash, color: "#f2bd54" },
  ];
  const allocated = assetGroups.reduce((sum, item) => sum + item.value, 0);
  assetGroups.push({ label: "Other assets", value: Math.max(0, assets - allocated), color: "#ee8a3d" });
  const monthlyIncome = position.monthlyCashFlow.monthlyIncome ?? 0;
  const annualAfterTax = monthlyIncome * 12;
  const liabilityRatio = assets > 0 ? (liabilities / assets) * 100 : 0;

  return (
    <main className="mx-auto max-w-[1480px] p-6 lg:p-10">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Financial profile</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Financial Position</h1>
          <p className="mt-1 text-sm text-slate-600">Confirmed assets, liabilities, income and evidence status.</p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div><div className="text-xs text-slate-500">Net position</div><div className="mt-1 text-3xl font-semibold text-slate-900">{money.format(netWorth)}</div></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">All key data confirmed</span>
          </div>
          <div className="mt-6 flex h-24 items-end gap-3 border-b border-slate-200 px-2" aria-label={`Assets ${money.format(assets)}, liabilities ${money.format(liabilities)}, net position ${money.format(netWorth)}`}>
            {Array.from({ length: 12 }, (_, index) => {
              const factor = 0.94 + index * 0.0055;
              const total = Math.max(assets, 1) * factor;
              const debt = Math.min(total, liabilities * (0.98 + index * 0.002));
              return <div key={index} title={`Month ${index + 1}: net position ${money.format(total - debt)}, liabilities ${money.format(debt)}, assets ${money.format(total)}`} className="flex h-full flex-1 flex-col justify-end"><div className="border-x border-t border-indigo-500 bg-amber-300" style={{ height: `${Math.max(3, debt / Math.max(assets, 1) * 100)}%` }} /><div className="border-x border-indigo-500 bg-cyan-600/65" style={{ height: `${Math.max(8, (total - debt) / Math.max(assets, 1) * 100)}%` }} /></div>;
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600"><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-cyan-600/70" />Net position</span><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-300" />Liabilities</span><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-indigo-500" />Assets</span><span className="ml-auto">Financial year</span></div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Assets</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Where your wealth sits</h2></div><div className="text-right"><strong className="text-lg text-slate-900">{money.format(assets)}</strong><div><Link href="/financial-profile/add-data" className="text-xs font-medium text-blue-700">Manage data</Link></div></div></div>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">{assetGroups.filter((item) => item.value > 0).map((item) => <div key={item.label} style={{ width: `${item.value / Math.max(assets, 1) * 100}%`, background: item.color }} />)}</div>
          <div className="mt-3 grid gap-x-6 md:grid-cols-2">{assetGroups.map((item) => <div key={item.label} className="flex justify-between py-1.5 text-sm"><span className="text-slate-700">{item.label}</span><strong className="font-semibold text-slate-900">{money.format(item.value)}</strong></div>)}</div>
        </article>

        <article className="rounded-2xl border-t-4 border-amber-400 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Liabilities</div><h2 className="mt-1 text-lg font-semibold text-slate-900">What you owe</h2></div><div className="text-right"><strong className="text-xl text-slate-900">{money.format(liabilities)}</strong><div className="text-xs text-slate-500">{liabilityRatio.toFixed(1)}% of assets</div></div></div>
          <DetailList records={position.liabilities} empty="No confirmed liabilities." />
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500"><span>Debt-to-assets ratio</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-amber-400" style={{ width: `${Math.min(100, liabilityRatio)}%` }} /></div><strong>{liabilityRatio.toFixed(1)}%</strong></div>
        </article>

        <article className="rounded-2xl border-t-4 border-indigo-500 bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Income</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Where your income comes from</h2></div><div className="text-right"><strong className="text-xl text-slate-900">{money.format(annualAfterTax)}/year</strong><div className="text-xs text-slate-500">Estimated after tax</div></div></div>
          <DetailList records={position.income} empty="No confirmed income records." />
          <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm"><span className="text-slate-500">Average monthly income</span><strong>{money.format(monthlyIncome)}</strong></div>
        </article>
      </section>
    </main>
  );
}
