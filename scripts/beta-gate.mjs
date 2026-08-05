import { buildFinancialHealthSnapshot } from "../src/lib/financialHealthEngine.ts";
import { FinancialForecastingEngine } from "../src/lib/financialForecasting.ts";
import { GoalPlanningEngine, createGoal } from "../src/lib/goalPlanning.ts";
import { BetaHardening } from "../src/lib/betaHardening.ts";
import { PrivateBetaFoundation } from "../src/lib/privateBetaFoundation.ts";

const now = "2026-07-24T00:00:00.000Z";

function record(input) {
  return {
    id: input.id ?? `golden-${input.kind}-${input.label.replace(/\s+/g, "-").toLowerCase()}`,
    userId: "beta-gate-user",
    kind: input.kind,
    subtype: input.subtype ?? input.kind,
    label: input.label,
    value: input.value,
    provenance: { ingestionId: "synthetic-golden", sourceField: "golden-fixture", confidence: 1, userConfirmed: true, sourceType: "MANUAL" },
    createdAt: now,
    updatedAt: now,
    superseded: false,
    approximate: false,
    history: [],
  };
}

const records = [
  record({ kind: "income", label: "Salary", value: { monthlyAmount: 12000 } }),
  record({ kind: "account", label: "Offset account", value: { balance: 42000 } }),
  record({ kind: "expense", label: "Household spending", value: { monthlyAmount: 6500 } }),
  record({ kind: "liability", label: "Mortgage", subtype: "mortgage", value: { balance: 720000, interestRate: 5.9, monthlyRepayment: 4200 } }),
  record({ kind: "asset", label: "Home", subtype: "property", value: { marketValue: 1100000 } }),
];

const config = PrivateBetaFoundation.configFromEnv();
const health = buildFinancialHealthSnapshot({ userId: "beta-gate-user", records, asOf: now });
const forecast = FinancialForecastingEngine.generate(FinancialForecastingEngine.buildInput({ userId: "beta-gate-user", records, startDate: "2026-07-24", horizon: "12m" }));
const goal = createGoal({ userId: "beta-gate-user", type: "EMERGENCY_FUND", title: "Emergency buffer", targetAmount: 30000, currentAmount: 12000, targetDate: "2027-07-24", contributionAmount: 1000, contributionFrequency: "monthly" });
const goals = GoalPlanningEngine.buildSnapshot({ userId: "beta-gate-user", goals: [goal], forecast });
const golden = BetaHardening.verifyGoldenCalculations({ health, forecast, goals });
const consistency = BetaHardening.verifyCrossEngineConsistency({ health, forecast, goals });
const gate = BetaHardening.buildLaunchGate({ config, golden, consistency, securityFindings: BetaHardening.buildSecurityReview() });

console.log(JSON.stringify({ status: gate.status, blocked: gate.blocked, reasons: gate.reasons, gate, golden, consistency }, null, 2));

if (gate.blocked) {
  console.error("PRIVATE BETA LAUNCH BLOCKED");
  process.exit(1);
}

console.log("PRIVATE BETA LAUNCH GATE READY");
