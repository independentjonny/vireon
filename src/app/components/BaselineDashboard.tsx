import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CircleDollarSign, WalletCards, CalendarDays, Landmark, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";
import type { TrajectorySettings } from "@/lib/wealthTrajectory";
import { setupProgress } from "@/lib/setupProgress";
import SetupChecklist from "./SetupChecklist";
import WealthTrajectory from "./WealthTrajectory";
import DecisionImpactTester from "./DecisionImpactTester";
import "./command-centre.css";

type GoalSummary = { id: string; title: string; current: number; target: number; targetDate: string | null; status: string; risk: string; opportunity: string };
type Props = {
  title?: string;
  controlCentre?: ReactNode;
  financialPosition: ReactNode;
  trajectory: TrajectorySettings | null;
  netWorth: number | null; assets: number | null; liabilities: number | null;
  monthlyChange: number | null; monthlySurplus: number | null; monthlyIncome: number | null;
  monthlyExpenses: number | null; runwayMonths: number | null; goals: GoalSummary[];
  assetGroups: { label: string; value: number | null; color: string }[];
  attention: { title: string; detail: string; href: string; action: string }[];
  updatedAt: string; dataNote: string; cashFlowBasis: string; staleRecordIds: string[]; records: CanonicalFinancialRecord[];
};
const money = (value: number | null) => value === null ? "Not recorded" : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
const date = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" }) : "Date not recorded";

