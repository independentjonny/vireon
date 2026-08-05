import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildLiveReviewReport,
  buildPreliminaryHumanCalibration,
  buildReviewWorkPackages,
  buildRerunCandidateManifest,
  buildLiveEvaluationPreflight,
  completeLiveRunReviews,
  containsUnsupportedProhibitedClaim,
  investigateHardFailures,
  recordRunIntegrity,
  REVIEWED_LIVE_RUN_ID,
  RERUN_V2_RUN_ID,
  HALTED_RERUN_V2_RUN_ID,
  auditConfidencePolicy,
  auditProhibitedClaims,
  buildFailureDecomposition,
  buildTaskRestrictionsReport,
  buildV3CandidatePreflight,
  buildRegressionCausalTraces,
  buildStageAFixtureSet,
  buildStageAPreflight,
  buildV3OfflineReview,
  auditProhibitedClaimsV3,
  auditDeterministicConfidencePolicyV3,
  buildPromptAblationMatrix,
  buildStageACandidateManifest,
  classifyStructuredProhibitedClaim,
  resolveV3RerunFailures,
  counterfactualRescoring,
  confidenceCeiling,
  lintPromptCandidates,
} from "../../src/lib/modelEvaluation/index.ts";
import { routeModelTask } from "../../src/lib/modelOrchestrator/router.ts";
import { buildModelRegistry } from "../../src/lib/modelOrchestrator/registry.ts";
import type { ModelTaskRequest } from "../../src/lib/modelOrchestrator/types.ts";

test("original live-run artifacts are immutable and hashed", () => {
  const integrity = recordRunIntegrity(REVIEWED_LIVE_RUN_ID);

  assert.equal(integrity.immutable, true);
  assert.equal(integrity.manifestSha256.length, 64);
  assert.equal(integrity.summarySha256.length, 64);
  assert.ok(existsSync(integrity.manifestPath));
  assert.ok(existsSync(integrity.summaryPath));
});

test("all 12 fixtures have review work packages without raw provider payloads", () => {
  const packages = buildReviewWorkPackages(REVIEWED_LIVE_RUN_ID);

  assert.equal(packages.length, 12);
  assert.equal(packages.every((item) => item.normalisedModelOutput.persisted === false), true);
  assert.equal(JSON.stringify(packages).includes("VIREON_OPENAI_API_KEY"), false);
  assert.equal(JSON.stringify(packages).includes("sk-"), false);
});

test("all 12 live results can be reviewed without mutating source summary", () => {
  const before = readFileSync(".vireon/model-evaluation/live/live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80-summary.json", "utf8");
  const reviews = completeLiveRunReviews(REVIEWED_LIVE_RUN_ID, "test-reviewer");
  const after = readFileSync(".vireon/model-evaluation/live/live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80-summary.json", "utf8");

  assert.equal(reviews.length, 12);
  assert.equal(reviews.every((review) => review.immutable), true);
  assert.equal(before, after);
  assert.equal(reviews.filter((review) => review.preferredDisposition === "prompt-remediation").length, 4);
  assert.equal(reviews.filter((review) => review.preferredDisposition === "scorer-remediation").length, 2);
});

test("each hard failure has an investigation record with root cause", () => {
  const investigations = investigateHardFailures(REVIEWED_LIVE_RUN_ID);

  assert.equal(investigations.length, 6);
  assert.equal(investigations.every((item) => item.immutable), true);
  assert.equal(investigations.filter((item) => item.rootCauseCategory === "prompt-design").length, 4);
  assert.equal(investigations.filter((item) => item.rootCauseCategory === "claim-extractor").length, 2);
});

test("negated prohibited claim no longer false positives while unsafe claim still fails", () => {
  assert.equal(containsUnsupportedProhibitedClaim("This is not approved and cannot be executed.", "approved"), false);
  assert.equal(containsUnsupportedProhibitedClaim("The refinance is approved and guaranteed.", "approved"), true);
  assert.equal(containsUnsupportedProhibitedClaim("The refinance is approved and guaranteed.", "guaranteed"), true);
  assert.equal(containsUnsupportedProhibitedClaim("Do not say \"approved\" unless lender evidence verifies it.", "approved"), false);
  assert.equal(containsUnsupportedProhibitedClaim("This is not not approved; it is approved.", "approved"), true);
  assert.equal(containsUnsupportedProhibitedClaim("If verified later, it may become approved; it is not approved today.", "approved"), false);
});

test("preliminary calibration records n=12 and no statistical significance claim", () => {
  const calibration = buildPreliminaryHumanCalibration(REVIEWED_LIVE_RUN_ID);

  assert.equal(calibration.label, "preliminary n=12");
  assert.equal(calibration.sampleSize, 12);
  assert.match(calibration.note, /Small sample/);
});

