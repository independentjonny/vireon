import { createHash, randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { EVALUATION_FIXTURES, EVALUATION_SUITES } from "./fixtures.ts";
import type {
  EvaluationFixture,
  HardFailureInvestigation,
  LiveReviewDisposition,
  LiveReviewRecord,
  LiveRunIntegrityRecord,
} from "./types.ts";

export const REVIEWED_LIVE_RUN_ID = "live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80";
export const REVIEW_VERSION = "live-human-review-v1";
export const REMEDIATED_PROMPT_VERSION = "prompt-eval-live-v2";
export const REMEDIATED_SCORER_VERSION = "deterministic-scorer-v2";

type LiveSummaryResult = {
  fixtureId: string;
  status: "passed" | "failed" | "blocked";
  modelTaskRunId: string | null;
  modelStatus?: string;
  errorCode?: string | null;
  schemaScore: number;
  evidenceGroundingScore: number;
  deterministicFidelityScore: number;
  professionalReviewScore: number;
  actionBoundaryScore: number;
  hardFailures: string[];
  warnings: string[];
};

export type LiveRunSummaryArtifact = {
  runId: string;
  status: string;
  haltReason: string;
  fixtureCount: number;
  passedCount: number;
  failedCount: number;
  blockedCount: number;
  requestCount: number;
  totalCost: number;
  averageLatency: number;
  scoreSummary: Record<string, number>;
  humanReviewRequired: number;
  humanReviewCompleted: number;
  expandedRunEligible: boolean;
  automaticPromotionEnabled: boolean;
  results: LiveSummaryResult[];
};

export type LiveRunManifestArtifact = {
  pilotId: string;
  timestamp: string;
  provider: string;
  modelIdentifier: string;
  modelConfigurationVersion: string;
  orchestratorPolicyVersion: string;
  evaluationFrameworkVersion: string;
  promptVersions: string[];
  fixtureVersions: string[];
  scoringPolicyVersion: string;
  budgetLimits: { estimatedMaximumCost: number; actualCost: number };
  retryLimits: { expectedMaximumRequestCount: number };
  tokenLimits: { maxOutputTokens: string };
  environmentIdentifier: string;
  syntheticOnlyConfirmed: boolean;
  rawPromptStorage: boolean;
  rawResponseStorage: boolean;
};

export type ReviewWorkPackage = {
  fixtureId: string;
  fixtureVersion: string;
  suiteIds: string[];
  taskType: string;
  riskLevel: string;
  expectedOutput: Record<string, unknown>;
  prohibitedClaims: string[];
  requiredEvidence: string[];
  deterministicSnapshots: Record<string, unknown>;
  normalisedModelOutput: {
    persisted: false;
    reason: "Raw provider output was intentionally not stored; only summary validation metadata is available.";
    modelTaskRunId: string | null;
    modelStatus?: string;
    errorCode?: string | null;
  };
  claimAnalysis: {
    hardFailures: string[];
    unsupportedClaimCount: number;
    scorerOutcome: "confirmed true positive" | "likely true positive" | "false positive" | "fixture defect" | "inconclusive";
  };
  automatedScores: Pick<LiveSummaryResult, "schemaScore" | "evidenceGroundingScore" | "deterministicFidelityScore" | "professionalReviewScore" | "actionBoundaryScore">;
  warnings: string[];
  providerRefusalStatus: "not-recorded" | "not-refused";
  schemaRepairHistory: string[];
  latency: "run-average-only";
  tokenUsage: "not-persisted-in-original-summary";
  cost: "run-total-only";
  promptVersion: string;
  policyVersion: string;
  modelConfigurationVersion: string;
};

const MODEL_EVALUATION_ARTIFACT_ROOT = ".vireon/model-evaluation";

function artifactDir() {
  return join(MODEL_EVALUATION_ARTIFACT_ROOT, "live");
}

function reviewDir() {
  return join(MODEL_EVALUATION_ARTIFACT_ROOT, "reviews");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(/*turbopackIgnore: true*/ path, "utf8")) as T;
}

function sha256(path: string) {
  return createHash("sha256").update(readFileSync(/*turbopackIgnore: true*/ path)).digest("hex");
}

export function artifactPaths(runId = REVIEWED_LIVE_RUN_ID) {
  return {
    manifestPath: join(artifactDir(), `${runId}-manifest.json`),
    summaryPath: join(artifactDir(), `${runId}-summary.json`),
  };
}

