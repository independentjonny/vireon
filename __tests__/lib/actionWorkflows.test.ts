import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { ActionWorkflowEngine, WorkflowExecutionEngine, canEvidenceUpdateVaultFact } from "../../src/lib/actionWorkflows.ts";
import { addActionWorkflowEvidence, generateActionWorkflowArtefact, getActionWorkflowState, updateActionWorkflowStep, verifyActionWorkflowOutcome } from "../../src/lib/actionWorkflowStore.ts";
import { buildAiDecisions, type AiDecision } from "../../src/lib/aiDecisionCentre.ts";
import { getFinancialBalanceSheet } from "../../src/lib/financialBalanceSheet.ts";
import { createDemoFinancialVaultState } from "../../src/lib/financialVaultEmptyState.ts";
import { getHousingAffordabilityState } from "../../src/lib/housingAffordabilityStore.ts";

function decisions(): AiDecision[] {
  const vault = createDemoFinancialVaultState("2026-07-31T00:00:00.000Z");
  return buildAiDecisions({
    vault,
    housing: getHousingAffordabilityState(vault),
    balanceSheet: getFinancialBalanceSheet(),
  });
}

describe("ActionWorkflowEngine", () => {
  it("creates guided workflows from ranked decisions without recalculating financial impact", () => {
    const decision = decisions().find((item) => item.id === "refinance-mortgage-rate");
    assert.ok(decision);
    const workflow = ActionWorkflowEngine.createFromDecision(decision);
    assert.equal(workflow.sourceDecisionId, decision.id);
    assert.equal(workflow.financialImpact, decision.financialImpact);
    assert.equal(workflow.title, "Refinancing Wizard");
    assert.ok(workflow.steps.length >= 4);
    assert.ok(workflow.evidence.length > 0);
  });

  it("generates document blockers for missing-data decisions", () => {
    const decision = decisions().find((item) => item.id === "vault-missing-document");
    assert.ok(decision);
    const workflow = ActionWorkflowEngine.createFromDecision(decision);
    assert.equal(workflow.status, "Waiting on Document");
    assert.ok(workflow.blockers.some((item) => item.includes("Missing document")));
  });

  it("preserves professional-review flags for mortgage and investment workflows", () => {
    const decision = decisions().find((item) => item.id === "refinance-mortgage-rate");
    assert.ok(decision);
    const workflow = ActionWorkflowEngine.createFromDecision(decision);
    assert.equal(workflow.professionalReviewRequired, true);
    assert.ok(workflow.professionalReviewReasons.length > 0);
    assert.ok(workflow.steps.some((step) => step.professionalReviewRequired));
  });

  it("merges workflows deterministically without duplicate workflows", () => {
    const source = decisions();
    const first = ActionWorkflowEngine.merge(source);
    const second = ActionWorkflowEngine.merge(source, first);
    assert.equal(second.length, source.length);
    assert.deepEqual(new Set(second.map((workflow) => workflow.sourceDecisionId)).size, source.length);
  });

  it("transitions steps and updates progress without altering evidence", () => {
    const decision = decisions().find((item) => item.id === "subscription-review");
    assert.ok(decision);
    const workflow = ActionWorkflowEngine.createFromDecision(decision);
    const result = ActionWorkflowEngine.transitionStep(workflow, workflow.steps[0].id, "Completed");
    assert.equal(result.changed, true);
    assert.ok(result.workflow.progress > workflow.progress);
    assert.deepEqual(result.workflow.evidence, workflow.evidence);
    assert.equal(result.workflow.auditTrail[0].eventType, "step-completed");
  });

  it("summarises active workflows and estimated monthly savings", () => {
    const source = decisions();
    const workflows = ActionWorkflowEngine.merge(source);
    const summary = ActionWorkflowEngine.summarise(workflows, source);
    assert.equal(summary.total, source.length);
    assert.ok(summary.active > 0);
    assert.ok(summary.estimatedMonthlySavings > 0);
  });
});