export default function BaselineDashboard(props: Props) {
  const coverage = setupProgress(props.records.filter(record => !props.staleRecordIds.includes(record.id)), Date.parse(props.updatedAt));
  const deficit = props.monthlySurplus !== null && props.monthlySurplus < 0;
  const priority = deficit
    ? { title: "Review the gap in your monthly cash flow", detail: `Recorded expenses exceed income by ${money(Math.abs(props.monthlySurplus!))} a month. Check the source amounts before planning new commitments.`, href: "/cash-flow", action: "Review cash flow" }
    : props.attention[0] ?? (coverage.next
      ? { title: coverage.next.label, detail: coverage.next.detail, href: coverage.next.href, action: "Continue setup" }
      : { title: "Check your position before your next decision", detail: "Review your source dates and coverage, then explore how a change could affect your plan.", href: "/financial-profile", action: "Review your position" });
  const metrics = [
    { label: "Known net position", value: money(props.netWorth), detail: "Recorded assets less debts", href: "/financial-profile", icon: CircleDollarSign },
    { label: "Monthly surplus", value: money(props.monthlySurplus), detail: deficit ? "Expenses exceed income" : "Income less recorded expenses", href: "/cash-flow", icon: WalletCards },
    { label: "Cash & savings", value: money(props.assetGroups[2]?.value ?? null), detail: "From confirmed balances", href: "/accounts", icon: Landmark },
    { label: "Cash buffer", value: props.runwayMonths === null ? "Not recorded" : `${props.runwayMonths.toFixed(1)} months`, detail: "Cash divided by monthly expenses", href: "/cash-flow", icon: CalendarDays },
  ];
  const sourceDates = props.records.map(record => record.updatedAt).filter(value => Number.isFinite(Date.parse(value))).sort();
  const latest = sourceDates.at(-1);
  const comparable = props.monthlyIncome !== null && props.monthlyExpenses !== null;
  const maximum = Math.max(props.monthlyIncome ?? 0, props.monthlyExpenses ?? 0, 1);
  const secondary = props.attention.filter(action => action.title !== priority.title).slice(0, 3);
  return <main className="workspace-dashboard" id="dashboard-content">
    <header className="workspace-page-heading"><div><p className="workspace-eyebrow">Your financial workspace</p><h1>{props.title ?? "Your money, with a clearer next step"}</h1><p>{props.controlCentre ? "See where you stand. Change your plan. See the impact." : "Your current position and the information to act on."}</p></div><Link href="/financial-profile/add-data" className="workspace-secondary">Update financial data</Link></header>
    {props.controlCentre ?? <section className="workspace-metrics" aria-label="Current financial position">{metrics.map(({ label, value, detail, href, icon: Icon }) => <Link href={href} key={label} className="workspace-metric"><div><span>{label}</span><Icon size={18} aria-hidden="true" /></div><strong>{value}</strong><p>{detail}</p></Link>)}</section>}
    {props.financialPosition}
    {coverage.recorded < 3 && <SetupChecklist records={props.records.filter(record => !props.staleRecordIds.includes(record.id))} now={Date.parse(props.updatedAt)} />}
    <div className="workspace-two-columns">
      <section className="workspace-panel" aria-labelledby="cashflow-heading"><p className="workspace-eyebrow">Where you stand</p><h2 id="cashflow-heading">Your monthly cash flow</h2><p>Current recorded amounts, shown as monthly equivalents.</p>{comparable ? <><dl className="workspace-cash-bars">{[{ label: "Income after tax", value: props.monthlyIncome!, className: "income" }, { label: "Expenses & repayments", value: props.monthlyExpenses!, className: "expenses" }].map(item => <div key={item.label}><dt>{item.label}</dt><dd>{money(item.value)}</dd><div aria-hidden="true"><span className={item.className} style={{ width: `${Math.max(0, item.value / maximum * 100)}%` }} /></div></div>)}</dl><p className={deficit ? "workspace-warning" : "workspace-status"}>{deficit ? <AlertTriangle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}{money(props.monthlySurplus)} {deficit ? "monthly shortfall" : "monthly surplus"}</p></> : <p className="workspace-empty-note">Add income and expenses to see what is available each month. Missing amounts are not treated as zero.</p>}<Link className="workspace-link" href="/cash-flow">View cash flow and sources<ArrowRight size={15} aria-hidden="true" /></Link></section>
      <section className="workspace-panel"><p className="workspace-eyebrow">What changed?</p><h2>Your latest recorded information</h2><p>{latest ? `The most recent record update was ${date(latest)}.` : "Record dates will appear when you confirm information."}</p><p className="workspace-muted">This is a current snapshot. A change in net worth needs comparable historical balances; no change is inferred from a new entry.</p><dl className="workspace-totals"><div><dt>Known assets</dt><dd>{money(props.assets)}</dd></div><div><dt>Known debts</dt><dd>{money(props.liabilities)}</dd></div></dl><Link className="workspace-link" href="/financial-profile">Review recorded balances<ArrowRight size={15} aria-hidden="true" /></Link></section>
    </div>
    {secondary.length > 0 && <section className="workspace-panel"><h2>Also worth your attention</h2><ul className="workspace-action-list">{secondary.map(action => <li key={action.title}><div><h3>{action.title}</h3><p>{action.detail}</p></div><Link className="workspace-link" href={action.href}>{action.action}<ArrowRight size={15} aria-hidden="true" /></Link></li>)}</ul></section>}
    <div className="workspace-two-columns"><section className="workspace-panel"><h2>Your goals</h2>{props.goals.length ? props.goals.slice(0, 2).map(goal => <article className="workspace-goal" key={goal.id}><h3>{goal.title}</h3><p>{money(goal.current)} of {money(goal.target)}</p>{goal.target > 0 && <progress max={100} value={Math.max(0, Math.min(100, goal.current / goal.target * 100))} aria-label={`${goal.title} funding progress`} />}<p className="workspace-muted">{goal.risk}</p></article>) : <p>Give your next decision a destination. Set a savings, housing or retirement goal.</p>}<Link href="/goals" className="workspace-link">{props.goals.length ? "Review goals" : "Set your first goal"}<ArrowRight size={15} aria-hidden="true" /></Link></section><section className="workspace-panel workspace-adviser"><p className="workspace-eyebrow">Make sense of your options</p><h2>Ask your AI adviser</h2><p>Explore a financial question using your recorded information. Review the evidence and assumptions behind each answer.</p><Link href="/ai-cfo" className="workspace-link">Open AI adviser<ArrowRight size={15} aria-hidden="true" /></Link><Link href="/digital-twin" className="workspace-link">Explore financial scenarios<ArrowRight size={15} aria-hidden="true" /></Link></section></div>
    <details className="workspace-panel workspace-evidence" id="financial-evidence"><summary>Sources, dates & coverage</summary><p>{props.dataNote}</p><p>{props.cashFlowBasis}</p><p>Confirmed zero amounts appear as $0. Missing values stay unknown. Record updates and effective dates are distinct from the time you opened this page.</p><ul>{props.records.map(record => <li key={record.id}><strong>{record.label}</strong><span>{props.staleRecordIds.includes(record.id) ? "Out of date · needs review" : record.approximate ? "Estimate · needs review" : "Confirmed"} · {typeof record.value.sourceName === "string" ? record.value.sourceName : record.provenance.sourceType === "MANUAL" ? "Manual entry" : "Imported record"}</span><span>Effective: {typeof record.value.asOfDate === "string" ? date(record.value.asOfDate) : "Not recorded"} · Updated: {date(record.updatedAt)}</span></li>)}</ul><Link className="workspace-link" href="/financial-profile/add-data">Review source records<ArrowRight size={15} aria-hidden="true" /></Link></details>
    <details className="workspace-panel workspace-explore"><summary>Explore your longer-term options</summary><p>Illustrations use your saved assumptions. They are separate from confirmed balances.</p><div className="workspace-two-columns"><WealthTrajectory settings={props.trajectory} netWorth={props.netWorth} /><DecisionImpactTester /></div></details>
    <section className={`workspace-priority ${deficit ? "needs-attention" : ""}`} aria-labelledby="priority-heading"><div><p className="workspace-eyebrow">Your next step</p><h2 id="priority-heading">{priority.title}</h2><p>{priority.detail}</p><Link className="workspace-primary" href={priority.href}>{priority.action}<ArrowRight size={16} aria-hidden="true" /></Link></div><aside><span className="workspace-status"><CheckCircle2 size={16} aria-hidden="true" />Confirmed records</span><strong>{props.records.length} record{props.records.length === 1 ? "" : "s"} in your picture</strong><p>{latest ? `Latest record updated ${date(latest)}` : "No source update date available"}</p><Link href="#financial-evidence" className="workspace-link">Check sources & coverage<ArrowRight size={14} aria-hidden="true" /></Link></aside></section>
  </main>;
}
