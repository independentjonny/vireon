/** Deterministic preview only. Never writes financial facts or saved goals. */
export type ControlPosition = {
  assets: number | null; liabilities: number | null; cash: number | null;
  monthlyIncome: number | null; monthlyExpenses: number | null;
};
export type ControlGoal = {
  id: string; title: string; target: number; current: number; monthly: number;
  date: string; enabled: boolean; effect: "reserve" | "invest" | "spend" | "repay";
};
export type ControlAssumptions = {
  start: string; incomeChange: number; expenseChange: number;
  assetReturn: number; cashReturn: number; inflation: number; monthlyInvestment: number;
  retirementDate: string; retirementIncome: number | null; retirementExpenses: number | null;
  before?: { assetReturn: number; cashReturn: number; inflation: number };
};
export type ControlProjection = {
  netPosition: number | null; monthlySurplus: number | null; cash: number | null;
  buffer: number | null; monthlyExpenses: number | null; allocation: number;
  afterAllocations: number | null; unfunded: number; goals: Record<string, number>;
};
const DAY = 86_400_000;
const MONTH = 365.2425 / 12 * DAY;
export function controlDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}
export function addControlMonths(value: string, months: number): string {
  const time = controlDate(value);
  if (!Number.isFinite(time) || !Number.isInteger(months)) throw new Error("Choose a valid date and whole months.");
  const date = new Date(time), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}
