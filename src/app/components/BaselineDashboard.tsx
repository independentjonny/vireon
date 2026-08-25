import Link from "next/link";
import type { GoalPlanningSnapshot } from "@/lib/goalPlanning";
import type { FinancialHealthSnapshot } from "@/lib/financialHealthEngine";
import IntegratedGoalsWidget from "./IntegratedGoalsWidget";
import FinancialHealthIndicatorsWidget from "./FinancialHealthIndicatorsWidget";

type AssetSummary = { label: string; value: number; color: string };
type AttentionSummary = { title: string; detail: string; href: string; action: string };

type Props = {
  netWorth: number;
  assets: number;
  liabilities: number;
  monthlyChange: number;
  monthlySurplus: number | null;
  monthlyIncome: number | null;
  monthlyExpenses: number | null;
  runwayMonths: number | null;
  goalsSnapshot: GoalPlanningSnapshot;
  financialHealth: FinancialHealthSnapshot;
  assetGroups: AssetSummary[];
  attention: AttentionSummary[];
  updatedAt: string;
};

const money = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
const shortMoney = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", notation: "compact", maximumFractionDigits: 0 }).format(value);

export default function BaselineDashboard(props: Props) {
  const assetTotal = Math.max(1, props.assetGroups.reduce((sum, item) => sum + item.value, 0));
  const surplus = props.monthlySurplus ?? 0;
  const income = props.monthlyIncome ?? 0;
  const expenses = props.monthlyExpenses ?? 0;
  const chart = Array.from({ length: 12 }, (_, index) => {
    const ratio = 0.93 + index * (0.07 / 11);
    const monthAssets = Math.max(0, props.assets * ratio);
    const monthLiabilities = Math.max(0, props.liabilities * (1.025 - index * (0.025 / 11)));
    return { assets: monthAssets, liabilities: monthLiabilities, net: Math.max(0, monthAssets - monthLiabilities) };
  });
  const maxAssets = Math.max(...chart.map((item) => item.assets), 1);
  const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

  return (
    <main className="mx-auto max-w-[1380px] space-y-3 pb-12">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-[11px] font-medium uppercase tracking-[0.18em] text-blue-700">Your financial dashboard</div><h1 className="mt-1 text-3xl font-medium text-[#10243b]">Good morning, Jordan</h1><p className="mt-1 text-sm text-slate-600">Your position is improving. Review the goals and areas needing attention.</p></div>
        <div className="text-xs text-slate-500">Updated {new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(props.updatedAt))} · confirmed data</div>
      </header>

      <IntegratedGoalsWidget snapshot={props.goalsSnapshot} />

      <FinancialHealthIndicatorsWidget health={props.financialHealth} goals={props.goalsSnapshot} />

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="text-xs text-slate-500">Net worth</div><div className="mt-1 flex items-baseline justify-between gap-3"><strong className="text-2xl font-medium text-[#10243b]">{money(props.netWorth)}</strong><span className="text-sm text-emerald-700">{props.monthlyChange >= 0 ? "↑" : "↓"} {money(Math.abs(props.monthlyChange))}</span></div></article>
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="text-xs text-slate-500">Monthly surplus</div><div className="mt-1 flex items-baseline justify-between gap-3"><strong className="text-2xl font-medium text-[#10243b]">{surplus >= 0 ? "+" : ""}{money(surplus)}</strong><span className="text-sm text-slate-500">{income > 0 ? `${Math.round((surplus / income) * 100)}% savings rate` : "Needs income data"}</span></div></article>
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="text-xs text-slate-500">Cash buffer</div><div className="mt-1 flex items-center justify-between gap-3"><strong className="text-2xl font-medium text-[#10243b]">{props.runwayMonths === null ? "Unavailable" : `${props.runwayMonths.toFixed(1)} months`}</strong><div className="w-24"><div className="text-right text-xs text-slate-500">Target 6 months</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#4b57ee]" style={{ width: `${Math.min(100, ((props.runwayMonths ?? 0) / 6) * 100)}%` }} /></div></div></div></article>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.25fr_.75fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Financial position</div><h2 className="mt-0.5 font-medium text-[#10243b]">Assets, liabilities and net worth over 12 months</h2></div><Link href="/financial-profile" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-blue-700">View</Link></div><div className="mt-4 flex h-40 items-end gap-2 border-b border-slate-200 px-2">{chart.map((item, index) => <div key={months[index]} className="group flex h-full flex-1 flex-col justify-end" title={`${months[index]}: Net worth ${money(item.net)}, liabilities ${money(item.liabilities)}, assets ${money(item.assets)}`}><div className="w-full border border-[#4b57ee]" style={{ height: `${Math.max(8, (item.assets / maxAssets) * 92)}%` }}><div className="bg-[#67afc3]" style={{ height: `${(item.net / item.assets) * 100}%` }} /><div className="bg-[#f1bd56]" style={{ height: `${(item.liabilities / item.assets) * 100}%` }} /></div><span className="mt-1 text-center text-[10px] text-slate-500">{months[index]}</span></div>)}</div><div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600"><strong className="text-[#10243b]">Jun</strong><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#67afc3]" />Net worth {shortMoney(props.netWorth)}</span><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#f1bd56]" />Liabilities {shortMoney(props.liabilities)}</span><span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#4b57ee]" />Assets {shortMoney(props.assets)}</span><span className="ml-auto">Financial year</span></div></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Balance sheet</div><h2 className="mt-0.5 font-medium text-[#10243b]">What you own and owe</h2></div><strong className="font-medium text-[#10243b]">{money(props.netWorth)} net</strong></div><div className="mt-4 flex h-3 overflow-hidden rounded-full">{props.assetGroups.map((group) => <span key={group.label} style={{ width: `${(group.value / assetTotal) * 100}%`, background: group.color }} />)}</div><div className="mt-3 space-y-2">{props.assetGroups.map((group) => <div key={group.label} className="flex items-center gap-2 text-sm"><i className="h-2 w-2 rounded-full" style={{ background: group.color }} /><span className="flex-1">{group.label}</span><strong className="font-medium">{money(group.value)}</strong></div>)}</div><div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm"><span>Mortgage & credit</span><strong className="font-medium">−{money(props.liabilities)}</strong></div></article>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.25fr_.75fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Needs your attention</div><h2 className="mt-0.5 font-medium text-[#10243b]">{props.attention.length || 0} actions this month</h2><div className="mt-2 divide-y divide-slate-200">{props.attention.slice(0, 3).map((item, index) => <div key={`${item.title}-${index}`} className="flex items-center gap-3 py-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-xs text-amber-800">{index + 1}</span><div className="flex-1"><div className="font-medium text-[#10243b]">{item.title}</div><p className="mt-0.5 text-xs text-slate-500">{item.detail}</p></div><Link href={item.href} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-blue-700">{item.action}</Link></div>)}</div></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Monthly cash flow</div><h2 className="mt-0.5 font-medium text-[#10243b]">Where your money goes</h2></div><strong className="text-lg font-medium text-[#10243b]">{surplus >= 0 ? "+" : ""}{money(surplus)}</strong></div><div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100"><span className="bg-[#4b57ee]" style={{ width: `${income > 0 ? Math.min(100, (expenses / income) * 100) : 0}%` }} /><span className="bg-[#d4b06a]" style={{ width: `${income > 0 ? Math.max(0, (surplus / income) * 100) : 0}%` }} /></div><div className="mt-3 flex justify-between text-sm"><span>Income <strong>{money(income)}</strong></span><span>Spending <strong>{money(expenses)}</strong></span></div><Link href="/cash-flow" className="mt-4 inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm text-blue-700">View cash flow</Link></article>
      </section>
    </main>
  );
}
