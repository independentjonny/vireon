import WealthTrajectory from "./WealthTrajectory";
import { wealthTrajectory, type TrajectorySettings } from "@/lib/wealthTrajectory";
import Link from "next/link";
import { ArrowUpRight, ChartNoAxesCombined, CircleDollarSign, Landmark, Scale, Sparkles, Target, WalletCards, CalendarDays } from "lucide-react";
import DecisionImpactTester from "./DecisionImpactTester";
import "./command-centre.css";

type GoalSummary = { id: string; title: string; current: number; target: number; targetDate: string | null; status: string; risk: string; opportunity: string };
type Props = {
  trajectory: TrajectorySettings | null;
  netWorth: number | null; assets: number | null; liabilities: number | null;
  monthlyChange: number | null; monthlySurplus: number | null; monthlyIncome: number | null;
  monthlyExpenses: number | null; runwayMonths: number | null; goals: GoalSummary[];
  assetGroups: { label: string; value: number | null; color: string }[];
  attention: { title: string; detail: string; href: string; action: string }[];
  updatedAt: string; dataNote: string; cashFlowBasis: string;
};
const money = (value: number | null) => value === null ? "Unavailable" : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);

export default function BaselineDashboard(props: Props) {
  let projected: number | null = null;
  try { if(props.trajectory && props.netWorth !== null) projected=wealthTrajectory(props.netWorth,props.trajectory).at(-1)!.base; } catch {}
  const positiveAssets = props.assetGroups.filter(group => group.value !== null && group.value > 0);
  const assetTotal = positiveAssets.reduce((sum, group) => sum + group.value!, 0);
  const stops = positiveAssets.map((group, index) => {
    const start = positiveAssets.slice(0, index).reduce((sum, item) => sum + item.value!, 0) / assetTotal * 100;
    return `${group.color} ${start}% ${start + group.value! / assetTotal * 100}%`;
  });
  const actions = props.attention.length ? props.attention.slice(0, 3) : [{ title: "Review your financial records", detail: "Keep balances and recurring cash flow current before comparing long-term decisions.", href: "/financial-profile", action: "Review position" }];
  const metrics = [
    { label: "Known net position", value: money(props.netWorth), detail: "From confirmed records", href: "/financial-profile", icon: CircleDollarSign },
    { label: "Known assets", value: money(props.assets), detail: "What you own", href: "/financial-profile", icon: Landmark },
    { label: "Known liabilities", value: money(props.liabilities), detail: "What you owe", href: "/financial-profile", icon: Scale },
    { label: "Monthly income", value: money(props.monthlyIncome), detail: "From recorded income", href: "/cash-flow", icon: WalletCards },
    { label: "Monthly surplus", value: money(props.monthlySurplus), detail: "Income less expenses", href: "/cash-flow", icon: ChartNoAxesCombined },
    { label: "Cash buffer", value: props.runwayMonths === null ? "Unavailable" : `${props.runwayMonths.toFixed(1)} months`, detail: "Cash / monthly expenses", href: "/cash-flow", icon: CalendarDays },
  ];
  return <main className="command-centre" id="dashboard-content">
    <section className="cc-hero" aria-labelledby="outcome-heading">
      <div className="cc-hero-copy"><p className="cc-eyebrow">Your financial command centre</p><h2 id="outcome-heading">A clearer view of your tomorrow.</h2><p className="cc-outcome">Projected wealth {props.trajectory ? `at age ${props.trajectory.retirementAge}` : "at retirement"}: <strong>{projected === null ? "not yet available" : money(projected)}</strong></p><p className="cc-hero-explanation">{projected === null ? "Set your age and assumptions using the trajectory widget below." : "Illustrative base scenario using your saved assumptions."}</p><Link className="cc-primary" href="/financial-profile/add-data">{props.assets === null || props.monthlyIncome === null ? "Build your financial picture" : "Update financial data"} <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
      <div className="cc-hero-aside"><p>Understand today.<br />Explore tomorrow.<br /><strong>Decide with clarity.</strong></p><span>A brighter tomorrow</span></div>
    </section>
    <section id="now" aria-label="Current financial position" className="cc-kpis">{metrics.map(({ label, value, detail, href, icon: Icon }) => <Link href={href} className="cc-kpi" key={label}><Icon size={21} aria-hidden="true" /><div><h2>{label}</h2><strong>{value}</strong><p>{detail}</p></div></Link>)}</section>
    <details className="cc-data-note cc-details"><summary>About your current financial data</summary><p>{props.dataNote}</p><p>{props.cashFlowBasis}</p><p>Known zero amounts are shown as $0. Missing amounts remain unavailable. Page-view time is not the verification date of each source record.</p></details>
    <div className="cc-overview-grid">
      <section className="cc-card" aria-labelledby="composition-heading"><p className="cc-eyebrow">01 / Now</p><h2 id="composition-heading">Your assets and liabilities</h2><div className="cc-composition"><div className="cc-donut" role="img" aria-label={assetTotal > 0 ? "Composition of known positive asset balances; exact amounts are listed alongside." : "Asset composition unavailable"} style={{ background: stops.length ? `conic-gradient(${stops.join(",")})` : "#e6ebf1" }}><div><strong>{money(props.assets)}</strong><span>Known assets</span></div></div><dl>{props.assetGroups.map(group => <div key={group.label}><dt><i style={{ background: group.color }} />{group.label}</dt><dd>{money(group.value)}</dd></div>)}</dl></div><div className="cc-total"><span>Known liabilities</span><strong>{money(props.liabilities)}</strong></div><Link className="cc-text-link" href="/financial-profile">Review financial position <ArrowUpRight size={14} aria-hidden="true" /></Link></section>
      <WealthTrajectory settings={props.trajectory} netWorth={props.netWorth} />
      <section className="cc-card" aria-labelledby="retirement-heading"><p className="cc-eyebrow">Your destination</p><h2 id="retirement-heading">Retirement outlook</h2><div className="cc-retirement-status"><Target size={28} aria-hidden="true" /><strong>Not assessed</strong><span>Target age {props.trajectory?.retirementAge ?? "not set"}</span></div><p className="cc-muted">A retirement spending target and a verified projection are needed to assess readiness.</p><details className="cc-details"><summary>How readiness is assessed</summary><p>A verified personal forecast must be compared with your retirement spending target. Your cash buffer measures current expenses only; it is not retirement readiness.</p></details><Link href="/goals" className="cc-text-link">Review retirement goal <ArrowUpRight size={14} aria-hidden="true" /></Link></section>
    </div>
    <div className="cc-action-grid">
      <section className="cc-card" id="improve" aria-labelledby="actions-heading"><p className="cc-eyebrow">03 / Improve</p><h2 id="actions-heading">Key actions for your wealth</h2><p className="cc-muted">Start with the information that makes decisions reliable.</p><ol className="cc-actions">{actions.map((action, index) => <li key={`${action.title}-${index}`}><span>{index + 1}</span><div><h3>{action.title}</h3><details className="cc-details"><summary>Why this matters</summary><p>{action.detail}</p></details><Link className="cc-text-link" href={action.href}>{action.action} <ArrowUpRight size={14} aria-hidden="true" /></Link></div></li>)}</ol><p className="cc-muted">Age-65 benefits are not ranked until a personal projection is available.</p></section>
      <DecisionImpactTester />
    </div>
    <div className="cc-bottom-grid"><section className="cc-card" aria-labelledby="goals-heading"><div className="cc-card-title"><h2 id="goals-heading">Your goals</h2><Link className="cc-text-link" href="/goals">View all <ArrowUpRight size={14} aria-hidden="true" /></Link></div>{props.goals.length ? props.goals.slice(0, 2).map(goal => { const progress = goal.target > 0 ? Math.max(0, Math.min(100, goal.current / goal.target * 100)) : null; return <article className="cc-goal" key={goal.id}><h3>{goal.title}</h3><p>{progress === null ? "Target amount needed" : `${money(goal.current)} of ${money(goal.target)}`}</p>{progress !== null && <progress max={100} value={progress} aria-label={`${goal.title} funding progress`} />}<details className="cc-details"><summary>Goal details</summary><p>{goal.risk}</p><p>{goal.opportunity}</p><Link href="/goals">Review goal</Link></details></article>; }) : <p className="cc-muted">No active goals recorded. <Link className="cc-text-link" href="/goals">Set your first goal</Link></p>}</section><section className="cc-card cc-insight" aria-labelledby="insight-heading"><div className="cc-card-title"><h2 id="insight-heading">Latest insight</h2><Sparkles size={20} aria-hidden="true" /></div><p className="cc-eyebrow">From your current records</p><h3>{props.monthlySurplus === null ? "Complete your cash-flow picture" : props.monthlySurplus < 0 ? "Recorded expenses exceed income" : "Understand the surplus available to plan with"}</h3><p>{props.monthlySurplus === null ? "A reliable monthly surplus needs both income and expenses. Review the missing inputs before planning additional commitments." : `Your recorded monthly surplus is ${money(props.monthlySurplus)}. Review its source and coverage before using it in a long-term plan.`}</p><Link href="/cash-flow" className="cc-text-link">Explore cash flow <ArrowUpRight size={14} aria-hidden="true" /></Link></section></div>
    <footer className="cc-footer">Confirmed records describe today. What-if illustrations explore possibilities. Your financial records and saved plan are unchanged by the decision tester.</footer>
  </main>;
}
