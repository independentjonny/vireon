import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  StructureComparisonEngine,
  TAX_RULE_REFERENCES,
  type StructureAssumptionSet,
} from "../../src/lib/structureComparisonEngine.ts";

function assumptions(overrides: Partial<StructureAssumptionSet> = {}): StructureAssumptionSet {
  return {
    state: "NSW",
    investmentType: "residential_investment_property",
    purchasePrice: 800000,
    deposit: 200000,
    loanAmount: 600000,
    interestRate: 6,
    expectedAnnualIncome: 42000,
    expectedAnnualExpenses: 12000,
    expectedCapitalGrowth: 4,
    expectedHoldingPeriod: 10,
    userTaxableIncome: 150000,
    partnerTaxableIncome: 90000,
    expectedSaleYear: 2036,
    lossesExpected: false,
    incomeRetained: false,
    assetProtectionImportance: 7,
    estatePlanningImportance: 6,
    potentialBeneficiaries: 2,
    existingStructures: {
      trust: false,
      company: false,
      smsf: false,
    },
    setupCosts: {},
    annualComplianceCosts: {},
    stateOfResidenceSource: "vault",
    vaultEvidence: ["incomeAnnual: payslip", "mortgageBalance: mortgage", "superBalance: super"],
    ...overrides,
  };
}

function outcome(input: StructureAssumptionSet, structure: string) {
  const result = StructureComparisonEngine.run(input);
  const found = result.outcomes.find((item) => item.structure === structure);
  assert.ok(found, `Expected outcome for ${structure}`);
  return found;
}

