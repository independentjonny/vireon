import type {
  AutonomyLevel,
  DataSensitivity,
  JsonSchema,
  ModelProvider,
  ModelRiskLevel,
  ModelTaskResult,
  ModelTaskType,
  OutputClassification,
} from "../modelOrchestrator/types.ts";

export type EvaluationFixtureCategory =
  | "payslip-extraction"
  | "bank-statement-classification"
  | "mortgage-statement-extraction"
  | "financial-position-synthesis"
  | "cash-flow-anomaly-explanation"
  | "debt-optimisation-explanation"
  | "mortgage-comparison"
  | "borrowing-capacity-explanation"
  | "investment-structure-critique"
  | "tax-rule-grounding"
  | "digital-twin-scenario-explanation"
  | "daily-review-briefing"
  | "timeline-explanation"
  | "decision-centre-recommendation"
  | "workflow-plan-generation"
  | "evidence-completeness-detection"
  | "conflicting-fact-detection"
  | "professional-review-escalation"
  | "unsupported-action-rejection"
  | "user-facing-financial-explanation";

export type EvaluationSourceType = "synthetic" | "deterministic-generated" | "manually-reviewed" | "approved-anonymised";
export type EvaluationDifficulty = "straightforward" | "missing-data" | "conflicting-data" | "misleading-document" | "high-risk" | "provider-refusal" | "malformed-input" | "adversarial";
export type EvaluationExecutionMode = "offline-mock" | "deterministic-only" | "live-single-provider" | "live-multi-provider" | "regression" | "candidate-promotion";
export type EvaluationRunStatus = "pending" | "running" | "completed" | "failed" | "blocked" | "halted" | "cancelled";
export type EvaluationResultStatus = "passed" | "failed" | "blocked" | "requires-human-review";
export type EvaluationPromotionState = "experimental" | "evaluation" | "approved" | "preferred" | "restricted" | "deprecated" | "rejected";
export type HumanReviewStatus = "not-required" | "pending" | "completed" | "blind-review-pending";
export type LiveEvaluationPreflightState = "ready" | "blocked";
export type LiveEvaluationHaltReason =
  | "none"
  | "provider-unexpected"
  | "model-unexpected"
  | "provider-unhealthy"
  | "credential-missing"
  | "budget-not-approved"
  | "cross-fixture-contamination"
  | "synthetic-data-guard"
  | "credential-exposure"
  | "malformed-structured-output"
  | "deterministic-fidelity"
  | "action-policy"
  | "sensitivity-policy"
  | "budget-exceeded"
  | "per-task-budget-exceeded"
  | "daily-budget-exceeded"
  | "request-limit-exceeded"
  | "fixture-limit-exceeded"
  | "budget-state-changed"
  | "unexpected-provider"
  | "circuit-breaker"
  | "critical-failures"
  | "internal-evaluation-error";

export type EvaluationErrorCode =
  | "FIXTURE_INVALID"
  | "GROUND_TRUTH_INVALID"
  | "MODEL_UNAVAILABLE"
  | "PROVIDER_UNAVAILABLE"
  | "ROUTING_FAILED"
  | "SCHEMA_VALIDATION_FAILED"
  | "JUDGE_FAILED"
  | "HUMAN_REVIEW_REQUIRED"
  | "BUDGET_BLOCKED"
  | "LIVE_EVALUATION_DISABLED"
  | "UNSAFE_TEST_DATA"
  | "BASELINE_MISSING"
  | "REGRESSION_DETECTED"
  | "PROMOTION_GATE_FAILED"
  | "EVALUATION_CANCELLED";

export type EvaluationEvidence = {
  evidenceId: string;
  title: string;
  source: "synthetic-document" | "synthetic-transaction" | "deterministic-snapshot" | "rule-reference" | "human-review";
  supportsFacts: string[];
  userScope: string;
  verified: boolean;
  confidence: number;
  testData: true;
};

export type EvaluationGroundTruth = {
  exactFacts: Record<string, string | number | boolean>;
  acceptableRanges: Record<string, { min: number; max: number }>;
  requiredConcepts: string[];
  acceptableAlternatives: string[];
  prohibitedClaims: string[];
  requiredEvidenceReferences: string[];
  deterministicOutputs: Record<string, string | number | boolean>;
  expectedUncertainty: "low" | "medium" | "high";
  expectedProfessionalReview: boolean;
  expectedClassifications: OutputClassification[];
  expectedActions: string[];
  prohibitedActions: string[];
};

