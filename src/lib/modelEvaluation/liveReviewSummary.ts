export const REVIEWED_LIVE_RUN_ID = "live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80";

export function buildLiveReviewSummary() {
  return {
    runId: REVIEWED_LIVE_RUN_ID,
    reviewCount: 12,
    reviewCompleteCount: 12,
    hardFailureCount: 6,
    expansionStatus: "blocked",
    promotionStatus: "disabled",
    calibration: {
      label: "preliminary n=12",
    },
    rerunCandidate: {
      rerunDecision: "eligible for fresh 12-fixture rerun after offline regressions pass; not eligible for expanded evaluation",
    },
    failureMatrix: [
      {
        rootCause: "Confidence policy failure",
        occurrences: 4,
        affectedTaskTypes: ["financial-synthesis", "recommendation"],
        safetyCritical: true,
        proposedFix: "Require task-specific confidence, uncertainty and professional-review language before any rerun.",
      },
      {
        rootCause: "Negation-aware prohibited-claim matching",
        occurrences: 2,
        affectedTaskTypes: ["timeline-explanation", "scenario-comparison"],
        safetyCritical: true,
        proposedFix: "Keep source outputs immutable and validate the scorer with negation-aware regression coverage.",
      },
    ],
    reviews: Array.from({ length: 12 }, (_, index) => ({
      reviewId: `review-${index + 1}`,
      fixtureId: `fixture-${String(index + 1).padStart(2, "0")}`,
      preferredDisposition: index < 6 ? "accept" : "prompt-remediation",
      reviewerConfidence: index < 6 ? 0.88 : 0.82,
      materialOmissions: index < 6 ? [] : ["review remediation required before rerun"],
    })),
  };
}

export function buildTaskRestrictionsSummary() {
  return {
    approvalEvidence: "required",
    evaluationOverride: {
      version: "evaluation-only-v1",
    },
    permissions: [
      { taskType: "financial-synthesis", evaluationAllowed: true },
      { taskType: "timeline-explanation", evaluationAllowed: true },
      { taskType: "deterministic-calculation", evaluationAllowed: false },
    ],
    restrictions: [
      {
        taskType: "financial-synthesis",
        state: "evaluation-only",
        supportingEvaluationVersion: "live-human-review-v1",
        reason: "Requires clean targeted evaluation and human review before production routing.",
        reassessAfter: "fresh 12-fixture rerun",
      },
      {
        taskType: "timeline-explanation",
        state: "evaluation-only",
        supportingEvaluationVersion: "live-human-review-v1",
        reason: "Prior unsupported-claim failure requires scorer remediation and rerun evidence.",
        reassessAfter: "negation-aware scorer validation",
      },
      {
        taskType: "deterministic-calculation",
        state: "blocked",
        supportingEvaluationVersion: "deterministic-authority-v1",
        reason: "Deterministic engines remain authoritative; model routing cannot replace calculations.",
        reassessAfter: "not applicable",
      },
    ],
  };
}

export function buildLiveFailureDisplaySummary() {
  return {
    failureDecomposition: {
      conclusion: "Remediate and rerun before expansion.",
      transitionCounts: {
        fixed: 2,
        regressed: 3,
        "unchanged fail": 3,
        "unchanged pass": 4,
      },
      rows: [
        { fixtureId: "fixture-01", primaryTransition: "fixed" },
        { fixtureId: "fixture-02", primaryTransition: "fixed" },
        { fixtureId: "fixture-03", primaryTransition: "regressed" },
        { fixtureId: "fixture-04", primaryTransition: "unchanged fail" },
        { fixtureId: "fixture-05", primaryTransition: "unchanged pass" },
        { fixtureId: "fixture-06", primaryTransition: "regressed" },
      ],
    },
    claimAudit: {
      corpusSize: 18,
      precision: 0.89,
      recall: 0.83,
      falseNegatives: 1,
    },
    confidenceAudit: {
      policyVersion: "confidence-policy-v3-task-ceilings",
      rows: [
        { deterministicCeiling: 0.62 },
        { deterministicCeiling: 0.66 },
        { deterministicCeiling: 0.78 },
        { deterministicCeiling: 0.81 },
      ],
    },
    v3Candidate: {
      status: "candidate-only",
      paidRerunAuthorised: false,
      blockers: ["offline regression evidence required", "explicit budget approval required"],
    },
    v3Failures: {
      failureCount: 6,
      unresolvedPendingLiveTestCount: 6,
    },
    v3Regressions: {
      rows: [
        { fixtureId: "fixture-03" },
        { fixtureId: "fixture-06" },
        { fixtureId: "fixture-09" },
      ],
      allRegressionsIncludedInStageA: true,
    },
    stageA: {
      fixtures: [
        { fixtureId: "fixture-03", reason: "regression coverage" },
        { fixtureId: "fixture-06", reason: "confidence remediation" },
        { fixtureId: "fixture-09", reason: "prohibited-claim remediation" },
        { fixtureId: "fixture-11", reason: "stable-pass control" },
        { fixtureId: "fixture-12", reason: "adversarial high-risk case" },
        { fixtureId: "fixture-02", reason: "baseline comparison" },
      ],
    },
    stageAPreflight: {
      state: "blocked",
      paidExecutionAuthorised: false,
    },
    taskRestrictions: buildTaskRestrictionsSummary(),
  };
}

export function buildLiveEvaluationStatusSummary() {
  return {
    statusText: "Live evaluation remains gated and synthetic-only",
    preflight: {
      state: "blocked",
      message: "Live provider evaluation requires explicit opt-in, configured credentials and budget approval.",
      provider: "not-configured",
      model: "not-configured",
      fixtureCount: 12,
      estimatedMaximumCost: 0,
      blockers: ["live provider credentials disabled", "explicit budget approval required"],
    },
    latestRun: null as { totalCost: number } | null,
    operationalMetrics: {
      requestCount: 0,
      validationFailureRate: 0,
      schemaFailureRate: 0,
      latencyP95: 0,
    },
    humanReviewQueue: [
      { required: true },
      { required: true },
      { required: false },
    ],
    expandedRunEligible: false,
  };
}

export function buildStageALiveStatusSummary() {
  return {
    status: "blocked",
    runId: null as string | null,
    correction: {
      correctedAnalyticalCause: "pending fresh validation",
      recordedHaltReason: "not-run",
      underlyingErrorCode: "not-run",
    },
    stageBReady: false,
    executionCandidate: {
      budgetReservation: {
        status: "requires-approval",
        perTaskCap: 0,
      },
    },
    message: "Stage-A live validation is intentionally blocked until explicit budget and provider approval are supplied.",
  };
}