describe("WorkflowExecutionEngine", () => {
  it("keeps checklist completion separate from outcome verification", () => {
    const decision = decisions().find((item) => item.id === "subscription-review");
    assert.ok(decision);
    let execution = WorkflowExecutionEngine.createFromDecision(decision);
    for (const step of execution.steps.slice(0, execution.steps.findIndex((item) => item.type === "outcome-verification"))) {
      execution = WorkflowExecutionEngine.transitionStep(execution, step.id, "Completed", "user").execution;
    }
    assert.equal(execution.status, "Awaiting Verification");
    assert.notEqual(execution.outcomeStatus, "Verified");
    assert.equal(execution.realisedImpact, null);
    assert.equal(execution.executionStatus, "Awaiting Verification");
    assert.ok(execution.currentStepId);
    assert.equal(execution.outcomeChecks[0].result, execution.outcomeStatus);
  });

  it("does not let GPT complete steps or create evidence", () => {
    const decision = decisions()[0];
    const execution = WorkflowExecutionEngine.createFromDecision(decision);
    const blockedStep = WorkflowExecutionEngine.transitionStep(execution, execution.steps[0].id, "Completed", "gpt");
    assert.equal(blockedStep.changed, false);
    assert.equal(blockedStep.execution.steps[0].status, "Not Started");
    const evidence = WorkflowExecutionEngine.addEvidence(execution, {
      type: "external-confirmation",
      source: "model",
      documentId: null,
      factId: null,
      uploadedAt: null,
      effectiveDate: null,
      verifiedAt: null,
      confidence: "Low",
      notes: "Model-created evidence",
      satisfiesRequirementIds: [],
    }, "gpt");
    assert.equal(evidence.accepted, false);
  });

  it("does not populate realised impact from expectation without evidence", () => {
    const decision = decisions().find((item) => item.id === "refinance-mortgage-rate");
    assert.ok(decision);
    const execution = WorkflowExecutionEngine.createFromDecision(decision);
    const verified = WorkflowExecutionEngine.evaluateOutcome(execution, 186, []);
    assert.equal(verified.outcomeStatus, "Evidence Pending");
    assert.equal(verified.realisedImpact, null);
  });

  it("does not verify realised impact from user attestation alone", () => {
    const decision = decisions().find((item) => item.id === "subscription-review");
    assert.ok(decision);
    const execution = WorkflowExecutionEngine.createFromDecision(decision);
    const withEvidence = WorkflowExecutionEngine.addEvidence(execution, {
      type: "user attestation",
      source: "User clicked cancelled",
      documentId: null,
      factId: null,
      uploadedAt: "2026-07-18T08:00:00.000Z",
      effectiveDate: "2026-07-18",
      verifiedAt: "2026-07-18T08:00:00.000Z",
      confidence: "High",
      verificationStatus: "Verified",
      notes: "User confirmed cancellation in the checklist.",
      satisfiesRequirementIds: ["outcome-verification"],
    }).execution;
    const checked = WorkflowExecutionEngine.evaluateOutcome(withEvidence, withEvidence.outcomeVerifications[0].expectedValue, [withEvidence.evidence[0].id]);
    assert.equal(checked.outcomeStatus, "Evidence Pending");
    assert.equal(checked.realisedImpact, null);
    assert.match(checked.outcomeVerifications[0].explanation, /attestation alone/i);
  });

  it("does not verify realised impact from unverified external evidence", () => {
    const decision = decisions().find((item) => item.id === "subscription-review");
    assert.ok(decision);
    const execution = WorkflowExecutionEngine.createFromDecision(decision);
    const withEvidence = WorkflowExecutionEngine.addEvidence(execution, {
      type: "provider confirmation",
      source: "Provider email",
      documentId: null,
      factId: null,
      uploadedAt: "2026-07-18T08:00:00.000Z",
      effectiveDate: "2026-07-18",
      verifiedAt: null,
      confidence: "Medium",
      verificationStatus: "Unverified",
      notes: "Email has been uploaded but not verified.",
      satisfiesRequirementIds: ["outcome-verification"],
    }).execution;
    const checked = WorkflowExecutionEngine.evaluateOutcome(withEvidence, withEvidence.outcomeVerifications[0].expectedValue, [withEvidence.evidence[0].id]);
    assert.equal(checked.outcomeStatus, "Evidence Pending");
    assert.equal(checked.realisedImpact, null);
  });

  it("keeps refinance savings unverified until post-action evidence exists", () => {
    const decision = decisions().find((item) => item.id === "refinance-mortgage-rate");
    assert.ok(decision);
    const execution = WorkflowExecutionEngine.createFromDecision(decision);
    const withEvidence = WorkflowExecutionEngine.addEvidence(execution, {
      type: "document",
      source: "New loan statement",
      documentId: "doc-loan-new",
      factId: "loan-repayment",
      uploadedAt: "2026-07-18T08:00:00.000Z",
      effectiveDate: "2026-07-18",
      verifiedAt: "2026-07-18T08:00:00.000Z",
      confidence: "High",
      notes: "New repayment evidence",
      satisfiesRequirementIds: ["verify-realised-savings"],
    }).execution;
    const verified = WorkflowExecutionEngine.evaluateOutcome(withEvidence, 186, [withEvidence.evidence[0].id]);
    assert.equal(verified.outcomeStatus, "Verified");
    assert.equal(verified.realisedImpact, "$186");
    assert.ok(verified.baselineSnapshotId);
    assert.ok(verified.verificationSnapshotId);
    assert.ok(verified.outcomeVerifications[0].evidenceIds.includes(withEvidence.evidence[0].id));
    assert.ok(verified.outcomeVerifications[0].completedAt);
  });

  it("prevents lower-confidence evidence from overwriting verified Vault facts", () => {
    const execution = WorkflowExecutionEngine.createFromDecision(decisions()[0]);
    const withEvidence = WorkflowExecutionEngine.addEvidence(execution, {
      type: "verified Vault fact",
      source: "Extracted document value",
      documentId: "doc-low-confidence",
      factId: "salary",
      uploadedAt: "2026-07-18T08:00:00.000Z",
      effectiveDate: "2026-07-18",
      verifiedAt: "2026-07-18T08:00:00.000Z",
      confidence: "Low",
      notes: "Low-confidence extracted value.",
      satisfiesRequirementIds: ["vault-fact-update"],
    }).execution;
    assert.equal(canEvidenceUpdateVaultFact("High", withEvidence.evidence[0]), false);
    assert.equal(canEvidenceUpdateVaultFact("Low", withEvidence.evidence[0]), true);
  });

  it("preserves professional-review requirements and template versions", () => {
    const decision = decisions().find((item) => item.id === "refinance-mortgage-rate");
    assert.ok(decision);
    const execution = WorkflowExecutionEngine.createFromDecision(decision);
    assert.equal(execution.templateVersion, "workflow-execution-v1.0");
    assert.equal(execution.professionalReviewRequired, true);
    const modelAttempt = { ...execution, professionalReviewRequired: false };
    assert.equal(execution.professionalReviewRequired, true);
    assert.equal(modelAttempt.professionalReviewRequired, false);
  });

  it("failed recalculation cannot produce a verified outcome", () => {
    const execution = WorkflowExecutionEngine.createFromDecision(decisions()[0]);
    const withEvidence = WorkflowExecutionEngine.addEvidence(execution, {
      type: "external-confirmation",
      source: "Provider",
      documentId: null,
      factId: null,
      uploadedAt: "2026-07-18T08:00:00.000Z",
      effectiveDate: "2026-07-18",
      verifiedAt: "2026-07-18T08:00:00.000Z",
      confidence: "Medium",
      notes: "Provider confirmation",
      satisfiesRequirementIds: ["outcome-verification"],
    }).execution;
    const failed = WorkflowExecutionEngine.evaluateOutcome(withEvidence, 100, [withEvidence.evidence[0].id], false);
    assert.equal(failed.outcomeStatus, "Inconclusive");
    assert.notEqual(failed.status, "Completed");
  });

  it("reopens workflows when outcome is not achieved and retains audit history", () => {
    const execution = WorkflowExecutionEngine.createFromDecision(decisions()[0]);
    const withEvidence = WorkflowExecutionEngine.addEvidence(execution, {
      type: "external-confirmation",
      source: "Provider",
      documentId: null,
      factId: null,
      uploadedAt: "2026-07-18T08:00:00.000Z",
      effectiveDate: "2026-07-18",
      verifiedAt: "2026-07-18T08:00:00.000Z",
      confidence: "Medium",
      notes: "Provider confirmation",
      satisfiesRequirementIds: ["outcome-verification"],
    }).execution;
    const reopened = WorkflowExecutionEngine.evaluateOutcome(withEvidence, 0, [withEvidence.evidence[0].id]);
    assert.equal(reopened.status, "Reopened");
    assert.ok(reopened.auditEvents.length > execution.auditEvents.length);
  });

  it("generates versioned artefacts and supersedes older versions", () => {
    const execution = WorkflowExecutionEngine.createFromDecision(decisions()[0]);
    const first = WorkflowExecutionEngine.generateArtefact(execution, "workflow-completion-report");
    const second = WorkflowExecutionEngine.generateArtefact(first, "workflow-completion-report");
    assert.equal(second.artefacts[0].status, "Current");
    assert.equal(second.artefacts[1].status, "Superseded");
    assert.ok(second.artefacts[0].disclaimer.includes("Educational"));
  });

  it("defines ten production workflow templates", () => {
    assert.equal(WorkflowExecutionEngine.templates.length, 10);
    assert.ok(WorkflowExecutionEngine.templates.every((template) => template.version === "workflow-execution-v1.0"));
  });
});