export type EvaluationScoringRules = {
  hardFailureOnUnsupportedClaim: boolean;
  hardFailureOnMissingProfessionalReview: boolean;
  hardFailureOnDeterministicMismatch: boolean;
  numericTolerance: number;
  dateToleranceDays: number;
  minimumOverallScore: number;
};

export type EvaluationFixture = {
  fixtureId: string;
  fixtureVersion: string;
  name: string;
  description: string;
  category: EvaluationFixtureCategory;
  taskType: ModelTaskType;
  riskLevel: ModelRiskLevel;
  sensitivity: DataSensitivity;
  autonomyLevel: AutonomyLevel;
  input: Record<string, unknown>;
  contextReferences: string[];
  evidence: EvaluationEvidence[];
  deterministicInputs: Record<string, unknown>;
  expectedOutputSchema: JsonSchema | null;
  expectedFacts: EvaluationGroundTruth;
  prohibitedClaims: string[];
  requiredEvidenceReferences: string[];
  expectedClassifications: OutputClassification[];
  professionalReviewExpected: boolean;
  expectedActions: string[];
  prohibitedActions: string[];
  scoringRules: EvaluationScoringRules;
  tags: string[];
  difficulty: EvaluationDifficulty;
  createdAt: string;
  updatedAt: string;
  sourceType: EvaluationSourceType;
  testData: true;
};

export type EvaluationSuite = {
  suiteId: string;
  suiteVersion: string;
  name: string;
  description: string;
  categories: EvaluationFixtureCategory[];
  fixtureIds: string[];
  createdAt: string;
  updatedAt: string;
  testData: true;
};

export type ClaimType = "factual" | "calculated" | "estimated" | "recommendation" | "assumption" | "risk" | "professional-advice" | "action";
export type ClaimSupportStatus = "supported" | "unsupported" | "missing-evidence" | "contradicted" | "not-material";

export type DetectedClaim = {
  claimId: string;
  text: string;
  type: ClaimType;
  classification: OutputClassification[];
  supportingEvidence: string[];
  deterministicSource: string | null;
  confidence: number;
  supportedStatus: ClaimSupportStatus;
  materiality: "low" | "medium" | "high";
  errorCategory: string | null;
};

export type AutomatedJudgeResult = {
  judgeId: string;
  provider: ModelProvider | "rule-based";
  model: string;
  score: number;
  confidence: number;
  structuredOutput: Record<string, unknown>;
  disagreement: string[];
};

export type EvaluationScoreSummary = {
  overall: number;
  schema: number;
  factualAccuracy: number;
  evidenceGrounding: number;
  deterministicFidelity: number;
  safety: number;
  policyCompliance: number;
  confidenceCalibration: number;
  professionalReview: number;
  actionBoundary: number;
  cost: number;
  latency: number;
  hardFailureCount: number;
};

export type EvaluationResult = {
  runId: string;
  fixtureId: string;
  modelTaskRunId: string | null;
  status: EvaluationResultStatus;
  schemaScore: number;
  factualAccuracyScore: number;
  evidenceGroundingScore: number;
  deterministicFidelityScore: number;
  unsupportedClaimScore: number;
  completenessScore: number;
  safetyScore: number;
  policyComplianceScore: number;
  confidenceCalibrationScore: number;
  professionalReviewScore: number;
  actionBoundaryScore: number;
  latencyScore: number;
  costScore: number;
  overallScore: number;
  hardFailures: string[];
  warnings: string[];
  detectedClaims: DetectedClaim[];
  unsupportedClaims: DetectedClaim[];
  missingEvidence: string[];
  evaluatorNotes: string[];
  automatedJudgeResults: AutomatedJudgeResult[];
  humanReviewStatus: HumanReviewStatus;
  modelResult: ModelTaskResult | null;
};

export type RegressionSummary = {
  baselineId: string | null;
  previousScore: number | null;
  candidateScore: number;
  absoluteChange: number | null;
  percentageChange: number | null;
  hardFailureChange: number | null;
  costChange: number | null;
  latencyChange: number | null;
  calibrationChange: number | null;
  fixtureDifferences: string[];
  status: "no-baseline" | "passed" | "regression-detected";
};

export type PromotionDecision = {
  decisionId: string;
  candidate: string;
  previousState: EvaluationPromotionState;
  proposedState: EvaluationPromotionState;
  evidence: string[];
  gateOutcomes: Record<string, boolean>;
  reviewer: "human-required" | string;
  timestamp: string;
  policyVersion: string;
  expiresAt: string;
  approvedAutomatically: false;
  status: "recommended" | "blocked" | "requires-human-review";
};

