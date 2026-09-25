/** An isolated what-if illustration. Never used as a personal retirement forecast. */
export type DecisionImpactInput = { currentAge: number; amount: number; annualReturn: number; direction: "add" | "spend" };

export function decisionImpact(input: DecisionImpactInput) {
  const { currentAge, amount, annualReturn, direction } = input;
  if (![currentAge, amount, annualReturn].every(Number.isFinite)
    || !Number.isInteger(currentAge) || currentAge < 0 || currentAge > 65
    || amount < 0 || annualReturn <= -100 || (direction !== "add" && direction !== "spend")) return null;
  const years = 65 - currentAge;
  const futureValue = amount * Math.pow(1 + annualReturn / 100, years);
  if (!Number.isFinite(futureValue)) return null;
  const sign = direction === "add" ? 1 : -1;
  return {
    years, futureValue, impact: sign * futureValue,
    growth: futureValue - amount,
    yearly: Array.from({ length: years + 1 }, (_, year) => ({ age: currentAge + year, value: sign * amount * Math.pow(1 + annualReturn / 100, year) })),
  };
}