describe("StructureComparisonEngine deterministic tax rules", () => {
  it("calculates resident individual marginal tax using the configured brackets", () => {
    assert.equal(StructureComparisonEngine.calculateResidentIndividualTax(18200), 0);
    assert.equal(StructureComparisonEngine.calculateResidentIndividualTax(45000), 4288);
    assert.equal(StructureComparisonEngine.calculateResidentIndividualTax(135000), 31288);
  });

  it("compares individual, company and trust without assuming companies are cheaper", () => {
    const result = StructureComparisonEngine.run(assumptions());
    const individual = result.outcomes.find((item) => item.structure === "individual");
    const company = result.outcomes.find((item) => item.structure === "company");
    const trust = result.outcomes.find((item) => item.structure === "discretionary_trust");
    assert.ok(individual && company && trust);
    assert.notEqual(result.lowestEstimatedLifetimeCost.structure, "company");
  });

  it("models negative cash-flow property with personal loss benefit for individual ownership", () => {
    const input = assumptions({ expectedAnnualIncome: 26000, expectedAnnualExpenses: 14000, loanAmount: 700000, interestRate: 7 });
    const individual = outcome(input, "individual");
    assert.ok(individual.estimatedAnnualTax < 0, "Individual negative gearing benefit should be represented as negative incremental tax");
    assert.match(individual.lossTreatment, /reduce the individual's taxable income/i);
  });

  it("models positively geared property as taxable annual income", () => {
    const input = assumptions({ expectedAnnualIncome: 65000, expectedAnnualExpenses: 9000, loanAmount: 400000, interestRate: 5 });
    const individual = outcome(input, "individual");
    assert.ok(individual.estimatedAnnualTaxableIncome > 0);
    assert.ok(individual.estimatedAnnualTax > 0);
  });

  it("models capital-growth sale with company CGT discount warning", () => {
    const input = assumptions({ expectedCapitalGrowth: 7, expectedHoldingPeriod: 12 });
    const individual = outcome(input, "individual");
    const company = outcome(input, "company");
    assert.ok(individual.estimatedSaleProceedsAfterIndicativeTax > company.estimatedSaleProceedsAfterIndicativeTax);
    assert.match(company.indicativeCapitalGainsTreatment, /Companies generally do not receive/i);
  });

  it("models retained company profits and later distribution risk", () => {
    const company = outcome(assumptions({ incomeRetained: true, expectedAnnualIncome: 80000 }), "company");
    assert.ok(company.estimatedAnnualTax > 0);
    assert.ok(company.keyRisks.some((risk) => risk.id === "company-distribution"));
  });

  it("keeps trust losses inside the trust when no eligible beneficiaries are modelled", () => {
    const trust = outcome(
      assumptions({ potentialBeneficiaries: 0, expectedAnnualIncome: 24000, expectedAnnualExpenses: 15000, loanAmount: 700000, interestRate: 7 }),
      "discretionary_trust"
    );
    assert.equal(trust.confidenceLevel, "Low");
    assert.match(trust.lossTreatment, /cannot be distributed/i);
    assert.ok(trust.keyRisks.some((risk) => risk.id === "no-beneficiaries"));
  });

  it("does not infer trust suitability from high salary and family profile alone", () => {
    const result = StructureComparisonEngine.run(assumptions({
      userTaxableIncome: 280000,
      partnerTaxableIncome: 220000,
      potentialBeneficiaries: 4,
      expectedAnnualIncome: 26000,
      expectedAnnualExpenses: 15000,
      loanAmount: 700000,
      interestRate: 7,
      expectedCapitalGrowth: 6,
      assetProtectionImportance: 5,
      estatePlanningImportance: 5,
    }));
    assert.ok(result.recommendations.some((item) => item.id === "no-high-salary-family-trust-shortcut"));
    assert.notEqual(result.mostSuitableUnderCurrentAssumptions.outcome?.structure, "discretionary_trust");
    assert.ok(result.mostSuitableUnderCurrentAssumptions.tradeOffs.some((item) => item.includes("high salary plus family equals trust")));
  });

  it("models the complete ownership lifecycle for every structure", () => {
    const result = StructureComparisonEngine.run(assumptions());
    const phases = ["purchase", "annual_ownership", "financing", "distributions", "sale", "estate_transfer"];
    for (const item of result.outcomes) {
      assert.deepEqual(item.lifecycleAssessments.map((phase) => phase.phase), phases);
      assert.ok(item.lifecycleScore >= 0 && item.lifecycleScore <= 100);
    }
  });

  it("flags state-specific land tax for property scenarios", () => {
    const result = StructureComparisonEngine.run(assumptions({ state: "VIC" }));
    assert.ok(result.recommendations.some((item) => item.id === "land-tax-review-required"));
    assert.ok(result.outcomes.every((item) => item.keyRisks.some((risk) => risk.id === "land-tax")));
  });

  it("shows SMSF restriction warnings and personal-use warnings for residential property", () => {
    const smsf = outcome(assumptions({ investmentType: "residential_investment_property" }), "smsf");
    assert.ok(smsf.keyRisks.some((risk) => risk.id === "smsf-restrictions"));
    assert.ok(smsf.keyRisks.some((risk) => risk.id === "smsf-personal-use"));
    assert.equal(smsf.borrowingComplexity, "Very High");
  });

  it("lowers confidence when Vault evidence is missing", () => {
    const individual = outcome(assumptions({ vaultEvidence: [], stateOfResidenceSource: "assumption" }), "individual");
    assert.equal(individual.confidenceLevel, "Low");
  });

  it("does not expose any GPT-controlled calculation override", () => {
    const base = assumptions();
    const first = StructureComparisonEngine.run(base).outcomes.map((item) => item.estimatedLifetimeCost);
    const second = StructureComparisonEngine.run({ ...base, vaultEvidence: [...base.vaultEvidence, "GPT narrative ignored"] }).outcomes.map((item) => item.estimatedLifetimeCost);
    assert.deepEqual(second, first);
  });

  it("links every material calculation output to rule evidence", () => {
    const result = StructureComparisonEngine.run(assumptions());
    for (const item of result.outcomes) {
      assert.ok(item.taxRuleReferences.length > 0);
      assert.ok(item.calculationEvidence.length > 0);
      for (const evidence of item.calculationEvidence) {
        assert.ok(evidence.ruleIds.length > 0, `${item.structure} ${evidence.outputKey} should have at least one rule reference`);
        assert.ok(["calculated", "indicative", "professional-review-required"].includes(evidence.classification));
      }
      for (const risk of item.keyRisks) {
        assert.ok(risk.evidenceRuleIds.length > 0, `${item.structure} ${risk.id} should link to evidence`);
      }
    }
  });

  it("downgrades confidence and suppresses most suitable output when a material rule is stale", () => {
    const staleRules = TAX_RULE_REFERENCES.map((rule) =>
      rule.id === "au-cgt-discount" ? { ...rule, lastVerifiedAt: "2024-01-01" } : rule
    );
    const result = StructureComparisonEngine.run(assumptions(), { taxRules: staleRules, asOfDate: "2026-07-18", reviewPeriodDays: 365 });
    assert.ok(result.staleRuleWarnings.some((warning) => warning.includes("au-cgt-discount")));
    assert.equal(result.mostSuitableUnderCurrentAssumptions.outcome, null);
    assert.ok(result.outcomes.some((item) => item.confidenceLevel === "Low"));
  });

  it("does not use expired rules as evidence", () => {
    const expiredRules = TAX_RULE_REFERENCES.map((rule) =>
      rule.id === "au-cgt-discount" ? { ...rule, effectiveTo: "2025-06-30", reviewStatus: "expired" as const } : rule
    );
    const result = StructureComparisonEngine.run(assumptions(), { taxRules: expiredRules, asOfDate: "2026-07-18" });
    assert.ok(result.blockedReasons.some((reason) => reason.includes("au-cgt-discount")));
    assert.ok(result.outcomes.every((item) => item.taxRuleReferences.every((rule) => rule.id !== "au-cgt-discount")));
  });

  it("blocks jurisdiction-mismatched rules", () => {
    const mismatchedRules = TAX_RULE_REFERENCES.map((rule) =>
      rule.id === "au-individual-rates-2024-later" ? { ...rule, jurisdiction: "VIC" as const } : rule
    );
    const result = StructureComparisonEngine.run(assumptions({ state: "NSW" }), { taxRules: mismatchedRules, asOfDate: "2026-07-18" });
    assert.ok(result.blockedReasons.some((reason) => reason.includes("scenario jurisdiction is NSW")));
    assert.ok(result.outcomes.every((item) => item.taxRuleReferences.every((rule) => rule.id !== "au-individual-rates-2024-later")));
  });

  it("ignores GPT attempts to alter calculation classification", () => {
    const result = StructureComparisonEngine.run(assumptions(), {
      gptExplanation: {
        outputClassificationOverrides: { estimatedAnnualTax: "calculated" },
      },
    });
    const annualTaxEvidence = result.outcomes.flatMap((item) => item.calculationEvidence).filter((item) => item.outputKey === "estimatedAnnualTax");
    assert.ok(annualTaxEvidence.length > 0);
    assert.ok(annualTaxEvidence.every((item) => item.classification === "indicative"));
  });

  it("keeps professional-review flags immutable from GPT override attempts", () => {
    const result = StructureComparisonEngine.run(assumptions(), {
      gptExplanation: {
        removeProfessionalReviewFlags: true,
        taxRateOverrides: { company: 0.1 },
      },
    });
    assert.ok(result.professionalReviewItems.length > 0);
    assert.ok(result.recommendations.every((item) => item.professionalReviewRequired));
    assert.ok(result.outcomes.flatMap((item) => item.calculationEvidence).some((item) => item.professionalReviewRequired));
  });
});
