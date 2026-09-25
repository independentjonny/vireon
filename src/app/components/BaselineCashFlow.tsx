import type { MonthlyCashFlowLine, MonthlyCashFlowModel } from "@/lib/monthlyCashFlow";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const incomeColors: Record<string, string> = { employment: "#4858e8", rental: "#67b3c7", investment: "#8998d1", "other-income": "#a8b4c9", transactions: "#4858e8" };
const expenseColors: Record<string, string> = { mortgage: "#f3bf58", "living-expense": "#9ba8c7", transactions: "#66b2c6" };

function SegmentedBar({ lines, total, colors }: { lines: MonthlyCashFlowLine[]; total: number; colors: Record<string, string> }) {
  return <div className="flex h-4 w-full overflow-hidden rounded-md bg-slate-100">{lines.map((line) => <div key={line.id} title={`${line.label}: ${money.format(line.monthlyAmount)}`} style={{ width: `${line.monthlyAmount / Math.max(total, 1) * 100}%`, background: colors[line.category] ?? "#b1bacb" }} />)}</div>;
}

function Lines({ lines, colors }: { lines: MonthlyCashFlowLine[]; colors: Record<string, string> }) {
  return <div className="mt-2 grid gap-x-5 md:grid-cols-2 xl:grid-cols-4">{lines.map((line) => <div key={line.id} className="border-r border-slate-200 py-1 pr-4 last:border-r-0"><div className="flex justify-between gap-3 text-sm"><span className="font-medium text-slate-800"><i className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: colors[line.category] ?? "#b1bacb" }} />{line.label.replace(/\s+â€”.*$/, "")}</span><strong>{money.format(line.monthlyAmount)}</strong></div><div className="ml-4 mt-1 truncate text-xs text-slate-500">{line.category.replaceAll("-", " ")}</div></div>)}</div>;
}

export default function BaselineCashFlow({ cashFlow }: { cashFlow: MonthlyCashFlowModel }) {
  const incoming = cashFlow.monthlyIncome;
  const outgoing = cashFlow.monthlyExpenses;
  const movement = cashFlow.monthlySurplus;
  const format = (value: number | null) => value === null ? "Unavailable" : money.format(value);
  return <main className="mx-auto max-w-[1480px] p-6 lg:p-10">
    <div className="mb-6"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Daily money</div><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Cash Flow</h1><p className="mt-1 text-sm text-slate-600">{cashFlow.basis}</p></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-200 pb-3"><div><div className="text-xs text-slate-500">Recorded monthly amounts</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Monthly cash flow breakdown</h2></div><div className="text-left sm:text-right text-xs text-slate-500">{format(incoming)} in − {format(outgoing)} out<div className={`text-xl font-semibold ${movement === null ? "text-slate-600" : movement >= 0 ? "text-emerald-700" : "text-rose-700"}`}>= {movement !== null && movement >= 0 ? "+" : ""}{format(movement)}</div></div></div>
      <div className="mt-4"><div className="mb-2 flex justify-between"><h3 className="font-semibold text-slate-900">Money in</h3><strong>{format(incoming)}</strong></div><SegmentedBar lines={cashFlow.incomeLines} total={incoming ?? 0} colors={incomeColors} /><Lines lines={cashFlow.incomeLines} colors={incomeColors} /></div>
      <div className="mt-5"><div className="mb-2 flex justify-between"><h3 className="font-semibold text-slate-900">Money out</h3><strong>{format(outgoing)}</strong></div><SegmentedBar lines={cashFlow.expenseLines} total={outgoing ?? 0} colors={expenseColors} /><Lines lines={cashFlow.expenseLines} colors={expenseColors} /></div>
    </section>
    {cashFlow.missingInputs.length > 0 && <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold">More information needed</h2><ul className="mt-2 space-y-2 text-sm">{cashFlow.missingInputs.map((item, index) => <li key={`${item.code}-${index}`}>{item.title}: {item.detail}</li>)}</ul></section>}
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">12-month trend</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Net cash movement</h2></div><div className="text-xs text-slate-500">Recorded history</div></div>
      <p className="mt-4 rounded-lg bg-slate-50 p-5 text-sm text-slate-600">History unavailable. Recorded cash flows over time are needed to show a trend.</p>

    </section>
  </main>;
}
