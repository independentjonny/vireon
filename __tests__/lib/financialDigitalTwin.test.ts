import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  FinancialDigitalTwinEngine,
  type FinancialDigitalTwin,
  type TwinScenario,
} from "../../src/lib/financialDigitalTwin.ts";
import { appendTwinSimulation, getFinancialDigitalTwinState, saveTwinScenario } from "../../src/lib/financialDigitalTwinStore.ts";
import type { FinancialVaultState } from "../../src/lib/financialVaultTypes.ts";

function vault(): FinancialVaultState {
  return {
    uploaded_documents: [
      { id: "doc-pay", fileName: "payslip.txt", documentType: "payslip", uploadedAt: "2026-07-01T00:00:00.000Z", status: "extracted", extractedText: "", extractionConfidence: 0.9, sourcePeriodStart: null, sourcePeriodEnd: null },
      { id: "doc-bank", fileName: "bank.csv", documentType: "bank_statement", uploadedAt: "2026-07-01T00:00:00.000Z", status: "extracted", extractedText: "", extractionConfidence: 0.86, sourcePeriodStart: null, sourcePeriodEnd: null },
      { id: "doc-super", fileName: "super.txt", documentType: "super_statement", uploadedAt: "2026-07-01T00:00:00.000Z", status: "extracted", extractedText: "", extractionConfidence: 0.84, sourcePeriodStart: null, sourcePeriodEnd: null },
    ],
    financial_profile: {
      id: "profile-test",
      incomeMonthly: 12000,
      incomeAnnual: 144000,
      employmentType: "employee",
      employerName: "Test Co",
      mortgageBalance: 560000,
      mortgageRepaymentMonthly: 3600,
      interestRate: 6.2,
      superBalance: 180000,
      monthlySpending: 7200,
      recurringSubscriptions: 240,
      liabilities: 580000,
      assets: 980000,
      lastUpdatedAt: "2026-07-01T00:00:00.000Z",
      sources: {
        incomeAnnual: { documentId: "doc-pay", fileName: "payslip.txt", documentType: "payslip", uploadedAt: "2026-07-01T00:00:00.000Z", confidence: 0.9 },
        mortgageBalance: { documentId: "doc-bank", fileName: "bank.csv", documentType: "bank_statement", uploadedAt: "2026-07-01T00:00:00.000Z", confidence: 0.86 },
        superBalance: { documentId: "doc-super", fileName: "super.txt", documentType: "super_statement", uploadedAt: "2026-07-01T00:00:00.000Z", confidence: 0.84 },
      },
    },
    borrowing_capacity: {
      profileId: "profile-test",
      estimatedMaxBorrowing: 820000,
      estimatedSafeBorrowing: 700000,
      monthlyRepaymentAtCurrentRates: 4500,
      surplusIncome: 4200,
      riskLevel: "medium",
      assumptions: [],
      warnings: [],
    },
    refinance_opportunities: [],
    savings_opportunities: [],
    lender_pack: {
      generatedAt: "2026-07-01T00:00:00.000Z",
      borrowerProfile: {} as never,
      incomeSummary: "",
      assetSummary: "",
      liabilitySummary: "",
      cashflowSummary: "",
      mortgageRefinanceSummary: "",
      documentChecklist: [],
      uploadedDocumentIndex: [],
      missingItems: [],
      riskFlags: [],
      assumptions: [],
    },
  };
}

function twin(): FinancialDigitalTwin {
  return FinancialDigitalTwinEngine.buildFromVault(vault(), "2026-07-18T00:00:00.000Z");
}

function scenario(overrides: Partial<TwinScenario> = {}): TwinScenario {
  const baseTwin = twin();
  return {
    id: "test-scenario",
    name: "Test Scenario",
    twinId: baseTwin.id,
    createdAt: "2026-07-18T00:00:00.000Z",
    horizonYears: 30,
    probability: 0.7,
    events: [],
    ...overrides,
  };
}