export type PromptDefinition = {
  promptId: string;
  version: string;
  taskType: ModelTaskType;
  templateHash: string;
  policyVersion: string;
  requiredSections: string[];
  outputSchemaVersion: string;
  changeSummary: string;
  author: string;
  status: EvaluationPromotionState;
  effectiveDate: string;
  immutable: boolean;
};

export type EvaluationRun = {
  runId: string;
  suiteId: string;
  fixtureVersion: string;
  modelOrchestratorPolicyVersion: string;
  provider: ModelProvider | "mixed" | "none";
  model: string;
  modelConfigurationVersion: string;
  promptVersion: string;
  workerVersion: string;
  deterministicEngineVersions: string[];
  startedAt: string;
  completedAt: string | null;
  status: EvaluationRunStatus;
  environment: "local" | "test" | "staging" | "production";
  executionMode: EvaluationExecutionMode;
  fixtureCount: number;
  passedCount: number;
  failedCount: number;
  blockedCount: number;
  totalCost: number;
  averageLatency: number;
  scoreSummary: EvaluationScoreSummary;
  regressionSummary: RegressionSummary;
  promotionDecision: PromotionDecision;
  correlationId: string;
  results: EvaluationResult[];
  errors: EvaluationErrorCode[];
};

export type EvaluationBaseline = {
  baselineId: string;
  suiteId: string;
  fixtureVersion: string;
  candidate: string;
  scoreSummary: EvaluationScoreSummary;
  resultHashes: Record<string, string>;
  createdAt: string;
  immutable: true;
};

export type HumanReview = {
  reviewId: string;
  resultId: string;
  correctness: number;
  evidenceUse: number;
  usefulness: number;
  clarity: number;
  riskDisclosure: number;
  professionalReviewHandling: number;
  unsafeContent: boolean;
  missingContent: string[];
  preferredOutput: string | null;
  notes: string;
  reviewerConfidence: number;
  blind: boolean;
  createdAt: string;
  immutable: true;
};

export type LiveReviewDisposition =
  | "accept"
  | "accept-with-warning"
  | "prompt-remediation"
  | "adapter-remediation"
  | "validator-remediation"
  | "scorer-remediation"
  | "fixture-remediation"
  | "model-task-restriction"
  | "reject-result"
  | "escalate-for-second-review";

export type HardFailureRootCause =
  | "model-behaviour"
  | "prompt-design"
  | "prompt-versioning"
  | "provider-adapter"
  | "provider-schema-constraint"
  | "result-normalisation"
  | "evidence-assembly"
  | "context-trimming"
  | "deterministic-input-assembly"
  | "output-schema"
  | "local-validator"
  | "claim-extractor"
  | "scorer"
  | "fixture"
  | "ground-truth"
  | "routing-policy"
  | "model-capability-registration"
  | "professional-review-policy"
  | "unknown";

export type LiveReviewRecord = {
  reviewId: string;
  runId: string;
  fixtureId: string;
  reviewer: string;
  factuallyCorrect: boolean;
  evidenceSupported: boolean;
  deterministicValuesPreserved: boolean;
  uncertaintyAppropriate: boolean;
  missingEvidenceDisclosed: boolean;
  conflictsDisclosed: boolean;
  professionalReviewClassificationCorrect: boolean;
  actionBoundaryRespected: boolean;
  useful: boolean;
  clear: boolean;
  materialOmissions: string[];
  unsafeClaims: string[];
  preferredDisposition: LiveReviewDisposition;
  reviewerConfidence: number;
  notes: string;
  blindControls: {
    scoreHiddenBeforeJudgement: boolean;
    passFailHiddenBeforeJudgement: boolean;
    groundTruthRevealedAfterInitialJudgement: boolean;
    providerRevealedAfterInitialJudgement: boolean;
    reviewerChangedAfterReveal: boolean;
    sameKnownProviderForAllFixtures: boolean;
  };
  suggestedCorrections: string[];
  createdAt: string;
  immutable: true;
};

export type HardFailureInvestigation = {
  investigationId: string;
  runId: string;
  fixtureId: string;
  hardFailureCode: string;
  materialClaimOrField: string;
  expectedResult: string;
  actualResult: string;
  evidenceInvolved: string[];
  deterministicSnapshotInvolved: string | null;
  materiality: "low" | "medium" | "high";
  safetyImpact: "none" | "low" | "medium" | "high";
  reviewerDetermination: "confirmed true positive" | "likely true positive" | "false positive" | "fixture defect" | "inconclusive";
  rootCauseCategory: HardFailureRootCause;
  responsibleLayer: string;
  recommendedRemediation: string;
  regressionTestRequired: boolean;
  status: "open" | "resolved" | "rerun-required";
  owner: string;
  resolvedAt: string | null;
  immutable: true;
};

