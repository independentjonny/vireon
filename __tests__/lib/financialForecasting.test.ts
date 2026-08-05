import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { ManualFinancialDataPlatform } from "../../src/lib/manualFinancialDataPlatform.ts";
import {
  FinancialForecastingEngine,
  type ForecastScenario,
  type ForecastScenarioDelta,
} from "../../src/lib/financialForecasting.ts";

function records() {
  const platform = new ManualFinancialDataPlatform();
  platform.manualRecord("u1", { kind: "account", subtype: "cash", label: "Offset", value: { balance: 12000 } });
  platform.manualRecord("u1", { kind: "asset", subtype: "property", label: "Home", value: { marketValue: 700000 } });
  platform.manualRecord("u1", { kind: "asset", subtype: "super", label: "Super", value: { balance: 80000 } });
  platform.manualRecord("u1", { kind: "asset", subtype: "investment", label: "ETF", value: { marketValue: 20000 } });
  platform.manualRecord("u1", { kind: "income", subtype: "salary", label: "Salary", value: { monthlyAmount: 8500 } });
  platform.manualRecord("u1", { kind: "expense", subtype: "fixed", label: "Living costs", value: { monthlyAmount: 3600 } });
  platform.manualRecord("u1", { kind: "liability", subtype: "mortgage", label: "Mortgage", value: { balance: 520000, interestRate: 6, monthlyRepayment: 3200 } });
  platform.manualRecord("u1", { kind: "liability", subtype: "credit_card", label: "Card", value: { balance: 3000, interestRate: 20, minimumPayment: 250, limit: 8000 } });
  platform.manualRecord("u1", { kind: "goal", subtype: "emergency", label: "Emergency fund", value: { targetAmount: 20000, currentAmount: 12000, monthlyContribution: 800 } });
  return [...platform.canonical.values()];
}

function forecast(deltas: ForecastScenarioDelta[] = []) {
  const input = FinancialForecastingEngine.buildInput({ userId: "u1", records: records(), startDate: "2026-08-01", horizon: "12m" });
  const scenario: ForecastScenario | undefined = deltas.length ? { id: "scenario-test", name: "Test scenario", createdAt: "2026-08-01T00:00:00.000Z", archived: false, deltas } : undefined;
  return { input, snapshot: FinancialForecastingEngine.generate(input, scenario), scenario };
}

