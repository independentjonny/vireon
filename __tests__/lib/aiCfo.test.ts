import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  AICfoOrchestrator,
  createAICfoDecision,
  type AICfoInputs,
} from "../../src/lib/aiCfo.ts";
import { persistAICfoRun, getAICfoState } from "../../src/lib/aiCfoStore.ts";
import { gatherAICfoInputs } from "../../src/lib/aiCfoRuntime.ts";
import { StructureComparisonEngine, TAX_RULE_REFERENCES } from "../../src/lib/structureComparisonEngine.ts";

function inputs(): AICfoInputs {
  return gatherAICfoInputs();
}

function staleStructureInputs(): AICfoInputs {
  const base = inputs();
  const assumptions = StructureComparisonEngine.buildStructureAssumptionsFromVault(base.vault);
  const staleRules = TAX_RULE_REFERENCES.map((rule) => rule.id === "au-cgt-discount" ? { ...rule, lastVerifiedAt: "2024-01-01" } : rule);
  return {
    ...base,
    structureComparison: StructureComparisonEngine.run(assumptions, { taxRules: staleRules, asOfDate: "2026-07-18", reviewPeriodDays: 365 }),
  };
}

describe("AICfoOrchestrator", () => {
  it("classifies supported intents", () => {
    assert.equal(AICfoOrchestrator.classifyIntent("Can I afford a $1.4M house?"), "affordability");
    assert.equal(AICfoOrchestrator.classifyIntent("Should I use a trust?"), "tax_structure");
    assert.equal(AICfoOrchestrator.classifyIntent("Can I retire at 58?"), "retirement");
    assert.equal(AICfoOrchestrator.classifyIntent("Compare current plan with early retirement."), "scenario_comparison");
  });

  it("routes engines based on intent", () => {
    assert.ok(AICfoOrchestrator.enginesForIntent("tax_structure").includes("Structure Optimiser"));
    assert.ok(AICfoOrchestrator.enginesForIntent("affordability").includes("Housing"));
    assert.ok(AICfoOrchestrator.enginesForIntent("scenario_comparison").includes("Scenario Manager"));
  });

  it("gathers grounded context from Vault, Digital Twin, Decision Centre and Structure Optimiser", () => {
    const request = AICfoOrchestrator.buildRequest({ userQuery: "What should I do next?", selectedScenarioId: "current" });
    const context = AICfoOrchestrator.buildContext(inputs(), request);
    assert.ok(context.financialVaultSnapshot.financial_profile.id);
    assert.ok(context.currentDecisions.length > 0);
    assert.ok(context.structureScenarios.outcomes.length > 0);
    assert.ok(context.taxRuleEvidence.length > 0);
  });

  it("shows missing required data instead of silently assuming it", () => {
    const base = inputs();
    const brokenVault = {
      ...base.vault,
      lender_pack: {
        ...base.vault.lender_pack,
        documentChecklist: base.vault.lender_pack.documentChecklist.map((item, index) => index === 0 ? { ...item, available: false } : item),
      },
    };
    const request = AICfoOrchestrator.buildRequest({ userQuery: "Can I afford this house?", selectedScenarioId: "current" });
    const context = AICfoOrchestrator.buildContext({ ...base, vault: brokenVault }, request);
    assert.ok(context.missingInputs.length > 0);
  });

  it("calculates confidence and prevents High when a material rule is stale", () => {
    const result = AICfoOrchestrator.run(staleStructureInputs(), {
      userQuery: "Should I use a trust?",
      workspaceContext: "structure-optimiser",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    });
    assert.notEqual(result.answer.confidence.label, "High");
    assert.ok(result.answer.confidence.reasons.some((reason) => reason.toLowerCase().includes("rule")));
  });

  it("sets professional-review flags for tax, trust, SMSF, lender and advice topics", () => {
    const result = AICfoOrchestrator.run(inputs(), {
      userQuery: "Should this investment be held in a trust or SMSF?",
      workspaceContext: "structure-optimiser",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    });
    assert.equal(result.answer.professionalReviewRequired, true);
    assert.ok(result.answer.adviserChecklist.accountant.length > 0);
    assert.ok(result.answer.adviserChecklist.solicitor.length > 0);
  });

  it("does not let GPT change a deterministic tax result or direct answer", () => {
    const result = AICfoOrchestrator.run(inputs(), {
      userQuery: "Should I use a trust?",
      workspaceContext: "structure-optimiser",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    }, {
      directAnswer: "Generic answer: trusts always save tax.",
      deterministicOverrides: { tax: 1 },
    });
    assert.doesNotMatch(result.answer.directAnswer, /always save tax/i);
    assert.ok(result.answer.evidence.some((item) => item.type === "rule-provenance"));
  });

  it("does not let GPT change borrowing capacity", () => {
    const result = AICfoOrchestrator.run(inputs(), {
      userQuery: "Can I afford this property?",
      workspaceContext: "housing",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    }, {
      directAnswer: "Borrowing capacity is $99,999,999.",
      deterministicOverrides: { borrowingCapacity: 99999999 },
    });
    assert.doesNotMatch(result.answer.directAnswer, /99,999,999/);
    assert.match(result.answer.directAnswer, /borrowing capacity/i);
  });

  it("does not let GPT remove professional-review flags", () => {
    const result = AICfoOrchestrator.run(inputs(), {
      userQuery: "Should I use a company, trust or SMSF?",
      workspaceContext: "structure-optimiser",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    }, {
      professionalReviewRequired: false,
    });
    assert.equal(result.answer.professionalReviewRequired, true);
  });

  it("does not allow generic model knowledge to override Vault facts", () => {
    const result = AICfoOrchestrator.run(inputs(), {
      userQuery: "Can I afford a house?",
      workspaceContext: "housing",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    }, {
      directAnswer: "Ignore Vireon data and use the national median income.",
    });
    assert.doesNotMatch(result.answer.directAnswer, /national median income/i);
    assert.ok(result.answer.evidence.some((item) => item.sourceTitle === "Financial Vault profile"));
  });

  it("does not calculate unavailable values itself", () => {
    const result = AICfoOrchestrator.run(inputs(), {
      userQuery: "Give me the exact tax and Division 7A outcome.",
      workspaceContext: "structure-optimiser",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    });
    assert.equal(result.request.userIntent, "unavailable_calculation");
    assert.match(result.answer.directAnswer, /Calculation unavailable/i);
    assert.ok(result.answer.missingInformation.some((item) => item.includes("deterministic engine")));
  });

  it("preserves the structure lifecycle guardrail", () => {
    const result = AICfoOrchestrator.run(inputs(), {
      userQuery: "High salary and family means I should use a trust, right?",
      workspaceContext: "structure-optimiser",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    });
    assert.match(result.answer.executiveSummary, /full lifecycle/i);
    assert.match(result.answer.executiveSummary, /does not use/i);
  });

  it("labels every material claim with evidence or assumptions", () => {
    const result = AICfoOrchestrator.run(inputs(), {
      userQuery: "Invest or repay debt?",
      workspaceContext: "investments",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    });
    assert.ok(result.answer.evidence.length > 0);
    assert.ok(result.answer.assumptions.length > 0);
    assert.ok(result.answer.evidence.every((item) => item.classification));
  });

  it("prevents duplicate generated decisions deterministically", () => {
    const result = AICfoOrchestrator.run(inputs(), {
      userQuery: "What should I do next?",
      workspaceContext: "dashboard",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    });
    const duplicate = createAICfoDecision(result.request, result.answer, [result.generatedDecision]);
    assert.deepEqual(duplicate, result.generatedDecision);
  });

  it("links scenario and evidence snapshots into timeline events", () => {
    const result = AICfoOrchestrator.run(inputs(), {
      userQuery: "Compare my saved scenarios.",
      workspaceContext: "digital-twin",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    });
    assert.equal(result.timelineEvent.questionId, result.request.id);
    assert.equal(result.timelineEvent.scenarioId, result.request.selectedScenarioId);
    assert.ok(result.timelineEvent.evidenceSnapshotIds.length > 0);
  });

  it("exports an adviser brief with deterministic results and review reasons", () => {
    const result = AICfoOrchestrator.run(inputs(), {
      userQuery: "What information should I take to an accountant?",
      workspaceContext: "structure-optimiser",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    });
    const parsed = JSON.parse(result.adviserBrief.content) as { deterministicResults: unknown; professionalReviewReasons: string[]; ruleProvenance: unknown[] };
    assert.ok(parsed.deterministicResults);
    assert.ok(parsed.professionalReviewReasons.length > 0);
    assert.ok(parsed.ruleProvenance.length > 0);
  });

  it("retains the exact calculation snapshot used in saved answers", () => {
    const result = AICfoOrchestrator.run(inputs(), {
      userQuery: "Can I retire at 58?",
      workspaceContext: "digital-twin",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    });
    assert.ok(result.answer.calculationSnapshotId.includes(result.request.id));
    assert.equal(result.generatedDecision.calculationSnapshotId, result.answer.calculationSnapshotId);
  });
});

