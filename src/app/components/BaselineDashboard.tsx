import Link from "next/link";

type GoalSummary = {
  id: string;
  title: string;
  current: number;
  target: number;
  targetDate: string | null;
  status: string;
  risk: string;
  opportunity: string;
};

type AssetSummary = { label: string; value: number | null; color: string };
type AttentionSummary = { title: string; detail: string; href: string; action: string };

type Props = {
  netWorth: number | null;
  assets: number | null;
  liabilities: number | null;
  monthlyChange: number | null;
  monthlySurplus: number | null;
  monthlyIncome: number | null;
  monthlyExpenses: number | null;
  runwayMonths: number | null;
  goals: GoalSummary[];
  assetGroups: AssetSummary[];
  attention: AttentionSummary[];
  updatedAt: string;
  dataNote: string;
  cashFlowBasis: string;
};

const money = (value: number | null) => value === null ? "Unavailable" : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);

function progress(current: number, target: number) {
  return target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;
}

function dateLabel(value: string | null) {
  if (!value) return "No target date";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric" }).format(date);
}

export default function BaselineDashboard(props: Props) {
  const goals = props.goals.slice(0, 2);
  const assetTotal = Math.max(1, props.assetGroups.reduce((sum, item) => sum + (item.value ?? 0), 0));
  const surplus = props.monthlySurplus;
  const income = props.monthlyIncome;
  const expenses = props.monthlyExpenses;
  const signedSurplus = surplus === null ? "Unavailable" : `${surplus >= 0 ? "+" : ""}${money(surplus)}`;

  return (
    <main className="mx-auto max-w-[1380px] space-y-3 pb-12">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="text-[11px] font-medium uppercase tracking-[0.18em] text-blue-700">Your financial dashboard</div><h1 className="mt-1 text-3xl font-medium text-[#10243b]">Your financial overview</h1><p className="mt-1 text-sm text-slate-600">Review your recorded position and the information still needed.</p></div>
        <div className="text-xs text-slate-500">Viewed {new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(props.updatedAt))}</div>
      </header>

      <p className="text-sm text-slate-600">{props.dataNote}</p>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-4"><div><div className="text-xs text-slate-500">Goals</div><h2 className="mt-0.5 text-lg font-medium text-[#10243b]">Your goals, risks and opportunities</h2></div><Link href="/goals" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-blue-700">View all goals</Link></div>
        <div className="mt-3 grid border-t border-slate-200 lg:grid-cols-2">
          {goals.map((goal, index) => { const pct = progress(goal.current, goal.target); return <article key={goal.id} className={`py-3 ${index ? "lg:border-l lg:border-slate-200 lg:pl-5" : "lg:pr-5"}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium text-[#10243b]">{goal.title}</h3><p className="mt-0.5 text-xs text-slate-500">{goal.target > 0 ? `${money(goal.current)} of ${money(goal.target)}` : "Target amount needed"} · {dateLabel(goal.targetDate)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${goal.status.includes("RISK") || goal.status.includes("ATTENTION") || goal.status.includes("INFORMATION") ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{goal.status.replaceAll("_", " ").toLowerCase()}</span></div><div className="mt-3 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#6479ef]" style={{ width: `${pct}%` }} /></div><strong className="text-sm font-medium text-[#10243b]">{goal.target > 0 ? `${pct}%` : "Not assessed"}</strong></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><p className="text-xs leading-5 text-slate-600"><span className="mr-2 rounded-full bg-amber-50 px-2 py-1 text-amber-800">Risk</span>{goal.risk}</p><p className="text-xs leading-5 text-slate-600"><span className="mr-2 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">Opportunity</span>{goal.opportunity}</p></div></article>; })}
          {!goals.length && <div className="py-5 text-sm text-slate-600">No active goals yet. <Link href="/goals" className="font-medium text-blue-700">Create a goal</Link></div>}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="text-xs text-slate-500">Known net position</div><div className="mt-1 flex items-baseline justify-between gap-3"><strong className="text-2xl font-medium text-[#10243b]">{money(props.netWorth)}</strong><span className="text-xs text-slate-500">Change unavailable</span></div></article>
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="text-xs text-slate-500">Monthly surplus</div><div className="mt-1 flex items-baseline justify-between gap-3"><strong className="text-2xl font-medium text-[#10243b]">{signedSurplus}</strong><span className="text-sm text-slate-500">{income !== null && income > 0 && surplus !== null ? `${Math.round((surplus / income) * 100)}% savings rate` : "More cash-flow information needed"}</span></div></article>
        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-3"><div className="text-xs text-slate-500">Cash buffer</div><div className="mt-1 flex items-center justify-between gap-3"><strong className="text-2xl font-medium text-[#10243b]">{props.runwayMonths === null ? "Unavailable" : `${props.runwayMonths.toFixed(1)} months`}</strong><div className="w-24"><div className="text-right text-xs text-slate-500">Target 6 months</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#4b57ee]" style={{ width: `${Math.min(100, ((props.runwayMonths ?? 0) / 6) * 100)}%` }} /></div></div></div></article>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.25fr_.75fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Financial position</div><h2 className="mt-0.5 font-medium text-[#10243b]">Financial position history</h2></div><Link href="/financial-profile" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-blue-700">View</Link></div><div className="mt-4 flex min-h-40 items-center rounded-lg bg-slate-50 p-5 text-sm text-slate-600">History unavailable. Recorded balances over time are needed to show changes in your position.</div></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Balance sheet</div><h2 className="mt-0.5 font-medium text-[#10243b]">What you own and owe</h2></div><strong className="font-medium text-[#10243b]">{money(props.netWorth)}</strong></div><div className="mt-4 flex h-3 overflow-hidden rounded-full">{props.assetGroups.map((group) => <span key={group.label} style={{ width: `${((group.value ?? 0) / assetTotal) * 100}%`, background: group.color }} />)}</div><div className="mt-3 space-y-2">{props.assetGroups.map((group) => <div key={group.label} className="flex items-center gap-2 text-sm"><i className="h-2 w-2 rounded-full" style={{ background: group.color }} /><span className="flex-1">{group.label}</span><strong className="font-medium">{money(group.value)}</strong></div>)}</div><div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm"><span>Known liabilities</span><strong className="font-medium">{money(props.liabilities)}</strong></div></article>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.25fr_.75fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Information to review</div><h2 className="mt-0.5 font-medium text-[#10243b]">{props.attention.length || 0} data checks</h2><div className="mt-2 divide-y divide-slate-200">{props.attention.slice(0, 3).map((item, index) => <div key={`${item.title}-${index}`} className="flex items-center gap-3 py-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-xs text-amber-800">{index + 1}</span><div className="flex-1"><div className="font-medium text-[#10243b]">{item.title}</div><p className="mt-0.5 text-xs text-slate-500">{item.detail}</p></div><Link href={item.href} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-blue-700">{item.action}</Link></div>)}</div></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between"><div><div className="text-xs text-slate-500">Monthly cash flow</div><h2 className="mt-0.5 font-medium text-[#10243b]">Where your money goes</h2></div><strong className="text-lg font-medium text-[#10243b]">{signedSurplus}</strong></div><div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100"><span className="bg-[#4b57ee]" style={{ width: `${income !== null && income > 0 && expenses !== null ? Math.min(100, (expenses / income) * 100) : 0}%` }} /><span className="bg-[#d4b06a]" style={{ width: `${income !== null && income > 0 && surplus !== null ? Math.min(100, Math.max(0, (surplus / income) * 100)) : 0}%` }} /></div><div className="mt-3 flex justify-between text-sm"><span>Income <strong>{money(income)}</strong></span><span>Spending <strong>{money(expenses)}</strong></span></div><p className="mt-3 text-xs text-slate-500">{props.cashFlowBasis}</p><Link href="/cash-flow" className="mt-4 inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm text-blue-700">View cash flow</Link></article>
      </section>
    </main>
  );
}