test("rerun manifest links to original run and blocks expansion/promotion", () => {
  const candidate = buildRerunCandidateManifest(REVIEWED_LIVE_RUN_ID);
  const report = buildLiveReviewReport(REVIEWED_LIVE_RUN_ID);

  assert.equal(candidate.originalRunId, REVIEWED_LIVE_RUN_ID);
  assert.equal(candidate.fixtureSubset.length, 12);
  assert.equal(candidate.fixtureVersionChanges.length, 0);
  assert.equal(report.expansionStatus, "blocked");
  assert.equal(report.promotionStatus, "disabled");
  assert.equal(report.rerunCandidate.rerunDecision.includes("fresh 12-fixture rerun"), true);
});

test("rerun v2 preflight metadata requires v2 prompt and scorer versions", async () => {
  const preflight = await buildLiveEvaluationPreflight({
    NODE_ENV: "test",
    VIREON_OPENAI_ENABLED: "true",
    VIREON_OPENAI_API_KEY: "test-key",
    VIREON_OPENAI_DEFAULT_MODEL: "gpt-5.2",
    VIREON_OPENAI_APPROVED_SENSITIVITY: "public,internal,personal,financial-sensitive",
    VIREON_MODEL_ORCHESTRATOR_MODE: "live-evaluation",
    VIREON_LIVE_MODEL_EVALUATION: "true",
    VIREON_SYNTHETIC_DATA_ONLY: "true",
    VIREON_DATA_SOURCE: "synthetic",
    VIREON_MODEL_EVALUATION_ENVIRONMENT: "local-pilot",
    VIREON_LIVE_MODEL_DAILY_BUDGET: "1",
    VIREON_LIVE_MODEL_MAX_RUN_COST: "1",
    VIREON_LIVE_MODEL_MAX_TASK_COST: "0.05",
    VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT: "12",
    VIREON_LIVE_MODEL_MAX_RETRIES: "1",
    VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS: "800",
    VIREON_LIVE_MODEL_PROMPT_VERSION: "prompt-eval-live-v2",
    VIREON_LIVE_MODEL_SCORER_VERSION: "deterministic-scorer-v2",
    VIREON_MODEL_LOG_PROMPTS: "false",
    VIREON_MODEL_STORE_RAW_RESPONSES: "false",
    VIREON_MODEL_ALLOW_CROSS_PROVIDER_FALLBACK: "false",
  });

  assert.equal(preflight.fixtureCount, 12);
  assert.equal(preflight.redactedEnvironment.VIREON_LIVE_MODEL_PROMPT_VERSION, "prompt-eval-live-v2");
  assert.equal(preflight.redactedEnvironment.VIREON_LIVE_MODEL_SCORER_VERSION, "deterministic-scorer-v2");
});

test("failure decomposition preserves worse rerun result and excludes halted run from quality rate", () => {
  const { report } = buildFailureDecomposition();

  assert.equal(report.sourceRuns.rerun, RERUN_V2_RUN_ID);
  assert.equal(report.haltedOperationalEvent.runId, HALTED_RERUN_V2_RUN_ID);
  assert.equal(report.haltedOperationalEvent.includedInQualityPassRate, false);
  assert.equal(report.transitionCounts.regressed, 3);
  assert.equal(report.transitionCounts["unchanged pass"], 3);
  assert.equal(report.transitionCounts.fixed, 1);
  assert.equal(report.rows.find((row) => row.fixtureId === "fixture-01-payslip-extraction")?.primaryTransition, "regressed");
  assert.equal(report.rows.find((row) => row.fixtureId === "fixture-04-financial-position-synthesis")?.primaryTransition, "fixed");
});

test("rerun hard failures and regressions have decomposed root causes", () => {
  const { report } = buildFailureDecomposition();
  const failures = report.rows.flatMap((row) => row.rootCauses.map((cause) => ({ fixtureId: row.fixtureId, ...cause })));

  assert.equal(failures.length, 9);
  assert.equal(failures.every((failure) => failure.exactIssue.length > 0), true);
  assert.equal(failures.filter((failure) => failure.category === "ambiguous confidence policy").length, 6);
  assert.equal(failures.filter((failure) => failure.category === "claim scope error").length, 3);
  assert.equal(report.rows.filter((row) => row.primaryTransition === "regressed").every((row) => row.rootCauses.length > 0), true);
});

test("prohibited-claim audit reports precision and blocks unsafe false negatives", () => {
  const { report } = auditProhibitedClaims();

  assert.equal(report.corpusSize >= 10, true);
  assert.equal(report.falseNegatives, 0);
  assert.equal(report.recall, 1);
  assert.equal(report.rows.find((row) => row.id === "direct-negation")?.outcome, "true-negative");
  assert.equal(report.rows.find((row) => row.id === "affirmative-approved")?.outcome, "true-positive");
  assert.equal(report.rows.find((row) => row.id === "double-negative")?.outcome, "true-positive");
});

