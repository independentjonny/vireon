export type BrowserIssueClassification = {
  kind:
    | "healthy"
    | "unrecoverable-browser-runtime"
    | "unrecoverable-app-hydration"
    | "recoverable-server-state"
    | "recoverable-network-resource"
    | "unknown-browser-health-failure";
  recoverable: boolean;
  reason: string;
  recommendedAction: string;
};

export type SupervisorTaskFixture = {
  id?: string;
  status?: string;
  startedAt?: string;
  updatedAt?: string;
  createdAt?: string;
};

export type ValidationLockFixture = {
  runId?: string;
  ownerPid?: number;
  createdAt?: string;
};

export type EngineerTaskFixture = {
  id?: string;
  status?: string;
};

export type EngineerStateFixture = {
  status?: string;
  lock?: {
    active?: boolean;
    runId?: string;
    startedAt?: string;
  } | null;
};

export type EngineerValidationResult = {
  command: string;
  ok: boolean;
  code?: number | null;
  summary?: string;
  output?: string;
};

export const terminalTaskStatuses: Set<string>;
export const engineerTerminalStatuses: Set<string>;
export const DEFAULT_ENGINEER_VALIDATION_COMMANDS: string[];
export const DEFAULT_ENGINEER_TARGETED_VALIDATION_COMMANDS: string[];
export const ENGINEER_BRIDGE_TEST_COMMAND: string;
export const ENGINEER_BRIDGE_TARGETED_VALIDATION_COMMANDS: string[];
export const ENGINEER_EVIDENCE_SCHEMA_VERSION: string;
export const ENGINEER_REVIEW_VERDICTS: Set<string>;
export const HIGH_RISK_REVIEW_PATTERNS: RegExp[];
export function inspectEnvironmentVariable(env?: Record<string, string | undefined>, name?: string): {
  name: string;
  present: boolean;
  empty: boolean;
  source: string;
  sourceKey: string;
  duplicateCaseInsensitiveKeys: boolean;
  forwardedToChildProcess: boolean;
};
export function buildOpenAiEnvironmentTrace(input?: {
  parentEnv?: Record<string, string | undefined>;
  childEnv?: Record<string, string | undefined>;
  reviewerEnv?: Record<string, string | undefined>;
}): Record<string, unknown>;
export function reviewerApiKeyState(env?: Record<string, string | undefined>): {
  diagnostics: Record<string, unknown>;
  usable: boolean;
};
export function resolveReviewerApiKey(env?: Record<string, string | undefined>): {
  diagnostics: Record<string, unknown>;
  usable: boolean;
  reviewerApiKey: string;
};
export function normaliseIssue(issue: unknown): string;
export function classifyBrowserIssues(issues?: unknown[]): BrowserIssueClassification;
export function listStaleRunningTasks(tasks?: SupervisorTaskFixture[], nowMs?: number, staleAfterMs?: number): SupervisorTaskFixture[];
export function shouldEnterRemediation(input: {
  browserOk?: boolean;
  supervisorHealthy?: boolean;
  staleRunningTasks?: SupervisorTaskFixture[];
}): boolean;
export function isLockStale(lock: ValidationLockFixture | null | undefined, activePids?: Set<number>, nowMs?: number, staleAfterMs?: number): boolean;
export function canAcquireValidationLock(input: {
  existingLock?: ValidationLockFixture | null;
  activePids?: Set<number>;
  nowMs?: number;
  staleAfterMs?: number;
}): { ok: true; action: "create" | "replace-stale" } | { ok: false; action: "blocked"; reason: string };
export function assertGptCannotMutateRemediationState(modelOutput?: Record<string, unknown>): {
  ok: boolean;
  attempted: string[];
};
export function redactSupervisorSecrets(value: unknown, extraSecrets?: string[]): unknown;
export function canStartEngineerRun(input: {
  state?: EngineerStateFixture;
  tasks?: EngineerTaskFixture[];
  nowMs?: number;
  staleAfterMs?: number;
}): { ok: true } | { ok: false; reason: string };
export function nextEngineerStatus(input: {
  attempt: number;
  maxAttempts: number;
  codexOk: boolean;
  validationOk: boolean;
  blocker?: boolean;
}): "running" | "complete" | "blocked";
export function summarizeValidationResults(results?: EngineerValidationResult[]): {
  ok: boolean;
  failures: { command: string; code: number; summary: string }[];
};
export function normaliseReviewerResult(value?: Record<string, unknown>): {
  verdict: "PASS" | "REMEDIATION_REQUIRED" | "BLOCKED" | "PASS_REQUIRES_HUMAN_APPROVAL";
  confidence: number;
  acceptance_criteria_results: string[];
  architecture_findings: string[];
  security_findings: string[];
  persistence_findings: string[];
  validation_findings: string[];
  missing_evidence: string[];
  required_remediation: string[];
  blocker_reason: string;
  recommended_next_action: string;
};
export function evaluateReviewGate(review: Record<string, unknown>, options?: {
  minConfidence?: number;
  requireHumanReview?: boolean;
}): { ok: true; status: "passed"; reason: string } | { ok: false; status: "blocked" | "needs_human_review" | "remediation_required"; reason: string };
export function buildBoundedEvidence(input?: Record<string, unknown>): Record<string, unknown>;
export function extractReviewEvidenceReferences(text?: string): string[];
export function isAllowedReviewEvidencePath(relativePath?: string): boolean;
export function resolveReviewEvidencePath(repoRoot: string, input: unknown): {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
};
export function loadReviewEvidenceFile(repoRoot: string, input: unknown, options?: { maxBytes?: number }): Record<string, unknown>;
export function collectReviewEvidenceFiles(repoRoot: string, input?: {
  taskText?: string;
  explicitReferences?: string[];
}): {
  requested: string[];
  included: Record<string, unknown>[];
  rejected: Record<string, unknown>[];
  loadedCount: number;
  rejectedCount: number;
  accessManifest: {
    mode: "inlined-redacted-content";
    repositoryCheckoutAccessRequired: false;
    note: string;
    artifacts: Record<string, unknown>[];
    rejected: Record<string, unknown>[];
  };
};
export function hashText(value?: unknown): string;
export function buildEngineerBaseline(input?: Record<string, unknown>): Record<string, unknown>;
export function classifyEvidenceFiles(input?: {
  baseline?: Record<string, unknown>;
  currentGitStatus?: string;
  generatedEvidencePaths?: string[];
}): Record<string, unknown>[];
export function selectEvidenceDiffFiles(input?: {
  classifiedFiles?: Record<string, unknown>[];
  task?: string;
  maxFiles?: number;
}): string[];
export function buildTargetedDiffEvidence(input?: {
  paths?: string[];
  preExistingStatus?: string[];
  diffProvider?: (path: string) => string;
}): Record<string, unknown>[];
export function extractNamedTestEvidence(validationResults?: Record<string, unknown>[]): Record<string, unknown>[];
export const BRIDGE_TEST_SUITE_DEFINITIONS: Record<string, unknown>[];
export function buildBridgeTestEvidence(input?: {
  tests?: Record<string, unknown>[];
  commandEvidence?: Record<string, unknown>[];
  taskScopes?: string[];
}): Record<string, unknown>;
export function buildPersistenceAuditEvidence(input?: Record<string, unknown>): Record<string, unknown>;
export function buildProductionIntegrityEvidence(input?: Record<string, unknown>): Record<string, unknown>;
export function buildSecretScanEvidence(input?: { files?: string[]; readFile?: (path: string) => string }): Record<string, unknown>;
export function buildMigrationEvidence(input?: { classifiedFiles?: Record<string, unknown>[]; readFile?: (path: string) => string }): Record<string, unknown>;
export function buildStageGateEvidence(input?: Record<string, unknown>): Record<string, unknown>[];
export function buildEndpointSmokeEvidence(input?: { classifiedFiles?: Record<string, unknown>[] }): Record<string, unknown>[];
export function classifyTaskScopes(input?: {
  task?: string;
  acceptanceCriteria?: string[];
  files?: string[];
  stage?: string | null;
}): string[];
export function buildEvidenceRequirements(input?: {
  scopes?: string[];
  task?: string;
  acceptanceCriteria?: string[];
  migrations?: Record<string, unknown>;
  stage?: string | null;
}): Record<string, unknown>;
export function validateEngineerEvidencePackage(pkg?: Record<string, unknown>): {
  ok: boolean;
  missing: string[];
  schemaVersion: string;
  taskScopes: string[];
  evidenceRequirements: Record<string, unknown>;
};
export function buildRemediationPrompt(input?: Record<string, unknown>): string;
export function selectRemediationValidationCommands(input?: {
  review?: Record<string, unknown>;
  changedFiles?: string[];
}): string[];
export function shouldSkipInitialReviewOnlyImplementation(input?: {
  reviewOnly?: boolean;
  guidance?: string;
  activeRemediationTask?: Record<string, unknown> | null;
}): boolean;
export function buildReviewerRemediationTask(input?: Record<string, unknown>): {
  title: string;
  status: string;
  generatedAt: string;
  prompt: string;
  targetedValidationCommands: string[];
  sources: Record<string, unknown>;
  limits: Record<string, number>;
};
export function shouldRequireHumanReview(input?: { task?: string; changedFiles?: string[]; configured?: boolean }): boolean;
export function createMemoryEntry(input?: Record<string, unknown>): Record<string, unknown> | null;
export function retrieveRelevantMemories(entries?: Record<string, unknown>[], query?: string, options?: {
  maxEntries?: number;
  maxChars?: number;
  minConfidence?: number;
}): Record<string, unknown>[];
export function selectNextProgramTask(manifest?: Record<string, unknown>): string | null;
export function validateSafeRelativePath(input: unknown): string;
export function assertAllowedEngineerCommand(command: string): true;
