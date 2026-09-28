
export type TrajectorySettings = { currentAge: number; retirementAge: number; annualAddition: number; low: number; base: number; high: number; inflation: number; complete: boolean; updatedAt?: string };
export function validateTrajectory(s: TrajectorySettings) {
  if (!s || s.complete !== true) throw new Error("Confirm your recorded assets and debts cover your current position.");
  for (const k of ["currentAge","retirementAge","annualAddition","low","base","high","inflation"] as const) if (typeof s[k] !== "number" || !Number.isFinite(s[k])) throw new Error("Complete every projection input.");
  if (!Number.isInteger(s.currentAge) || !Number.isInteger(s.retirementAge) || s.currentAge < 18 || s.retirementAge > 100 || s.retirementAge <= s.currentAge) throw new Error("Retirement age must be a whole number after your current age, up to 100.");
  if (Math.abs(s.annualAddition) > 1e8 || s.low < -50 || s.high > 50 || s.low > s.base || s.base > s.high || s.inflation < 0 || s.inflation > 25) throw new Error("Check the assumptions: ordered growth rates between -50% and 50%, and inflation between 0% and 25%.");
}
export function wealthTrajectory(netWorth: number, s: TrajectorySettings) {
  validateTrajectory(s);
  if (!Number.isFinite(netWorth) || netWorth < 0) throw new Error("A non-negative confirmed net position is needed for this simple illustration.");
  const values = { low: netWorth, base: netWorth, high: netWorth };
  return Array.from({length:s.retirementAge-s.currentAge+1},(_,year)=>{
    if(year) for(const key of ["low","base","high"] as const) values[key]=values[key]*(1+s[key]/100)+s.annualAddition;
    return { age:s.currentAge+year, ...values, realBase:values.base/Math.pow(1+s.inflation/100,year) };
  });
}