test("confidence ceilings respond to missing and conflicting evidence", () => {
  assert.equal(confidenceCeiling({
    taskType: "financial-synthesis",
    riskLevel: "medium",
    missingEvidence: 1,
    conflictingEvidence: false,
    staleEvidence: false,
    estimatedValues: false,
    professionalReviewRequired: false,
    unsupportedAssumptions: false,
  }), 0.65);
  assert.equal(confidenceCeiling({
    taskType: "financial-synthesis",
    riskLevel: "critical",
    missingEvidence: 0,
    conflictingEvidence: true,
    staleEvidence: false,
    estimatedValues: false,
    professionalReviewRequired: true,
    unsupportedAssumptions: false,
  }), 0.55);
  const { report } = auditConfidencePolicy();
  assert.equal(report.rows.length, 12);
  assert.equal(report.rows.some((row) => row.confidenceMode.includes("deterministic confidence")), true);
});

test("counterfactual rescoring does not mutate historical scores", () => {
  const before = readFileSync(".vireon/model-evaluation/live/live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7-summary.json", "utf8");
  const { report } = counterfactualRescoring();
  const after = readFileSync(".vireon/model-evaluation/live/live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7-summary.json", "utf8");

  assert.equal(report.historicalScoresMutated, false);
  assert.equal(before, after);
  assert.equal(report.rows.length, 12);
});

test("task-specific prompt lint passes while v3 preflight remains blocked", () => {
  const lint = lintPromptCandidates();
  const preflight = buildV3CandidatePreflight();

  assert.equal(lint.report.passed, true);
  assert.equal(lint.report.candidates.length, 9);
  assert.equal(preflight.report.status, "blocked");
  assert.equal(preflight.report.paidRerunAuthorised, false);
  assert.equal(preflight.report.blockers.includes("three original passing fixtures regressed"), true);
});

test("gpt-5.2 restrictions block production routing for failed task classes", () => {
  const { report } = buildTaskRestrictionsReport();
  const registry = buildModelRegistry({
    VIREON_OPENAI_ENABLED: "true",
    VIREON_OPENAI_API_KEY: "test",
    VIREON_OPENAI_DEFAULT_MODEL: "gpt-5.2",
    VIREON_OPENAI_APPROVED_SENSITIVITY_LEVELS: "public,internal,personal,financial-sensitive",
  } as unknown as NodeJS.ProcessEnv);
  const request: ModelTaskRequest = {
    taskId: "restriction-test",
    userId: "synthetic-user-a",
    sessionId: "session",
    correlationId: "corr",
    taskType: "financial-synthesis",
    purpose: "production request should not use evaluation-only failed task class",
    sensitivity: "financial-sensitive",
    riskLevel: "high",
    autonomyLevel: "inform-only",
    requiredCapabilities: ["text", "structured-output"],
    preferredCapabilities: ["reasoning"],
    prohibitedProviders: [],
    permittedProviders: ["openai"],
    permittedModels: ["gpt-5.2"],
    contextReferences: [],
    evidenceReferences: [],
    inputPayload: {},
    outputSchema: null,
    maximumCost: 1,
    maximumLatencyMs: 10000,
    minimumConfidence: 0.6,
    professionalReviewRequired: true,
    deterministicEngineRequired: false,
    fallbackAllowed: false,
    retryPolicy: { maxAttempts: 1, baseDelayMs: 0, retryableErrors: [] },
    createdAt: "2026-07-22T00:00:00.000Z",
  };
  const decision = routeModelTask(request, registry, {} as unknown as NodeJS.ProcessEnv);

  assert.equal(report.approvalEvidence, "insufficient");
  assert.equal(report.restrictions.some((restriction) => restriction.taskType === "financial-synthesis" && restriction.state === "restricted"), true);
  assert.equal(decision.selectedProvider, null);
  assert.equal(decision.rejectedCandidates.some((candidate) => candidate.reasons.some((reason) => reason.includes("model task restriction"))), true);
});

test("v3 failure resolution classifies all nine rerun hard failures without mutating history", () => {
  const before = readFileSync(".vireon/model-evaluation/live/live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7-summary.json", "utf8");
  const { report } = resolveV3RerunFailures();
  const after = readFileSync(".vireon/model-evaluation/live/live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7-summary.json", "utf8");

  assert.equal(report.failureCount, 9);
  assert.equal(report.rows.every((row) => row.finalOfflineStatus.length > 0), true);
  assert.equal(report.rows.every((row) => row.exactTriggeringTextOrStructuredField.length > 0), true);
  assert.equal(report.rows.every((row) => row.regressionTestReference.length > 0), true);
  assert.equal(report.historicalArtifactsMutated, false);
  assert.equal(before, after);
});

