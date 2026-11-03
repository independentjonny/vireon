export type RetirementGoals = { retirementDate: string; monthlyIncome: number; monthlyExpenses: number; updatedAt?: string };
export function validateRetirementGoals(value: RetirementGoals): void {
  if (!value || Object.keys(value).some(key => !["retirementDate","monthlyIncome","monthlyExpenses","updatedAt"].includes(key))) throw new Error("Check your retirement goal settings.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.retirementDate) || !Number.isFinite(Date.parse(value.retirementDate)) || new Date(value.retirementDate).toISOString().slice(0,10) !== value.retirementDate) throw new Error("Choose a valid retirement date.");
  for (const amount of [value.monthlyIncome,value.monthlyExpenses]) if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > 1e8 || Math.abs(amount*100-Math.round(amount*100)) > .00001) throw new Error("Enter retirement monthly amounts in dollars and cents, including zero where appropriate.");
}