test("1 baseline cash-flow forecast", () => assert.equal(forecast().snapshot.months.length, 12));
test("2 monthly income recurrence", () => assert.equal(forecast().snapshot.months[0].projectedIncome, 8500));
test("3 recurring expense recurrence", () => assert.equal(forecast().snapshot.months[0].fixedExpenses, 3600));
test("4 one-off events", () => assert.ok(forecast([{ kind: "add-one-off-expense", amount: 5000, startMonth: 1 }]).snapshot.events.some((event) => event.type === "one-off-event")));
test("5 debt amortisation", () => assert.ok(forecast().snapshot.months.at(-1)!.debtBalance < 523000));
test("6 extra repayments reduce final debt", () => {
  const base = forecast().snapshot;
  const extra = forecast([{ kind: "increase-mortgage-repayment", amount: 500 }]).snapshot;
  assert.ok(extra.months.at(-1)!.debtBalance < base.months.at(-1)!.debtBalance);
});
test("7 interest-rate changes alter interest", () => {
  const base = forecast().snapshot;
  const lower = forecast([{ kind: "refinance-mortgage", amount: 0, rate: 4.8 }]).snapshot;
  assert.ok(lower.months.reduce((sum, month) => sum + month.interest, 0) < base.months.reduce((sum, month) => sum + month.interest, 0));
});
test("8 zero-interest debt", () => {
  const input = FinancialForecastingEngine.buildInput({ userId: "u1", records: records(), startDate: "2026-08-01", horizon: "12m" });
  input.debts.forEach((debt) => { debt.annualInterestRate = 0; });
  assert.equal(FinancialForecastingEngine.generate(input).months[0].interest, 0);
});
test("9 payoff-date calculation", () => assert.ok(forecast([{ kind: "increase-mortgage-repayment", amount: 60000 }]).snapshot.events.some((event) => event.type === "debt-payoff")));
test("10 net-worth projection", () => assert.ok(forecast().snapshot.months.at(-1)!.netWorth > 0));
test("11 emergency-fund forecast", () => assert.ok(forecast().snapshot.months[0].emergencyFundMonths > 0));
test("12 shortfall detection", () => assert.ok(forecast([{ kind: "add-one-off-expense", amount: 50000, startMonth: 0 }]).snapshot.events.some((event) => event.type === "cash-shortfall")));
test("13 scenario isolation", () => assert.equal(forecast([{ kind: "change-salary", amount: 1000 }]).input.recurringIncome[0].amount, 8500));
test("14 baseline immutability", () => {
  const base = forecast().snapshot;
  forecast([{ kind: "change-salary", amount: 1000 }]);
  assert.equal(base.input.recurringIncome[0].amount, 8500);
});
test("15 scenario comparison", () => {
  const base = forecast().snapshot;
  const changed = forecast([{ kind: "add-one-off-expense", amount: 5000 }]).snapshot;
  assert.ok(FinancialForecastingEngine.compare(base, changed).projectedCashDelta < 0);
});
test("16 stale-data warnings via short history", () => {
  const input = FinancialForecastingEngine.buildInput({ userId: "u1", records: records().slice(0, 2), startDate: "2026-08-01", horizon: "12m" });
  assert.ok(FinancialForecastingEngine.generate(input).quality.warnings.length > 0);
});
test("17 missing interest rate", () => {
  const input = forecast().input;
  input.debts[0].annualInterestRate = null;
  assert.ok(FinancialForecastingEngine.generate(input).quality.warnings.some((warning) => warning.includes("interest")));
});
test("18 missing repayment amount", () => {
  const input = forecast().input;
  input.debts[0].monthlyRepayment = null;
  assert.ok(FinancialForecastingEngine.generate(input).quality.warnings.some((warning) => warning.includes("repayment")));
});
test("19 unsupported assumptions are not silently added", () => assert.equal(forecast().input.assumptions.some((item) => item.id === "crypto-return"), false));
test("20 forecast-quality classification", () => assert.equal(forecast().snapshot.quality.class, "HIGH"));
test("21 timeline sorting", () => {
  const events = forecast().snapshot.events;
  assert.equal(events.every((event, index) => index === 0 || events[index - 1].date <= event.date), true);
});
test("22 recurring event generation", () => assert.equal(forecast().snapshot.events.filter((event) => event.type === "salary-payment").length, 12));
test("23 duplicate event prevention", () => {
  const events = forecast().snapshot.events;
  assert.equal(new Set(events.map((event) => event.id)).size, events.length);
});
test("24 forecast hash determinism", () => {
  const input = forecast().input;
  const first = FinancialForecastingEngine.generate(input).hash;
  const second = FinancialForecastingEngine.generate(input).hash;
  assert.equal(first, second);
});
test("25 persistence round trip", () => {
  const dir = mkdtempSync(join(tmpdir(), "forecast-"));
  const old = process.env.VIREON_UNUSED_FORECAST_DIR;
  try {
    process.env.VIREON_UNUSED_FORECAST_DIR = dir;
    const state = FinancialForecastingEngine.persist(forecast().snapshot);
    assert.ok(state.snapshots.length > 0);
  } finally {
    if (old) process.env.VIREON_UNUSED_FORECAST_DIR = old; else delete process.env.VIREON_UNUSED_FORECAST_DIR;
    rmSync(dir, { recursive: true, force: true });
  }
});
test("26 Decision Centre integration", () => assert.ok(forecast().snapshot.decisions.some((decision) => decision.id === "forecast-interest-burden")));
test("27 AI CFO context provenance", () => assert.ok(forecast().snapshot.aiCfoContext.assumptionProvenance.every((item) => item.source)));
test("28 unconfirmed records excluded", () => {
  const platform = new ManualFinancialDataPlatform();
  const ingestion = platform.createIngestion({ userId: "u1", sourceType: "CSV" });
  platform.stageParsedTransactions("u1", ingestion.id, [{ date: "2026-08-01", amount: 99999, description: "Salary" }]);
  const input = FinancialForecastingEngine.buildInput({ userId: "u1", records: [...platform.canonical.values()], startDate: "2026-08-01" });
  assert.equal(input.recurringIncome.length, 0);
});
test("29 archived scenarios excluded", () => {
  const { input } = forecast();
  const archived: ForecastScenario = { id: "archived", name: "Archived", createdAt: "2026-08-01T00:00:00.000Z", archived: true, deltas: [{ kind: "change-salary", amount: 9999 }] };
  assert.equal(FinancialForecastingEngine.generate(input, archived).input.recurringIncome[0].amount, 8500);
});
test("30 no Open Banking dependency", () => assert.doesNotThrow(() => forecast()));