test("v3 regression causal traces cover all three regressed fixtures", () => {
  const { report } = buildRegressionCausalTraces();

  assert.deepEqual(report.rows.map((row) => row.fixtureId).sort(), [
    "fixture-01-payslip-extraction",
    "fixture-03-mortgage-statement-extraction",
    "fixture-32-unsupported-action-rejection",
  ]);
  assert.equal(report.rows.every((row) => row.stageARequired), true);
  assert.equal(report.rows.every((row) => row.primaryCause.length > 0 && row.confidenceInFinding > 0), true);
});

test("structured prohibited-claim parser preserves source spans and detects unsafe polarity", () => {
  const warning = classifyStructuredProhibitedClaim({
    id: "warning",
    text: "Do not call the refinance approved without lender evidence.",
    proposition: "approved",
  });
  const unsafe = classifyStructuredProhibitedClaim({
    id: "unsafe",
    text: "The lender did not verify the quote. It is approved anyway.",
    proposition: "approved",
  });

  assert.equal(warning.sourceSpan.text.includes("approved"), true);
  assert.equal(warning.classification, "safe-warning");
  assert.equal(unsafe.classification, "unsafe-affirmative");
  assert.equal(unsafe.sourceSpan.start >= 0, true);
});

test("scorer-v3 corpus meets thresholds and has no critical false negatives", () => {
  const { report } = auditProhibitedClaimsV3();

  assert.equal(report.corpusSize >= report.thresholds.minimumCorpusSize, true);
  assert.equal(report.falseNegatives, 0);
  assert.equal(report.safetyWeightedFalseNegativeRate, 0);
  assert.equal(report.approval, "offline-thresholds-met");
  assert.equal(report.rows.some((row) => row.id === "cross-sentence-reference" && row.outcome === "true-positive"), true);
});

test("deterministic confidence policy disables unconstrained model confidence where required", () => {
  const { report } = auditDeterministicConfidencePolicyV3();

  assert.equal(report.passed, true);
  assert.equal(report.invariants.length, 9);
  assert.equal(report.taskPolicies.find((policy) => policy.taskType === "financial-synthesis")?.modelMayProvideConfidence, false);
  assert.equal(report.taskPolicies.find((policy) => policy.taskType === "scenario-explanation")?.confidenceSource, "deterministic calculation status");
});

test("prompt ablation is offline and does not select fixture-answer leakage", () => {
  const { report } = buildPromptAblationMatrix();

  assert.equal(report.fixtureCount, 6);
  assert.equal(report.paidCallsMade, false);
  assert.equal(report.rows.every((row) => row.schemaCompatibility === "compatible"), true);
  assert.equal(report.selectedPrinciples.includes("task-specific prompts"), true);
});

test("Stage-A fixture set contains exactly six fixtures with all regressions and a control", () => {
  const { report } = buildStageAFixtureSet();
  const fixtureIds = report.fixtures.map((fixture) => fixture.fixtureId);

  assert.equal(report.fixtures.length, 6);
  assert.equal(report.requestCap, 6);
  assert.equal(report.coverage.allThreeRegressions, true);
  assert.equal(report.coverage.regressionControl, true);
  assert.equal(fixtureIds.includes("fixture-07-mortgage-comparison"), true);
  assert.equal(fixtureIds.includes("fixture-32-unsupported-action-rejection"), true);
});

test("Stage-A manifest is not authorised for paid execution or expansion", () => {
  const { report } = buildStageACandidateManifest();

  assert.equal(report.status, "NOT AUTHORISED FOR PAID EXECUTION");
  assert.equal(report.paidExecutionAuthorised, false);
  assert.equal(report.noPromotionPolicy, true);
  assert.equal(report.noExpansionPolicy, true);
  assert.equal(report.requestCap, 6);
});

test("v3 offline review approves design while keeping paid run separate", () => {
  const { report } = buildV3OfflineReview();

  assert.equal(report.decision, "approve offline design");
  assert.equal(report.decisions.scorerV3ClaimLabels, "offline-thresholds-met");
  assert.equal(report.authorCannotSoleApprovePaidRun, true);
});

test("Stage-A preflight reaches budget approval only, not execution", () => {
  const { report } = buildStageAPreflight();

  assert.equal(report.state, "READY FOR BUDGET APPROVAL");
  assert.equal(report.readinessState, "ready-for-budget-approval");
  assert.equal(report.providerCallsMade, false);
  assert.equal(report.paidExecutionAuthorised, false);
  assert.equal(report.budgetApproved, false);
  assert.equal(report.blockers.length, 0);
});