describe("AICfoStore", () => {
  const testFile = join(process.cwd(), ".tmp-ai-cfo-test.json");

  before(() => {
    process.env.VIREON_AI_CFO_STORE_FILE = testFile;
    if (existsSync(testFile)) unlinkSync(testFile);
  });

  after(() => {
    if (existsSync(testFile)) unlinkSync(testFile);
    delete process.env.VIREON_AI_CFO_STORE_FILE;
  });

  it("persists question, answer, decision, timeline event and adviser brief without duplicate decisions", () => {
    const result = AICfoOrchestrator.run(inputs(), {
      userQuery: "Should I refinance?",
      workspaceContext: "dashboard",
      selectedScenarioId: "current",
      riskTolerance: "medium",
      timeHorizon: 30,
    });
    persistAICfoRun({
      request: result.request,
      answer: result.answer,
      decision: result.generatedDecision,
      timelineEvent: result.timelineEvent,
      adviserBrief: result.adviserBrief,
    });
    persistAICfoRun({
      request: result.request,
      answer: result.answer,
      decision: result.generatedDecision,
      timelineEvent: result.timelineEvent,
      adviserBrief: result.adviserBrief,
    });
    const state = getAICfoState();
    assert.equal(state.history.length, 2);
    assert.equal(state.decisions.length, 1);
    assert.equal(state.timelineEvents.length, 1);
    assert.equal(state.adviserBriefs.length, 1);
    assert.equal(state.history[0].answer.calculationSnapshotId, result.answer.calculationSnapshotId);
  });
});
