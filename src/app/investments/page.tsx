import AppShell from "../components/AppShell";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";
import { investmentPortfolio } from "@/lib/investmentPortfolio";

export const dynamic = "force-dynamic";

const money = (value: number | null) => value === null ? "Unavailable" : new Intl.NumberFormat("en-AU", {
  style: "currency", currency: "AUD", maximumFractionDigits: 0,
}).format(value);

export default async function InvestmentsPage() {
  const session = await requireServerPageSession("/investments");
  const position = await createFinancialPositionReadServiceFromEnv().read(session);
  const { groups, total, balance } = investmentPortfolio(position);

  return (
    <AppShell active="workspace">
      <main className="mx-auto max-w-[1380px] space-y-4 pb-12">
        <header><div className="text-[11px] font-medium uppercase tracking-[0.18em] text-blue-700">Wealth</div><h1 className="mt-1 text-3xl font-medium text-[#10243b]">Investments</h1><p className="mt-1 text-sm text-slate-600">Portfolio value, allocation, returns and evidence freshness.</p></header>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Portfolio composition and performance</div><h2 className="mt-1 text-lg font-medium text-[#10243b]">{money(total)}</h2></div><a href="/financial-profile/add-data?category=investments" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-blue-700">Manage data</a></div>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">{groups.map((group) => <span key={group.label} style={{ width: `${total && group.value !== null ? group.value / total * 100 : 0}%`, background: group.color }} />)}</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">{groups.map((group) => <article key={group.label} className="border-t border-slate-200 pt-3"><div className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: group.color }} /><span className="flex-1 font-medium text-[#10243b]">{group.label}</span><strong className="font-medium">{money(group.value)}</strong></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>Allocation</span><span>{total && group.value !== null ? (group.value / total * 100).toFixed(1) : "—"}%</span></div><div className="mt-1 flex justify-between text-xs text-slate-500"><span>12-month return</span><span>Unavailable — recorded return history needed</span></div></article>)}</div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs text-slate-500">Investment details</div><h2 className="mt-1 text-lg font-medium text-[#10243b]">Holdings and linked evidence</h2>
          <div className="mt-3 divide-y divide-slate-200">
            {groups.flatMap((group) => group.items.map((item) => <div key={item.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><div className="font-medium text-[#10243b]">{item.label}</div><div className="mt-0.5 text-xs text-slate-500">{item.subtype.replaceAll("-", " ")} · confidence {Math.round(item.provenance.confidence * 100)}%</div></div><span className="text-sm text-slate-500">Updated {new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(item.updatedAt))}</span><strong className="font-medium text-[#10243b]">{money(balance(item))}</strong></div>))}
            {!groups.length && <div className="py-5 text-sm text-slate-600">No confirmed investment records yet.</div>}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