describe("FinancialDigitalTwinEngine", () => {
  it("builds a complete point-in-time twin from Financial Vault data", () => {
    const result = twin();
    assert.equal(result.income.salary, 144000);
    assert.ok(result.assets.property > 0);
    assert.equal(result.liabilities.mortgage, 560000);
    assert.ok(result.knowledgeHealth.digitalTwinConfidence > 0);
  });

  it("calculates net worth projections deterministically", () => {
    const baseTwin = twin();
    const output = FinancialDigitalTwinEngine.simulate(baseTwin, scenario());
    assert.ok(output.netWorth > baseTwin.assets.cash + baseTwin.assets.super - baseTwin.liabilities.mortgage);
    assert.equal(output.yearly.length, 30);
    assert.equal(FinancialDigitalTwinEngine.simulate(baseTwin, scenario()).netWorth, output.netWorth);
  });

  it("projects cash flow, borrowing, retirement, tax and risk outputs", () => {
    const output = FinancialDigitalTwinEngine.simulate(twin(), scenario());
    assert.ok(Number.isFinite(output.cashFlow));
    assert.ok(output.borrowingCapacity >= 0);
    assert.ok(output.retirementScore >= 0);
    assert.ok(output.taxPaid > 0);
    assert.ok(output.riskScore >= 0 && output.riskScore <= 100);
  });

  it("applies interest rate, ETF purchase and investment property events", () => {
    const baseTwin = twin();
    const baseline = FinancialDigitalTwinEngine.simulate(baseTwin, scenario());
    const stressed = FinancialDigitalTwinEngine.simulate(baseTwin, scenario({
      id: "events",
      events: [
        { id: "rate", type: "interest_rate_change", label: "Rates +2%", year: 2028, rateDelta: 2, probability: 0.4, confidence: "Medium", assumptions: [] },
        { id: "etf", type: "etf_purchase", label: "ETF purchase", year: 2029, amount: 24000, probability: 0.7, confidence: "Medium", assumptions: [] },
        { id: "ip", type: "investment_property_purchase", label: "Investment property", year: 2030, amount: 650000, probability: 0.5, confidence: "Low", assumptions: [] },
      ],
    }));
    assert.notEqual(stressed.netWorth, baseline.netWorth);
    assert.ok(stressed.debt > baseline.debt);
    assert.ok(stressed.riskScore >= baseline.riskScore);
  });

  it("generates scenario comparisons for up to four scenarios", () => {
    const baseTwin = twin();
    const comparisons = FinancialDigitalTwinEngine.compare(baseTwin, [
      scenario({ id: "a", name: "Current" }),
      scenario({ id: "b", name: "Aggressive" }),
      scenario({ id: "c", name: "House" }),
      scenario({ id: "d", name: "Retire 60" }),
      scenario({ id: "e", name: "Ignored fifth" }),
    ]);
    assert.equal(comparisons.length, 4);
    assert.ok(comparisons.every((item) => item.confidence));
  });

  it("generates future timeline events from projections and user events", () => {
    const baseTwin = twin();
    const output = FinancialDigitalTwinEngine.simulate(baseTwin, scenario({
      events: [{ id: "inheritance", type: "inheritance", label: "Inheritance", year: 2030, amount: 150000, probability: 0.4, confidence: "Low", assumptions: [] }],
    }));
    assert.ok(output.futureTimelineEvents.some((event) => event.title === "Inheritance"));
    assert.ok(output.futureTimelineEvents.every((event) => event.year >= 2026));
  });

  it("generates Decision Centre actions from scenario outputs", () => {
    const output = FinancialDigitalTwinEngine.simulate(twin(), scenario());
    assert.ok(output.decisions.length > 0);
    assert.ok(output.decisions.every((decision) => decision.evidence.length > 0));
  });

  it("creates a persisted twin state with history, decisions, timeline and snapshots", () => {
    const state = FinancialDigitalTwinEngine.createPersistedState(vault());
    assert.ok(state.scenarios.length > 0);
    assert.ok(state.simulationHistory.length > 0);
    assert.ok(state.decisionHistory.length > 0);
    assert.ok(state.timelineEvents.length > 0);
    assert.ok(state.calculationSnapshots.length > 0);
  });
});

describe("FinancialDigitalTwinStore", () => {
  const testFile = join(process.cwd(), ".tmp-financial-digital-twin-test.json");

  before(() => {
    process.env.VIREON_TWIN_STORE_FILE = testFile;
    if (existsSync(testFile)) unlinkSync(testFile);
  });

  after(() => {
    if (existsSync(testFile)) unlinkSync(testFile);
    delete process.env.VIREON_TWIN_STORE_FILE;
  });

  it("persists scenarios and simulation history", () => {
    const state = getFinancialDigitalTwinState();
    const newScenario = scenario({ id: "persisted", name: "Persisted" });
    const withScenario = saveTwinScenario(newScenario);
    assert.equal(withScenario.scenarios[0].id, "persisted");
    const output = FinancialDigitalTwinEngine.simulate(state.twin, newScenario);
    const withSimulation = appendTwinSimulation(output);
    assert.equal(withSimulation.simulationHistory[0].scenarioId, "persisted");
    assert.ok(withSimulation.timelineEvents.length >= output.futureTimelineEvents.length);
  });
});