describe("ActionWorkflowStore", () => {
  const testFile = join(process.cwd(), ".tmp-action-workflows-test.json");

  before(() => {
    process.env.VIREON_ACTION_WORKFLOW_STORE_FILE = testFile;
    if (existsSync(testFile)) unlinkSync(testFile);
  });

  after(() => {
    if (existsSync(testFile)) unlinkSync(testFile);
    delete process.env.VIREON_ACTION_WORKFLOW_STORE_FILE;
  });

  it("persists workflow state and step completion", () => {
    const state = getActionWorkflowState(decisions());
    const workflow = state.workflows.find((item) => item.id === "workflow-subscription-review");
    assert.ok(workflow);
    const updated = updateActionWorkflowStep(workflow.id, workflow.steps[0].id, "Completed");
    const persisted = updated.workflows.find((item) => item.id === workflow.id);
    assert.ok(persisted);
    assert.equal(persisted.steps[0].status, "Completed");
  });

  it("persists execution evidence, artefacts and outcome verification", () => {
    const state = getActionWorkflowState(decisions());
    const workflow = state.workflows.find((item) => item.id === "workflow-subscription-review");
    assert.ok(workflow);
    const withEvidence = addActionWorkflowEvidence(workflow.id, {
      type: "transaction",
      source: "Transaction history",
      documentId: null,
      factId: "streamplus-charge",
      uploadedAt: null,
      effectiveDate: "2026-07-18",
      verifiedAt: "2026-07-18T08:00:00.000Z",
      confidence: "High",
      notes: "No subsequent charge after cancellation period",
      satisfiesRequirementIds: ["outcome-verification"],
    });
    const execution = withEvidence.executions.find((item) => item.id === workflow.id.replace(/^workflow-/, "execution-"));
    assert.ok(execution);
    const expected = execution.outcomeVerifications[0].expectedValue;
    const verified = verifyActionWorkflowOutcome(workflow.id, expected, [execution.evidence[0].id]);
    assert.equal(verified.executions.find((item) => item.id === execution.id)?.outcomeStatus, "Verified");
    const artefacted = generateActionWorkflowArtefact(workflow.id, "outcome-verification-report");
    assert.ok(artefacted.executions.find((item) => item.id === execution.id)?.artefacts.length);
  });
});
