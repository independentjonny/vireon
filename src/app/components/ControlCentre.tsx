"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, CircleDollarSign, Landmark, WalletCards, RotateCcw, SlidersHorizontal } from "lucide-react";
import { addControlMonths, controlDate, projectControlPosition, type ControlAssumptions, type ControlGoal, type ControlPosition, type ControlProjection } from "@/lib/controlCentreProjection";
import type { TrajectorySettings } from "@/lib/wealthTrajectory";
import "./control-centre.css";

type Props = { position: ControlPosition; asOf: string; trajectory: TrajectorySettings | null; goals: ControlGoal[] };
const money = (value: number | null) => value === null ? "Not recorded" : new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
const displayDate = (value: string) => Number.isFinite(controlDate(value)) ? new Date(value + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "Choose a date";
const numeric = (value: string) => value.trim() ? Number(value) : NaN;
const difference = (value: number | null, base: number | null, buffer = false) => value === null || base === null ? "Comparison unavailable" : `${value - base >= 0 ? "+" : "−"}${buffer ? `${Math.abs(value - base).toFixed(1)} months` : money(Math.abs(value - base))} vs today`;

function PositionRow({ value, current, projected = false, name }: { value: Pick<ControlProjection, "netPosition" | "monthlySurplus" | "cash" | "buffer"> | null; current: Pick<ControlProjection, "netPosition" | "monthlySurplus" | "cash" | "buffer">; projected?: boolean; name: string }) {
  const cards = [
    { key: "netPosition", label: "Known net position", icon: CircleDollarSign, href: "/#financial-position", detail: "Recorded assets less debts" },
    { key: "monthlySurplus", label: "Monthly surplus", icon: WalletCards, href: "/cash-flow", detail: "Income less recorded expenses" },
    { key: "cash", label: "Cash & savings", icon: Landmark, href: "/accounts", detail: "From confirmed balances" },
    { key: "buffer", label: "Cash buffer", icon: CalendarDays, href: "/cash-flow", detail: "Cash divided by monthly expenses" },
  ] as const;
  return <div className="workspace-metrics" aria-label={name}>{cards.map(({ key, label, icon: Icon, href, detail }) => {
    const amount = value?.[key] ?? null;
    const content = <><div><span>{label}</span><Icon size={18} aria-hidden="true" /></div><strong>{amount === null ? projected ? "Inputs needed" : "Not recorded" : key === "buffer" ? `${amount.toFixed(1)} months` : money(amount)}</strong><p>{projected ? difference(amount, current[key], key === "buffer") : detail}</p>{projected && <small>Modelled · not a confirmed balance</small>}</>;
    return projected ? <article className={`workspace-metric ${amount !== null && amount < 0 ? "control-negative" : ""}`} key={key}>{content}</article> : <Link className="workspace-metric" key={key} href={href}>{content}</Link>;
  })}</div>;
}

export default function ControlCentre({ position, asOf, trajectory, goals: savedGoals }: Props) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(asOf)), maximumDate = addControlMonths(today, 720);
  const initial = {
    start: today, end: addControlMonths(today, 60), incomeChange: "0", expenseChange: "0",
    assetReturn: String(trajectory?.base ?? 0), cashReturn: "0", inflation: String(trajectory?.inflation ?? 0), monthlyInvestment: "0",
    retirementDate: trajectory ? addControlMonths(today, (trajectory.retirementAge - trajectory.currentAge) * 12) : "",
    retirementIncome: "", retirementExpenses: position.monthlyExpenses === null ? "" : String(Math.round(position.monthlyExpenses)),
  };
  const [fields, setFields] = useState(initial), [goals, setGoals] = useState(savedGoals);
  const [openSettings, setOpenSettings] = useState(false);
  const [extraTitle, setExtraTitle] = useState("");
  const current = { netPosition: position.assets === null || position.liabilities === null ? null : position.assets - position.liabilities,
    monthlySurplus: position.monthlyIncome === null || position.monthlyExpenses === null ? null : position.monthlyIncome - position.monthlyExpenses,
    cash: position.cash, buffer: position.cash === null || position.monthlyExpenses === null || position.monthlyExpenses <= 0 ? null : Math.max(0, position.cash) / position.monthlyExpenses };
  let result: ControlProjection | null = null, retirement: ControlProjection | null = null, error = "", retirementError = "";
  const assumptions: ControlAssumptions = { start: fields.start, incomeChange: numeric(fields.incomeChange), expenseChange: numeric(fields.expenseChange),
    assetReturn: numeric(fields.assetReturn), cashReturn: numeric(fields.cashReturn), inflation: numeric(fields.inflation), monthlyInvestment: numeric(fields.monthlyInvestment),
    retirementDate: fields.retirementDate, retirementIncome: fields.retirementIncome.trim() ? numeric(fields.retirementIncome) : null, retirementExpenses: fields.retirementExpenses.trim() ? numeric(fields.retirementExpenses) : null,
    before: { assetReturn: trajectory?.base ?? 0, cashReturn: 0, inflation: trajectory?.inflation ?? 0 } };
  try {
    if (controlDate(fields.end) < controlDate(fields.start)) throw new Error("The end date must be on or after the change start date.");
    result = projectControlPosition(position, today, fields.end, assumptions, goals, savedGoals);
  } catch (e) { error = (e as Error).message; }
  if (fields.retirementDate) {
    try { retirement = projectControlPosition(position, today, fields.retirementDate, assumptions, goals, savedGoals); }
    catch (e) { retirementError = (e as Error).message; }
  }
  const set = (key: keyof typeof fields, value: string) => setFields(old => ({ ...old, [key]: value }));
  const updateGoal = (id: string, change: Partial<ControlGoal>) => setGoals(items => items.map(g => g.id === id ? { ...g, ...change } : g));
  const months = Math.max(0, Math.min(720, Math.round((controlDate(fields.end) - controlDate(fields.start)) / (365.2425 / 12 * 86_400_000)) || 0));
  const input = (key: keyof typeof fields, label: string, options: { min?: number; max?: number; step?: string; hint?: string } = {}) => <label className="control-field">{label}<input aria-label={label} aria-describedby={options.hint ? `control-hint-${key}` : undefined} type="number" value={fields[key]} onChange={e => set(key, e.target.value)} step={options.step ?? "any"} min={options.min} max={options.max} />{options.hint && <small id={`control-hint-${key}`}>{options.hint}</small>}</label>;
  return <div className="control-centre">
    <section aria-labelledby="control-current"><div className="control-row-heading"><div><p className="workspace-eyebrow">01 / Current state</p><h2 id="control-current">Where you stand today</h2></div><p>Recorded information · {displayDate(today)}</p></div><PositionRow value={current} current={current} name="Current financial state" /></section>
    <section className="control-model" aria-labelledby="control-timeframe"><div className="control-row-heading"><div><p className="workspace-eyebrow">02 / Take control</p><h2 id="control-timeframe">Your position over time</h2><p>Change a goal or assumption and see the impact immediately.</p></div><button className="workspace-secondary" type="button" aria-expanded={openSettings} aria-controls="control-settings" onClick={() => setOpenSettings(!openSettings)}><SlidersHorizontal size={16} aria-hidden="true" />Goals & settings</button></div>
      <div className="control-time-controls"><label className="control-field">Changes start<input type="date" min={today} max={maximumDate} value={fields.start} onChange={e => { const value = e.target.value; setFields(old => ({ ...old, start: value, end: old.end < value ? value : old.end })); }} /></label><label className="control-field control-slider">Time frame <strong>{Math.floor(months / 12)} years {months % 12} months</strong><input type="range" min="0" max={Math.max(0, 720 - Math.ceil((controlDate(fields.start) - controlDate(today)) / (365.2425 / 12 * 86_400_000))) || 0} step="1" value={months} aria-label="Projection time frame in months" onChange={e => { if (Number.isFinite(controlDate(fields.start))) set("end", addControlMonths(fields.start, Number(e.target.value))); }} /></label><label className="control-field">View position on<input type="date" min={fields.start || today} max={maximumDate} value={fields.end} onChange={e => set("end", e.target.value)} /></label></div>
      <p className="control-caption">Preview at {displayDate(fields.end)} · changes apply from {displayDate(fields.start)}. Figures before then use your current income and expenses.</p>
      {error && <p role="alert" className="control-alert">{error}</p>}
      <PositionRow value={result} current={current} projected name="Projected financial state at selected date" />
      {result && <p className="control-cash-note">After planned allocations: <strong>{money(result.afterAllocations)}/month</strong> · Goal and investment allocations: {money(result.allocation)}/month.{result.cash !== null && result.cash < 0 ? " Cash is exhausted: the negative balance is a funding gap, not an available account balance." : ""}{result.unfunded > 0 ? ` ${money(result.unfunded)} of planned allocations could not be funded from available cash.` : ""}</p>}
      <div id="control-settings" hidden={!openSettings} className="control-settings">
        <div className="control-section-heading"><h3>Model settings</h3><button type="button" className="workspace-link" onClick={() => { setFields(initial); setGoals(savedGoals); }}><RotateCcw size={14} aria-hidden="true" />Reset preview</button></div>
        <p className="control-caption">Starting with your recorded balances and {trajectory ? "saved growth and inflation assumptions" : "0% growth and inflation until you choose assumptions"}. Monthly surplus builds cash; annual additions from the older wealth illustration are not added again.</p>
        <div className="control-fields">{input("incomeChange", "Monthly income change ($)", { hint: "After tax. Positive increases income; negative reduces it." })}{input("expenseChange", "Monthly expense change ($)", { hint: "Positive increases spending; negative reduces it." })}{input("monthlyInvestment", "Extra investment transfer ($/month)", { min: 0, hint: "Moves cash into non-cash assets; does not create new wealth." })}{input("assetReturn", "Non-cash asset growth (%/year)", { min: -50, max: 50 })}{input("cashReturn", "Cash interest (%/year)", { min: -50, max: 50 })}{input("inflation", "Expense inflation (%/year)", { min: 0, max: 25 })}</div>
        <div className="control-section-heading"><h3>Goals in this preview</h3><Link href="/goals" className="workspace-link">Manage saved goals →</Link></div><p className="control-caption">Edit target, date and monthly funding here. These are preview changes. Reserve keeps money in cash; Invest transfers it to assets; Spend reduces wealth; Repay reduces cash and debt together.</p>
        {goals.length === 0 && <p>No saved active goals yet. Add a preview goal below, or create one in Goals.</p>}
        <div className="control-goals">{goals.map(goal => { const remainingMonths = goal.date ? Math.max(1, (controlDate(goal.date) - controlDate(fields.start)) / (365.2425 / 12 * 86_400_000)) : null; return <fieldset key={goal.id} className="control-goal"><legend><label><input type="checkbox" checked={goal.enabled} onChange={e => updateGoal(goal.id, { enabled: e.target.checked })} />{goal.title}</label></legend><div className="control-fields"><label className="control-field">Target ($)<input type="number" min="0" value={Number.isNaN(goal.target) ? "" : goal.target} onChange={e => updateGoal(goal.id, { target: numeric(e.target.value) })} /></label><label className="control-field">Target date<input type="date" min={today} max={maximumDate} value={goal.date} onChange={e => updateGoal(goal.id, { date: e.target.value })} /></label><label className="control-field">Monthly allocation ($)<input type="number" min="0" value={Number.isNaN(goal.monthly) ? "" : goal.monthly} onChange={e => updateGoal(goal.id, { monthly: numeric(e.target.value) })} /></label><label className="control-field">Cash effect<select value={goal.effect} onChange={e => updateGoal(goal.id, { effect: e.target.value as ControlGoal["effect"] })}><option value="reserve">Reserve in cash</option><option value="invest">Invest</option><option value="spend">Spend</option><option value="repay">Repay debt</option></select></label></div><p className="control-caption">Recorded progress: {money(goal.current)} · Modelled funded: {money(result?.goals[goal.id] ?? null)}{remainingMonths !== null && Number.isFinite(remainingMonths) && <><br />To reach the target from its recorded progress: {money(Math.max(0, goal.target - goal.current) / remainingMonths)}/month <button type="button" className="workspace-link" onClick={() => updateGoal(goal.id, { monthly: Math.ceil(Math.max(0, goal.target - goal.current) / remainingMonths) })}>Use this amount</button></>}</p></fieldset>; })}</div>
        <form className="control-add-goal" onSubmit={e => { e.preventDefault(); if (!extraTitle.trim()) return; setGoals(items => [...items, { id: `preview-${crypto.randomUUID()}`, title: extraTitle.trim(), target: 10000, current: 0, monthly: 0, date: fields.end, enabled: true, effect: "reserve" }]); setExtraTitle(""); }}><label className="control-field">New preview goal<input value={extraTitle} maxLength={120} onChange={e => setExtraTitle(e.target.value)} placeholder="e.g. Build a six-month cash buffer" required /></label><button className="workspace-secondary" type="submit">Add preview goal</button></form>
      </div>
    </section>
    <section className="control-retirement" aria-labelledby="control-retirement"><div className="control-row-heading"><div><p className="workspace-eyebrow">03 / Retirement</p><h2 id="control-retirement">Your position at retirement</h2><p>Balances at retirement and your first retired month’s cash flow.</p></div><Link className="workspace-link" href="/goals?edit=retirement#retirement">Edit saved retirement plan →</Link></div>
      <div className="control-fields"><label className="control-field">Retirement date<input type="date" min={today} max={maximumDate} value={fields.retirementDate} onChange={e => set("retirementDate", e.target.value)} /></label>{input("retirementIncome", "Retirement income ($/month)", { min: 0, hint: "In today’s dollars. Include only income you expect to receive." })}{input("retirementExpenses", "Retirement expenses ($/month)", { min: 0, hint: "In today’s dollars. Initially your current recorded expenses." })}</div>
      {!fields.retirementDate && <p className="control-caption">Choose a retirement date to calculate this row.</p>}{fields.retirementDate && !fields.retirementIncome.trim() && <p className="control-caption">Enter expected retirement income, including an explicit $0 if appropriate, to calculate retirement surplus.</p>}{retirementError && <p role="alert" className="control-alert">{retirementError}</p>}
      <PositionRow value={retirement} current={current} projected name="Projected financial state at retirement" />
    </section>
    <details className="control-method"><summary>How this model works</summary><p>Nominal AUD, monthly compounding with partial months. Cash receives income less expenses; non-cash assets use the selected aggregate growth rate. Income and expense changes begin on your selected start date. Expenses grow with inflation. Retirement replaces salary with your entered income; retirement amounts are in today’s dollars and grow with inflation.</p><p>Goal targets and recorded progress are not additional assets. Funding stops at the target amount or target date. Investment and debt transfers are limited by available cash; cash shortfalls remain visible. Monthly surplus is recurring income less expenses, before goal allocations. Savings goals earmark cash rather than spending it.</p><p>Recorded debts remain constant except for preview debt goals; this model does not infer principal repayment from recorded expenses. It excludes tax changes, fees, asset sales, borrowing, superannuation access rules and retirement drawdown strategies. Growth is an assumption, not a forecast or a retirement-readiness assessment. Missing current inputs stay unknown. Preview edits reset when you leave; use Goals to manage your saved plan.</p></details>
  </div>;
}