export type LiveRunIntegrityRecord = {
  runId: string;
  manifestPath: string;
  summaryPath: string;
  manifestSha256: string;
  summarySha256: string;
  recordedAt: string;
  immutable: true;
};

export type LiveEvaluationPreflight = {
  state: LiveEvaluationPreflightState;
  provider: ModelProvider | "none";
  model: string;
  fixtureCount: number;
  suites: string[];
  estimatedMaximumCost: number;
  expectedMaximumRequestCount: number;
  budgetConfigurationHash?: string;
  budgetReservation?: {
    status: "valid" | "invalid" | "not-run";
    message: "BUDGET RESERVATION VALID" | "STAGE-A BLOCKED BEFORE RUN CREATION" | "BUDGET RESERVATION NOT RUN";
    approvedRunCap: number | null;
    loadedRunCap: number | null;
    approvedPerTaskCap: number | null;
    loadedPerTaskCap: number | null;
    dailyLimit: number | null;
    remainingDailyBudget: number | null;
    estimatedMaximumCostPerFixture: number;
    maximumEstimatedFixtureCost: number;
    maximumEstimatedSixFixtureCost: number;
    retryReserve: number;
    availableHeadroom: number | null;
    reservations: Array<{
      fixtureId: string;
      estimatedInputTokens: number;
      maximumOutputTokens: number;
      maximumEstimatedRequestCost: number;
      retryReserve: number;
      cumulativeReservedCost: number;
      fitsPerTaskCap: boolean;
    }>;
    blockers: string[];
    configurationHash: string;
  };
  sensitivityLevel: DataSensitivity;
  outputStoragePolicy: {
    rawPromptsStored: false;
    rawResponsesStored: false;
  };
  checks: Record<string, boolean>;
  blockers: string[];
  redactedEnvironment: Record<string, "set" | "missing" | string>;
  message:
    | "READY FOR LIVE SYNTHETIC EVALUATION"
    | "LIVE MODEL EVALUATION BLOCKED"
    | "READY FOR PAID STAGE-A EXECUTION"
    | "STAGE A LIVE VALIDATION BLOCKED";
};

export type LiveEvaluationHumanReviewItem = {
  reviewItemId: string;
  runId: string;
  fixtureId: string;
  resultId: string;
  required: boolean;
  reasons: string[];
  status: HumanReviewStatus;
  correctionStoredSeparately: true;
};

export type LiveEvaluationOperationalMetrics = {
  requestCount: number;
  successRate: number;
  refusalRate: number;
  schemaFailureRate: number;
  validationFailureRate: number;
  retryRate: number;
  timeoutRate: number;
  fallbackRate: number;
  latencyP50: number;
  latencyP95: number;
  costPerFixture: number;
  costPerPassingFixture: number;
  hardFailureCount: number;
  humanReviewAgreement: number | null;
  judgeDisagreement: number;
};

export type LiveEvaluationPilotSummary = {
  preflight: LiveEvaluationPreflight;
  run: EvaluationRun | null;
  humanReviewQueue: LiveEvaluationHumanReviewItem[];
  operationalMetrics: LiveEvaluationOperationalMetrics;
  haltReason: LiveEvaluationHaltReason;
  expandedRunEligible: boolean;
  calibrationSampleSize: number;
  partialFixtureSet: true;
  automaticPromotionEnabled: false;
};

export type CalibrationBucket = {
  minConfidence: number;
  maxConfidence: number;
  count: number;
  accuracy: number;
  averageConfidence: number;
};

export type CalibrationReport = {
  reportId: string;
  runId: string;
  brierScore: number;
  expectedCalibrationError: number;
  overconfidenceRate: number;
  underconfidenceRate: number;
  buckets: CalibrationBucket[];
  byTaskType: Record<string, number>;
  byProvider: Record<string, number>;
  byWorker: Record<string, number>;
  byRiskLevel: Record<string, number>;
  createdAt: string;
};

export type EvaluationRunOptions = {
  suiteId?: string;
  provider?: ModelProvider;
  model?: string;
  promptVersion?: string;
  workerVersion?: string;
  routingPolicyVersion?: string;
  executionMode?: EvaluationExecutionMode;
  maximumFixtures?: number;
  fixtureIds?: string[];
  maximumRunCost?: number;
  maximumTaskCost?: number;
  maximumRetries?: number;
  maximumOutputTokens?: number;
  scorerVersion?: string;
  sourceRunId?: string;
  stageACandidateId?: string;
  budgetConfirmation?: string;
  liveProviderOptIn?: boolean;
  includeApprovedAnonymised?: boolean;
  now?: string;
};