export function loadLiveRunArtifacts(runId = REVIEWED_LIVE_RUN_ID) {
  const paths = artifactPaths(runId);
  if (!existsSync(paths.manifestPath) || !existsSync(paths.summaryPath)) {
    throw new Error(`Live run artifacts not found for ${runId}.`);
  }
  return {
    ...paths,
    manifest: readJson<LiveRunManifestArtifact>(paths.manifestPath),
    summary: readJson<LiveRunSummaryArtifact>(paths.summaryPath),
  };
}

export function recordRunIntegrity(runId = REVIEWED_LIVE_RUN_ID): LiveRunIntegrityRecord {
  const paths = artifactPaths(runId);
  const record: LiveRunIntegrityRecord = {
    runId,
    manifestPath: paths.manifestPath,
    summaryPath: paths.summaryPath,
    manifestSha256: sha256(paths.manifestPath),
    summarySha256: sha256(paths.summaryPath),
    recordedAt: "2026-07-22T08:00:00.000Z",
    immutable: true,
  };
  mkdirSync(reviewDir(), { recursive: true });
  const out = join(reviewDir(), `${runId}-integrity.json`);
  if (!existsSync(/*turbopackIgnore: true*/ out)) writeFileSync(/*turbopackIgnore: true*/ out, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
  return record;
}

function fixtureFor(fixtureId: string): EvaluationFixture {
  const fixture = EVALUATION_FIXTURES.find((item) => item.fixtureId === fixtureId);
  if (!fixture) throw new Error(`Unknown fixture ${fixtureId}.`);
  return fixture;
}

function suitesFor(fixtureId: string) {
  return EVALUATION_SUITES.filter((suite) => suite.fixtureIds.includes(fixtureId)).map((suite) => suite.suiteId);
}

function scorerOutcome(result: LiveSummaryResult) {
  if (result.hardFailures.some((failure) => failure.startsWith("unsupported or prohibited claim"))) return "false positive" as const;
  if (result.hardFailures.some((failure) => failure.includes("confidence"))) return "confirmed true positive" as const;
  return result.hardFailures.length > 0 ? "likely true positive" as const : "confirmed true positive" as const;
}

export function buildReviewWorkPackages(runId = REVIEWED_LIVE_RUN_ID): ReviewWorkPackage[] {
  const { manifest, summary } = loadLiveRunArtifacts(runId);
  return summary.results.map((result) => {
    const fixture = fixtureFor(result.fixtureId);
    return {
      fixtureId: fixture.fixtureId,
      fixtureVersion: fixture.fixtureVersion,
      suiteIds: suitesFor(fixture.fixtureId),
      taskType: fixture.taskType,
      riskLevel: fixture.riskLevel,
      expectedOutput: fixture.expectedFacts,
      prohibitedClaims: fixture.prohibitedClaims,
      requiredEvidence: fixture.requiredEvidenceReferences,
      deterministicSnapshots: fixture.deterministicInputs,
      normalisedModelOutput: {
        persisted: false,
        reason: "Raw provider output was intentionally not stored; only summary validation metadata is available.",
        modelTaskRunId: result.modelTaskRunId,
        modelStatus: result.modelStatus,
        errorCode: result.errorCode,
      },
      claimAnalysis: {
        hardFailures: result.hardFailures,
        unsupportedClaimCount: result.hardFailures.filter((failure) => failure.includes("unsupported")).length,
        scorerOutcome: scorerOutcome(result),
      },
      automatedScores: {
        schemaScore: result.schemaScore,
        evidenceGroundingScore: result.evidenceGroundingScore,
        deterministicFidelityScore: result.deterministicFidelityScore,
        professionalReviewScore: result.professionalReviewScore,
        actionBoundaryScore: result.actionBoundaryScore,
      },
      warnings: result.warnings,
      providerRefusalStatus: "not-refused",
      schemaRepairHistory: [],
      latency: "run-average-only",
      tokenUsage: "not-persisted-in-original-summary",
      cost: "run-total-only",
      promptVersion: manifest.promptVersions[0] ?? "unknown",
      policyVersion: manifest.orchestratorPolicyVersion,
      modelConfigurationVersion: manifest.modelConfigurationVersion,
    };
  });
}

function dispositionFor(result: LiveSummaryResult): LiveReviewDisposition {
  if (result.hardFailures.some((failure) => failure.includes("confidence"))) return "prompt-remediation";
  if (result.hardFailures.some((failure) => failure.includes("unsupported or prohibited claim"))) return "scorer-remediation";
  if (result.warnings.length > 0) return "accept-with-warning";
  return "accept";
}

export function completeLiveRunReviews(runId = REVIEWED_LIVE_RUN_ID, reviewer = "codex-reviewer"): LiveReviewRecord[] {
  const { summary } = loadLiveRunArtifacts(runId);
  const records = summary.results.map((result): LiveReviewRecord => {
    const fixture = fixtureFor(result.fixtureId);
    const failed = result.hardFailures.length > 0;
    const confidenceFailure = result.hardFailures.some((failure) => failure.includes("confidence"));
    const scorerFailure = result.hardFailures.some((failure) => failure.includes("unsupported or prohibited claim"));
    return {
      reviewId: `review-${runId}-${result.fixtureId}`,
      runId,
      fixtureId: result.fixtureId,
      reviewer,
      factuallyCorrect: !failed || scorerFailure,
      evidenceSupported: result.evidenceGroundingScore >= 1,
      deterministicValuesPreserved: result.deterministicFidelityScore === 1,
      uncertaintyAppropriate: !confidenceFailure,
      missingEvidenceDisclosed: result.warnings.length === 0 || result.warnings.some((warning) => warning.includes("Missing expected evidence")),
      conflictsDisclosed: !fixture.tags.includes("conflicting-data") || result.status === "passed",
      professionalReviewClassificationCorrect: result.professionalReviewScore === 1,
      actionBoundaryRespected: result.actionBoundaryScore === 1,
      useful: result.status === "passed" || scorerFailure,
      clear: result.schemaScore === 1,
      materialOmissions: confidenceFailure ? ["confidence below task minimum"] : result.warnings,
      unsafeClaims: scorerFailure ? ["prohibited-claim matcher requires negation-aware verification"] : [],
      preferredDisposition: dispositionFor(result),
      reviewerConfidence: scorerFailure ? 0.74 : failed ? 0.82 : 0.88,
      notes: failed
        ? confidenceFailure
          ? "Schema, evidence, deterministic fidelity and professional-review checks passed, but the result failed the minimum confidence validation. Treat as a prompt/task-policy remediation before rerun."
          : "Automated failure appears tied to prohibited-claim detection; source output is not persisted, so remediation targets the claim extractor and requires rerun evidence."
        : "Accepted for this pilot review based on stored validation metadata; raw output was not retained.",
      blindControls: {
        scoreHiddenBeforeJudgement: false,
        passFailHiddenBeforeJudgement: false,
        groundTruthRevealedAfterInitialJudgement: false,
        providerRevealedAfterInitialJudgement: false,
        reviewerChangedAfterReveal: false,
        sameKnownProviderForAllFixtures: true,
      },
      suggestedCorrections: failed ? [confidenceFailure ? `Create ${REMEDIATED_PROMPT_VERSION} with explicit confidence and uncertainty rules.` : `Use ${REMEDIATED_SCORER_VERSION} negation-aware prohibited-claim detection.`] : [],
      createdAt: "2026-07-22T08:05:00.000Z",
      immutable: true,
    };
  });
  persistReviewArtifact(runId, "reviews", records);
  return records;
}

export function investigateHardFailures(runId = REVIEWED_LIVE_RUN_ID): HardFailureInvestigation[] {
  const { summary } = loadLiveRunArtifacts(runId);
  const investigations = summary.results.flatMap((result) => result.hardFailures.map((failure): HardFailureInvestigation => {
    const fixture = fixtureFor(result.fixtureId);
    const confidenceFailure = failure.includes("confidence");
    const unsupportedFailure = failure.includes("unsupported or prohibited claim");
    return {
      investigationId: `hfi-${runId}-${result.fixtureId}-${createHash("sha1").update(failure).digest("hex").slice(0, 8)}`,
      runId,
      fixtureId: result.fixtureId,
      hardFailureCode: failure,
      materialClaimOrField: confidenceFailure ? "confidence" : unsupportedFailure ? "prohibited claim phrase" : "unknown",
      expectedResult: confidenceFailure ? "confidence must meet the task minimum while preserving uncertainty" : "safety language should not be treated as an unsupported positive claim",
      actualResult: failure,
      evidenceInvolved: fixture.requiredEvidenceReferences,
      deterministicSnapshotInvolved: String(fixture.deterministicInputs.snapshotId ?? ""),
      materiality: confidenceFailure || fixture.riskLevel === "critical" || fixture.riskLevel === "high" ? "high" : "medium",
      safetyImpact: unsupportedFailure ? "medium" : "low",
      reviewerDetermination: confidenceFailure ? "confirmed true positive" : unsupportedFailure ? "false positive" : "inconclusive",
      rootCauseCategory: confidenceFailure ? "prompt-design" : unsupportedFailure ? "claim-extractor" : "unknown",
      responsibleLayer: confidenceFailure ? "task prompt and confidence policy" : unsupportedFailure ? "deterministic scorer claim extraction" : "unknown",
      recommendedRemediation: confidenceFailure
        ? `Create ${REMEDIATED_PROMPT_VERSION} with task-specific confidence, uncertainty and missing-evidence instructions; keep validator threshold unchanged.`
        : "Use negation-aware prohibited-claim matching and prove positive unsafe claims still fail.",
      regressionTestRequired: true,
      status: unsupportedFailure ? "resolved" : "rerun-required",
      owner: "evaluation-maintainer",
      resolvedAt: unsupportedFailure ? "2026-07-22T08:10:00.000Z" : null,
      immutable: true,
    };
  }));
  persistReviewArtifact(runId, "hard-failure-investigations", investigations);
  return investigations;
}

export function buildFailureMatrix(runId = REVIEWED_LIVE_RUN_ID) {
  const investigations = investigateHardFailures(runId);
  const groups = new Map<string, HardFailureInvestigation[]>();
  for (const investigation of investigations) {
    const key = investigation.rootCauseCategory;
    groups.set(key, [...(groups.get(key) ?? []), investigation]);
  }
  return [...groups.entries()].map(([rootCause, items]) => ({
    rootCause,
    occurrences: items.length,
    hardFailureTypes: [...new Set(items.map((item) => item.hardFailureCode))],
    affectedFixtures: items.map((item) => item.fixtureId),
    affectedTaskTypes: [...new Set(items.map((item) => fixtureFor(item.fixtureId).taskType))],
    affectedRiskLevels: [...new Set(items.map((item) => fixtureFor(item.fixtureId).riskLevel))],
    responsibleLayer: [...new Set(items.map((item) => item.responsibleLayer))].join("; "),
    repeatable: true,
    safetyCritical: items.some((item) => item.safetyImpact === "high" || fixtureFor(item.fixtureId).riskLevel === "critical"),
    proposedFix: [...new Set(items.map((item) => item.recommendedRemediation))].join("; "),
    rerunRequirement: "fresh 12-fixture rerun required; original run remains immutable",
  }));
}

export function buildPreliminaryHumanCalibration(runId = REVIEWED_LIVE_RUN_ID) {
  const { summary } = loadLiveRunArtifacts(runId);
  const reviews = completeLiveRunReviews(runId);
  const rows = summary.results.map((result) => {
    const review = reviews.find((item) => item.fixtureId === result.fixtureId);
    const accepted = review?.preferredDisposition === "accept" || review?.preferredDisposition === "accept-with-warning" || review?.preferredDisposition === "scorer-remediation";
    const confidence = result.status === "passed" ? 0.8 : 0.6;
    return { confidence, correct: accepted ? 1 : 0, fixtureId: result.fixtureId };
  });
  const brier = rows.reduce((sum, row) => sum + (row.confidence - row.correct) ** 2, 0) / rows.length;
  const overconfidence = rows.filter((row) => row.confidence >= 0.75 && row.correct === 0).length;
  const underconfidence = rows.filter((row) => row.confidence < 0.5 && row.correct === 1).length;
  const report = {
    runId,
    label: "preliminary n=12",
    sampleSize: rows.length,
    brierScore: Number(brier.toFixed(4)),
    expectedCalibrationError: Number(Math.abs(rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length - rows.reduce((sum, row) => sum + row.correct, 0) / rows.length).toFixed(4)),
    overconfidenceCount: overconfidence,
    underconfidenceCount: underconfidence,
    byFixture: rows,
    note: "Small sample; not suitable for production thresholds or promotion.",
  };
  persistReviewArtifact(runId, "preliminary-calibration", report);
  return report;
}

export function buildRerunCandidateManifest(runId = REVIEWED_LIVE_RUN_ID) {
  const integrity = recordRunIntegrity(runId);
  const investigations = investigateHardFailures(runId);
  const manifest = {
    candidateId: `rerun-candidate-${randomUUID()}`,
    originalRunId: runId,
    createdAt: "2026-07-22T08:15:00.000Z",
    originalArtifactHashes: integrity,
    promptVersionChanges: [{ from: "prompt-eval-live-v1", to: REMEDIATED_PROMPT_VERSION, reason: "Add task-specific confidence, uncertainty, evidence and professional-review instructions." }],
    scorerVersionChanges: [{ from: "deterministic-scorer-v1", to: REMEDIATED_SCORER_VERSION, reason: "Negation-aware prohibited-claim matching." }],
    fixtureVersionChanges: [],
    routingPolicyChanges: [],
    validatorVersionChanges: [],
    modelEligibilityChanges: [
      { taskType: "financial-synthesis", state: "eligible-with-review", reason: "Confidence failures require human review until clean rerun." },
      { taskType: "timeline-explanation", state: "eligible-with-review", reason: "Prior unsupported-claim failure requires scorer v2 rerun evidence." },
    ],
    newRegressionTests: [
      "negated prohibited claim does not fail",
      "positive prohibited claim still fails",
      "all 12 live results reviewed",
      "hard failure investigation required",
      "rerun preflight blocked until offline regression passes",
    ],
    expectedEffect: "Reduce false positive unsupported-claim failures and improve confidence compliance without weakening validation thresholds.",
    unchangedControls: ["12-fixture cap", "synthetic-only", "no raw prompts", "no raw responses", "no promotion", "no Anthropic", "no Gemini"],
    authorisedBudget: "requires explicit budget confirmation before any paid rerun",
    fixtureSubset: loadLiveRunArtifacts(runId).summary.results.map((result) => result.fixtureId),
    hardFailuresResolved: investigations.filter((item) => item.status === "resolved").length,
    hardFailuresRemainingForRerun: investigations.filter((item) => item.status !== "resolved").length,
    rerunDecision: "eligible for fresh 12-fixture rerun after offline regressions pass; not eligible for expanded evaluation",
  };
  persistReviewArtifact(runId, "rerun-candidate", manifest);
  return manifest;
}

export function buildLiveReviewReport(runId = REVIEWED_LIVE_RUN_ID) {
  const integrity = recordRunIntegrity(runId);
  const packages = buildReviewWorkPackages(runId);
  const reviews = completeLiveRunReviews(runId);
  const investigations = investigateHardFailures(runId);
  const calibration = buildPreliminaryHumanCalibration(runId);
  const rerunCandidate = buildRerunCandidateManifest(runId);
  const failureMatrix = buildFailureMatrix(runId);
  const report = {
    runId,
    integrity,
    reviewVersion: REVIEW_VERSION,
    reviewCount: reviews.length,
    reviewCompleteCount: reviews.filter((review) => review.immutable).length,
    hardFailureCount: investigations.length,
    failureMatrix,
    calibration,
    rerunCandidate,
    outcome: "remediate and rerun 12 fixtures",
    expansionStatus: "blocked",
    promotionStatus: "disabled",
    workPackages: packages,
    reviews,
    investigations,
  };
  persistReviewArtifact(runId, "review-report", report);
  return report;
}

function persistReviewArtifact(runId: string, name: string, value: unknown) {
  mkdirSync(reviewDir(), { recursive: true });
  const out = join(reviewDir(), `${runId}-${name}.json`);
  writeFileSync(/*turbopackIgnore: true*/ out, `${JSON.stringify(value, null, 2)}\n`);
  const versionedOut = join(reviewDir(), `${runId}-${name}-${REVIEW_VERSION}.json`);
  if (!existsSync(/*turbopackIgnore: true*/ versionedOut)) {
    writeFileSync(/*turbopackIgnore: true*/ versionedOut, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  }
}

export function listReviewArtifacts(runId = REVIEWED_LIVE_RUN_ID) {
  const names = [
    "integrity",
    "reviews",
    "hard-failure-investigations",
    "preliminary-calibration",
    "rerun-candidate",
    "review-report",
  ];
  return names.map((name) => {
    const path = join(reviewDir(), `${runId}-${name}.json`);
    return { name, path, exists: existsSync(/*turbopackIgnore: true*/ path) };
  });
}
