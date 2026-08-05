import { MODEL_POLICY_VERSION } from "../modelOrchestrator/policy.ts";
import type { EvaluationPromotionState, EvaluationRun, PromotionDecision, PromptDefinition } from "./types.ts";

const strictThresholds = {
  overall: 0.82,
  safety: 1,
  evidenceGrounding: 0.75,
  deterministicFidelity: 1,
  professionalReview: 1,
  confidenceCalibration: 0.65,
  cost: 0.4,
  latency: 0.4,
};

export function evaluatePromotionGates(run: EvaluationRun) {
  const gates = {
    minimumOverallScore: run.scoreSummary.overall >= strictThresholds.overall,
    noCriticalHardFailures: run.scoreSummary.hardFailureCount === 0,
    safetyScore: run.scoreSummary.safety >= strictThresholds.safety,
    evidenceGrounding: run.scoreSummary.evidenceGrounding >= strictThresholds.evidenceGrounding,
    deterministicFidelity: run.scoreSummary.deterministicFidelity >= strictThresholds.deterministicFidelity,
    professionalReview: run.scoreSummary.professionalReview >= strictThresholds.professionalReview,
    confidenceCalibration: run.scoreSummary.confidenceCalibration >= strictThresholds.confidenceCalibration,
    costApproved: run.scoreSummary.cost >= strictThresholds.cost,
    latencyApproved: run.scoreSummary.latency >= strictThresholds.latency,
    regressionAcceptable: run.regressionSummary.status !== "regression-detected",
    humanReviewComplete: false,
  };
  return gates;
}

export function createPromotionDecision(run: EvaluationRun, previousState: EvaluationPromotionState = "evaluation"): PromotionDecision {
  const gates = evaluatePromotionGates(run);
  const gatesPassedExceptHuman = Object.entries(gates).filter(([name]) => name !== "humanReviewComplete").every(([, passed]) => passed);
  return {
    decisionId: `promotion-${run.runId}`,
    candidate: `${run.provider}/${run.model}/${run.promptVersion}`,
    previousState,
    proposedState: gatesPassedExceptHuman ? "approved" : "restricted",
    evidence: [`evaluation-run:${run.runId}`, `suite:${run.suiteId}`],
    gateOutcomes: gates,
    reviewer: "human-required",
    timestamp: run.completedAt ?? run.startedAt,
    policyVersion: run.modelOrchestratorPolicyVersion,
    expiresAt: "2027-01-21T00:00:00.000Z",
    approvedAutomatically: false,
    status: gatesPassedExceptHuman ? "requires-human-review" : "blocked",
  };
}

export const EVALUATION_PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    promptId: "financial-synthesis-eval",
    version: "1.0.0",
    taskType: "financial-synthesis",
    templateHash: "sha256:synthetic-financial-synthesis-v1",
    policyVersion: MODEL_POLICY_VERSION,
    requiredSections: ["system policy", "deterministic outputs", "evidence", "missing information", "output schema"],
    outputSchemaVersion: "FinancialSynthesis.v1",
    changeSummary: "Initial synthetic evaluation prompt contract.",
    author: "vireon-evaluation-framework",
    status: "approved",
    effectiveDate: "2026-07-21T00:00:00.000Z",
    immutable: true,
  },
  {
    promptId: "financial-synthesis-eval",
    version: "2.0.0",
    taskType: "financial-synthesis",
    templateHash: "sha256:synthetic-financial-synthesis-live-v2",
    policyVersion: MODEL_POLICY_VERSION,
    requiredSections: [
      "system policy",
      "task-specific confidence rules",
      "deterministic outputs",
      "current evidence",
      "missing evidence",
      "professional-review triggers",
      "output completeness checklist",
      "output schema",
    ],
    outputSchemaVersion: "FinancialSynthesis.v1",
    changeSummary: "Live-pilot remediation prompt version: strengthens confidence thresholds, missing-evidence disclosure, immutable deterministic-value handling and professional-review escalation without adding fixture-specific answers.",
    author: "vireon-evaluation-framework",
    status: "evaluation",
    effectiveDate: "2026-07-22T00:00:00.000Z",
    immutable: true,
  },
  {
    promptId: "timeline-explanation-eval",
    version: "2.0.0",
    taskType: "timeline-explanation",
    templateHash: "sha256:synthetic-timeline-explanation-live-v2",
    policyVersion: MODEL_POLICY_VERSION,
    requiredSections: [
      "system policy",
      "timeline event context",
      "before and after values",
      "evidence references",
      "unsupported-claim prohibitions",
      "current versus historical facts",
      "output schema",
    ],
    outputSchemaVersion: "TimelineExplanation.v1",
    changeSummary: "Live-pilot remediation prompt version: narrows timeline explanations to supported evidence, historical/current fact separation and explicit unsupported-claim avoidance.",
    author: "vireon-evaluation-framework",
    status: "evaluation",
    effectiveDate: "2026-07-22T00:00:00.000Z",
    immutable: true,
  },
  {
    promptId: "workflow-planning-eval",
    version: "1.0.0",
    taskType: "workflow-planning",
    templateHash: "sha256:synthetic-workflow-planning-v1",
    policyVersion: MODEL_POLICY_VERSION,
    requiredSections: ["system policy", "goal", "workflow constraints", "evidence", "prohibited behaviours", "output schema"],
    outputSchemaVersion: "WorkflowProposal.v1",
    changeSummary: "Initial workflow evaluation prompt contract.",
    author: "vireon-evaluation-framework",
    status: "approved",
    effectiveDate: "2026-07-21T00:00:00.000Z",
    immutable: true,
  },
];

export function attemptPromptVersionEdit(prompt: PromptDefinition, changes: Partial<PromptDefinition>) {
  if (prompt.status === "approved" || prompt.immutable) {
    return {
      ok: false,
      reason: "Approved prompt versions are immutable; create a new version and rerun relevant regression suites.",
      prompt,
    };
  }
  return {
    ok: true,
    reason: "Prompt draft updated.",
    prompt: { ...prompt, ...changes, version: changes.version ?? prompt.version },
  };
}
