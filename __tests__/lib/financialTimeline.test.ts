import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAiDecisions } from "../../src/lib/aiDecisionCentre.ts";
import { gatherAICfoInputs } from "../../src/lib/aiCfoRuntime.ts";
import { ExplainabilityEngine } from "../../src/lib/explainability.ts";
import type { FinancialTimelineEvent } from "../../src/lib/financialTimeline.ts";
import { TimelineEngine } from "../../src/lib/timelineEngine.ts";

function sampleEvents(): FinancialTimelineEvent[] {
  return [
    {
      id: "event-borrowing",
      timestamp: "2026-07-19T00:00:00.000Z",
      category: "Financial Position",
      type: "borrowing changed",
      title: "Borrowing capacity declined",
      summary: "Borrowing declined after recurring spending increased.",
      whyItHappened: "Recurring spending increased.",
      deterministicCause: "Cash Flow and Housing engines recalculated serviceability.",
      evidence: [{
        id: "evidence-spending",
        sourceType: "calculation",
        sourceId: "cash-flow",
        title: "Cash Flow calculation",
        location: "/cash-flow",
        factUsed: "Recurring spending increased by $450/month",
        confidence: "High",
        lastVerifiedAt: "2026-07-19T00:00:00.000Z",
      }],
      calculationSnapshotId: "calc-borrowing",
      confidence: "High",
      relatedDecisionIds: ["housing-capacity-increased"],
      relatedWorkflowIds: [],
      relatedDocumentIds: [],
      relatedScenarioIds: [],
      affectedMetrics: ["borrowingCapacity"],
      beforeValues: { borrowingCapacity: 720000 },
      afterValues: { borrowingCapacity: 694000 },
      impact: -26000,
      immutable: true,
    },
    {
      id: "event-doc",
      timestamp: "2026-06-13T00:00:00.000Z",
      category: "Financial Fact",
      type: "document uploaded",
      title: "Tax return uploaded",
      summary: "Tax return added to the Vault.",
      whyItHappened: "User uploaded evidence.",
      deterministicCause: "Financial Vault ingestion accepted document.",
      evidence: [{
        id: "evidence-tax-return",
        sourceType: "document",
        sourceId: "doc-tax",
        title: "Tax return",
        location: "/financial-vault",
        factUsed: "Taxable income evidence",
        confidence: "Medium",
        lastVerifiedAt: "2026-06-13T00:00:00.000Z",
      }],
      calculationSnapshotId: null,
      confidence: "Medium",
      relatedDecisionIds: ["vault-missing-document"],
      relatedWorkflowIds: ["workflow-vault-missing-document"],
      relatedDocumentIds: ["doc-tax"],
      relatedScenarioIds: [],
      affectedMetrics: ["vaultConfidence"],
      beforeValues: { vaultConfidence: 82 },
      afterValues: { vaultConfidence: 92 },
      impact: 10,
      immutable: true,
    },
  ];
}

describe("Financial Timeline and Explainability", () => {
  it("orders timeline events newest first and freezes immutable history", () => {
    const state = TimelineEngine.build();
    assert.ok(state.events.length > 0);
    for (let index = 1; index < state.events.length; index += 1) {
      assert.ok(new Date(state.events[index - 1].timestamp).getTime() >= new Date(state.events[index].timestamp).getTime());
    }
    assert.equal(Object.isFrozen(state), true);
    assert.equal(Object.isFrozen(state.events[0]), true);
    assert.equal(state.events.every((event) => event.immutable), true);
  });

  it("links evidence where available for every material timeline event", () => {
    const state = TimelineEngine.build();
    const material = state.events.filter((event) => Math.abs(event.impact) >= 500 || event.category === "Decision");
    assert.ok(material.length > 0);
    assert.equal(material.every((event) => event.evidence.length > 0), true);
  });

  it("builds deterministic compare-dates output with before and after values", () => {
    const comparison = ExplainabilityEngine.compareDates(sampleEvents(), "2026-06-01T00:00:00.000Z", "2026-07-20T00:00:00.000Z");
    assert.equal(comparison.eventIds.length, 2);
    assert.equal(comparison.positionChanges.find((item) => item.metric === "borrowingCapacity")?.delta, -26000);
    assert.equal(comparison.causes[0].title, "Borrowing capacity declined");
  });

  it("explains why a metric changed with contribution, evidence and confidence", () => {
    const explanation = ExplainabilityEngine.explainMetricChange(sampleEvents(), "borrowingCapacity");
    assert.equal(explanation.causes[0].contribution, -26000);
    assert.equal(explanation.causes[0].confidence, "High");
    assert.ok(explanation.causes[0].evidence.length > 0);
  });

  it("creates an explanation for every current recommendation", () => {
    const inputs = gatherAICfoInputs();
    const decisions = buildAiDecisions({ vault: inputs.vault, balanceSheet: inputs.balanceSheet, housing: inputs.housing });
    const state = TimelineEngine.build();
    for (const decision of decisions) {
      const explanation = state.explanations.find((item) => item.decisionId === decision.id);
      assert.ok(explanation, decision.id);
      assert.ok(explanation.why.length > 0);
      assert.ok(explanation.engines.length > 0);
      assert.ok(explanation.factsUsed.length > 0);
      assert.ok(explanation.couldChangeRecommendation.length > 0);
    }
  });

  it("preserves historical rule versions in Knowledge events", () => {
    const state = TimelineEngine.build({ category: "Knowledge" });
    const ruleEvent = state.events.find((event) => event.evidence.some((item) => item.sourceType === "rule"));
    assert.ok(ruleEvent);
    assert.ok(String(ruleEvent.afterValues.ruleVersion).length > 0);
  });

  it("keeps deleted or cancelled workflows historically visible", () => {
    const events = sampleEvents();
    const visible = ExplainabilityEngine.filter(events, { workflowId: "workflow-vault-missing-document" });
    assert.equal(visible.length, 1);
    assert.equal(visible[0].title, "Tax return uploaded");
  });

  it("detects yearly summaries and milestones without invented events", () => {
    const events = sampleEvents();
    const yearly = ExplainabilityEngine.yearlySummaries(events);
    assert.equal(yearly[0].year, 2026);
    assert.ok(yearly[0].eventIds.every((id) => events.some((event) => event.id === id)));

    const state = TimelineEngine.build();
    assert.ok(state.journey.milestones.length > 0);
    assert.equal(state.journey.milestones.every((milestone) => milestone.evidence.length > 0), true);
  });

  it("creates counterfactual summaries from recorded before and after values", () => {
    const result = ExplainabilityEngine.counterfactualWithoutEvent(sampleEvents()[0]);
    assert.equal(result.affectedMetrics[0].metric, "borrowingCapacity");
    assert.equal(result.affectedMetrics[0].delta, 26000);
    assert.match(result.summary, /borrowingCapacity/);
  });

  it("validates AI summaries cannot add findings or historical events", () => {
    const validated = ExplainabilityEngine.validateHistoricalSummary(
      "A secret inheritance arrived and a new property was purchased.",
      sampleEvents(),
    );
    assert.doesNotMatch(validated, /secret inheritance/i);
    assert.match(validated, /No additional historical events/i);
  });
});