export function projectControlPosition(position: ControlPosition, asOf: string, end: string, a: ControlAssumptions, goals: ControlGoal[], baselineGoals: ControlGoal[] = []): ControlProjection {
  const origin = controlDate(asOf), until = controlDate(end), start = controlDate(a.start);
  const retirement = a.retirementDate ? controlDate(a.retirementDate) : Infinity;
  if (![origin, until, start].every(Number.isFinite) || until < origin || start < origin || until > controlDate(addControlMonths(asOf, 720)) || (a.retirementDate && (!Number.isFinite(retirement) || retirement < origin))) throw new Error("Choose dates from today to 60 years ahead.");
  const numbers = [a.incomeChange, a.expenseChange, a.assetReturn, a.cashReturn, a.inflation, a.monthlyInvestment];
  if (a.before && (!Object.values(a.before).every(Number.isFinite) || a.before.assetReturn < -50 || a.before.assetReturn > 50 || a.before.cashReturn < -50 || a.before.cashReturn > 50 || a.before.inflation < 0 || a.before.inflation > 25)) throw new Error("Check the starting growth and inflation assumptions.");
  if (!numbers.every(Number.isFinite) || a.assetReturn < -50 || a.assetReturn > 50 || a.cashReturn < -50 || a.cashReturn > 50 || a.inflation < 0 || a.inflation > 25 || a.monthlyInvestment < 0 || a.monthlyInvestment > 1e8 || Math.abs(a.incomeChange) > 1e8 || Math.abs(a.expenseChange) > 1e8) throw new Error("Check your assumptions: returns −50% to 50%, inflation 0% to 25%, and finite amounts up to $100 million.");
  for (const value of [a.retirementIncome, a.retirementExpenses]) if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1e8)) throw new Error("Retirement income and expenses must be non-negative amounts up to $100 million.");
  for (const value of Object.values(position)) if (value !== null && !Number.isFinite(value)) throw new Error("Current financial amounts must be finite or unknown.");
  for (const g of [...goals, ...baselineGoals].filter(g => g.enabled)) if (![g.target, g.current, g.monthly].every(n => Number.isFinite(n) && n >= 0 && n <= 1e8) || (g.date && !Number.isFinite(controlDate(g.date)))) throw new Error("Check goal amounts and target dates.");
  let cash = position.cash;
  let nonCash = position.assets === null || cash === null ? null : position.assets - cash;
  let debt = position.liabilities;
  const funded = Object.fromEntries(goals.map(g => [g.id, g.current]));
  let unfunded = 0, reserved = 0;
  function flow(time: number) {
    const active = time >= start, retired = time >= retirement;
    const beforeYears = Math.max(0, Math.min(time, start) - origin) / (365.2425 * DAY);
    const afterYears = Math.max(0, time - start) / (365.2425 * DAY);
    const inflation = Math.pow(1 + (a.before?.inflation ?? a.inflation) / 100, beforeYears) * Math.pow(1 + a.inflation / 100, afterYears);
    const income = retired ? a.retirementIncome : position.monthlyIncome === null ? null : Math.max(0, position.monthlyIncome + (active ? a.incomeChange : 0));
    // Retirement amounts are in today's dollars. Salary stays nominal until retirement.
    const expenses = retired ? a.retirementExpenses === null ? null : a.retirementExpenses * inflation : position.monthlyExpenses === null ? null : Math.max(0, position.monthlyExpenses + (active ? a.expenseChange : 0)) * inflation;
    const surplus = income === null || expenses === null ? null : income * (retired ? inflation : 1) - expenses;
    return { surplus, expenses, active, retired };
  }
  let time = origin;
  while (time < until) {
    let next = Math.min(until, time + MONTH);
    // Split at effective dates so a future setting never affects earlier balances.
    for (const boundary of [start, retirement, ...[...goals, ...baselineGoals].filter(g => g.date).map(g => controlDate(g.date) + DAY)]) if (boundary > time && boundary < next) next = boundary;
    const fraction = (next - time) / MONTH, f = flow(time);
    const assetReturn = f.active ? a.assetReturn : a.before?.assetReturn ?? a.assetReturn;
    const cashReturn = f.active ? a.cashReturn : a.before?.cashReturn ?? a.cashReturn;
    if (nonCash !== null) nonCash *= Math.pow(1 + assetReturn / 100, fraction / 12);
    if (cash !== null) cash *= cash > 0 ? Math.pow(1 + cashReturn / 100, fraction / 12) : 1;
    if (cash !== null) cash = f.surplus === null ? null : cash + f.surplus * fraction;
    {
      const investment = !f.active || f.retired ? 0 : a.monthlyInvestment * fraction;
      if (cash !== null && nonCash !== null) { const transfer = Math.min(Math.max(0, cash - reserved), investment); cash -= transfer; nonCash += transfer; unfunded += investment - transfer; }
      for (const goal of f.active ? goals : baselineGoals) {
        if (!goal.enabled || (goal.date && time > controlDate(goal.date)) || funded[goal.id] >= goal.target) continue;
        const amount = Math.min(goal.monthly * fraction, Math.max(0, goal.target - funded[goal.id]));
        // Missing cash or debt cannot be converted into a funded goal.
        if (cash === null || (goal.effect === "repay" && debt === null) || (goal.effect === "invest" && nonCash === null)) { unfunded += amount; continue; }
        const available = Math.min(amount, Math.max(0, cash - reserved), goal.effect === "repay" ? debt! : Infinity);
        funded[goal.id] += available; unfunded += amount - available;
        if (goal.effect === "invest") { cash -= available; nonCash! += available; }
        else if (goal.effect === "spend") cash -= available;
        else if (goal.effect === "repay") { cash -= available; debt! -= available; }
        else reserved += available;
        // A reserve goal earmarks cash; the cash remains part of cash & savings.
      }
    }
    time = next;
  }
  const f = flow(until);
  const allocation = f.active ? (f.retired ? 0 : a.monthlyInvestment) + goals.filter(g => g.enabled && (!g.date || until <= controlDate(g.date)) && funded[g.id] < g.target).reduce((sum, g) => sum + g.monthly, 0) : 0;
  return { netPosition: nonCash === null || cash === null || debt === null ? null : nonCash + cash - debt,
    monthlySurplus: f.surplus, cash, buffer: cash === null || f.expenses === null || f.expenses <= 0 ? null : Math.max(0, cash) / f.expenses,
    monthlyExpenses: f.expenses, allocation, afterAllocations: f.surplus === null ? null : f.surplus - allocation, unfunded, goals: funded };
}
