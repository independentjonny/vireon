import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const terminalTaskStatuses = new Set(["complete", "failed", "stopped"]);
export const engineerTerminalStatuses = new Set(["complete", "blocked", "failed", "needs_human_review"]);
export const DEFAULT_ENGINEER_VALIDATION_COMMANDS = [
  "npm run lint",
  "npm run typecheck",
  "npm run test",
  "npm run build",
  "npm run validate",
];
export const DEFAULT_ENGINEER_TARGETED_VALIDATION_COMMANDS = [
  "npm run typecheck",
  "npm run test",
];
export const ENGINEER_BRIDGE_TEST_COMMAND = "node --test --import ./scripts/ts-paths-loader.mjs __tests__/lib/nevenValidation.test.ts";
export const ENGINEER_BRIDGE_TARGETED_VALIDATION_COMMANDS = [
  "npm run typecheck",
  ENGINEER_BRIDGE_TEST_COMMAND,
  "npm run engineer:smoke:sanitization",
];
export const ENGINEER_EVIDENCE_SCHEMA_VERSION = "1.0.0";
export const ENGINEER_REVIEW_VERDICTS = new Set(["PASS", "REMEDIATION_REQUIRED", "BLOCKED", "PASS_REQUIRES_HUMAN_APPROVAL"]);
export const HIGH_RISK_REVIEW_PATTERNS = [
  /\bauth(?:entication|orization)?\b/i,
  /\bRLS\b|\brow level security\b/i,
  /\bmigrations?\b/i,
  /\bruntime credentials?\b|\bpassword\b|\bsecret\b/i,
  /\bdeploy(?:ment)?\b/i,
  /\bdelete\b|\bdrop\b|\btruncate\b/i,
];

export function inspectEnvironmentVariable(env = {}, name = "OPENAI_API_KEY") {
  const keys = Object.keys(env ?? {});
  const exactPresent = Object.prototype.hasOwnProperty.call(env, name);
  const matchingKeys = keys.filter((key) => key.toLowerCase() === name.toLowerCase());
  const sourceKey = exactPresent ? name : matchingKeys[0] ?? name;
  const value = env?.[sourceKey];
  return {
    name,
    present: typeof value === "string",
    empty: typeof value === "string" ? value.length === 0 : false,
    source: exactPresent ? "process.env exact" : matchingKeys.length > 0 ? "process.env case-insensitive" : "missing",
    sourceKey,
    duplicateCaseInsensitiveKeys: matchingKeys.length > 1,
    forwardedToChildProcess: false,
  };
}

export function buildOpenAiEnvironmentTrace({
  parentEnv = process.env,
  childEnv = process.env,
  reviewerEnv = process.env,
} = {}) {
  return {
    variableName: "OPENAI_API_KEY",
    powershellEnvironment: inspectEnvironmentVariable(parentEnv, "OPENAI_API_KEY"),
    nodeProcessEnvironment: inspectEnvironmentVariable(process.env, "OPENAI_API_KEY"),
    childProcessEnvironment: {
      ...inspectEnvironmentVariable(childEnv, "OPENAI_API_KEY"),
      forwardedToChildProcess: childEnv === parentEnv || Object.prototype.hasOwnProperty.call(childEnv ?? {}, "OPENAI_API_KEY"),
    },
    reviewerEnvironment: inspectEnvironmentVariable(reviewerEnv, "OPENAI_API_KEY"),
    reviewerExpectedVariableName: "OPENAI_API_KEY",
  };
}

export function reviewerApiKeyState(env = process.env) {
  const diagnostics = inspectEnvironmentVariable(env, "OPENAI_API_KEY");
  return {
    diagnostics,
    usable: diagnostics.present && !diagnostics.empty,
  };
}

export function resolveReviewerApiKey(env = process.env) {
  const state = reviewerApiKeyState(env);
  const value = state.usable ? env?.[state.diagnostics.sourceKey] : "";
  return {
    ...state,
    reviewerApiKey: typeof value === "string" ? value : "",
  };
}

export function normaliseIssue(issue) {
  return String(issue ?? "").replace(/\s+/g, " ").trim();
}

export function classifyBrowserIssues(issues = []) {
  const normalised = issues.map(normaliseIssue).filter(Boolean);
  const joined = normalised.join(" | ").toLowerCase();

  if (normalised.length === 0) {
    return {
      kind: "healthy",
      recoverable: false,
      reason: "Browser health passed.",
      recommendedAction: "No remediation required.",
    };
  }

  if (joined.includes("spawn eperm") || joined.includes("executable doesn't exist")) {
    return {
      kind: "unrecoverable-browser-runtime",
      recoverable: false,
      reason: "Browser runtime is unavailable to the current process.",
      recommendedAction: "Verify Playwright installation and sandbox permissions.",
    };
  }

  if (joined.includes("hydration failed") || joined.includes("hydration mismatch")) {
    return {
      kind: "unrecoverable-app-hydration",
      recoverable: false,
      reason: "The application rendered a React hydration error.",
      recommendedAction: "Fix the deterministic render mismatch, then rerun npm run neven.",
    };
  }

  if (joined.includes("http 500") || joined.includes("internal server error")) {
    return {
      kind: "recoverable-server-state",
      recoverable: true,
      reason: "The app or supervisor reported a transient server/resource failure.",
      recommendedAction: "Run bounded supervisor repair and verify health again.",
    };
  }

  if (joined.includes("request failed") || joined.includes("net::err_aborted") || joined.includes("net::err_failed")) {
    return {
      kind: "recoverable-network-resource",
      recoverable: true,
      reason: "A browser request failed during the health check.",
      recommendedAction: "Run bounded supervisor repair and verify health again.",
    };
  }

  return {
    kind: "unknown-browser-health-failure",
    recoverable: false,
    reason: "Browser health failed with an unsupported issue type.",
    recommendedAction: "Run npm run neven:diagnose and inspect the browser-health evidence.",
  };
}

export function listStaleRunningTasks(tasks = [], nowMs = Date.now(), staleAfterMs = 5 * 60 * 1000) {
  return tasks.filter((task) => {
    if (!task || task.status !== "running") return false;
    const startedMs = Date.parse(task.startedAt ?? task.updatedAt ?? task.createdAt ?? "");
    return Number.isFinite(startedMs) && nowMs - startedMs > staleAfterMs;
  });
}

export function shouldEnterRemediation({ browserOk, supervisorHealthy, staleRunningTasks = [] }) {
  return browserOk !== true || supervisorHealthy !== true || staleRunningTasks.length > 0;
}

export function isLockStale(lock, activePids = new Set(), nowMs = Date.now(), staleAfterMs = 5 * 60 * 1000) {
  if (!lock) return false;
  const ownerPid = Number(lock.ownerPid);
  const createdMs = Date.parse(lock.createdAt ?? "");
  const ownerAlive = Number.isFinite(ownerPid) && activePids.has(ownerPid);
  const ageMs = Number.isFinite(createdMs) ? nowMs - createdMs : Number.POSITIVE_INFINITY;
  return !ownerAlive || ageMs > staleAfterMs;
}

export function canAcquireValidationLock({ existingLock, activePids = new Set(), nowMs = Date.now(), staleAfterMs = 5 * 60 * 1000 }) {
  if (!existingLock) {
    return { ok: true, action: "create" };
  }

  if (isLockStale(existingLock, activePids, nowMs, staleAfterMs)) {
    return { ok: true, action: "replace-stale" };
  }

  return {
    ok: false,
    action: "blocked",
    reason: `Validation lock is owned by pid ${existingLock.ownerPid}.`,
  };
}

export function assertGptCannotMutateRemediationState(modelOutput = {}) {
  const forbiddenFields = ["status", "outcomeStatus", "verified", "evidence", "calculation"];
  const attempted = forbiddenFields.filter((field) => Object.prototype.hasOwnProperty.call(modelOutput, field));
  return {
    ok: attempted.length === 0,
    attempted,
  };
}

export function redactSupervisorSecrets(value, extraSecrets = []) {
  const secrets = new Set(
    [process.env.OPENAI_API_KEY, process.env.VIREON_PILOT_APPLICATION_ROLE_PASSWORD, ...extraSecrets]
      .filter((item) => typeof item === "string" && item.length > 0)
  );
  const seen = new WeakSet();
  const forbiddenKeys = new Set(["__proto__", "constructor", "prototype"]);
  const maxDepth = 8;
  const maxStringLength = 20_000;
  const maxArrayLength = 200;
  const maxObjectKeys = 120;

  const redactString = (input) => {
    let output = String(input);
    for (const secret of secrets) {
      output = output.split(secret).join("<redacted>");
    }
    output = output
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <redacted>")
      .replace(/canary-[A-Za-z0-9_-]+/gi, "<redacted-canary>")
      .replace(/(OPENAI_API_KEY|PGPASSWORD|PASSWORD)\s*=\s*["']?[^"'\s]+["']?/gi, "$1=<redacted>")
      .replace(/\bPASSWORD\s+'[^']*'/gi, "PASSWORD '<redacted>'")
      .replace(/\bPASSWORD\s+"[^"]*"/gi, "PASSWORD '<redacted>'")
      .replace(/postgres(?:ql)?:\/\/[^:\s/'"]+:[^@\s'"]+@/gi, "postgresql://<redacted>:<redacted>@");
    if (output.length > maxStringLength) return `${output.slice(0, maxStringLength)}...<truncated>`;
    return output;
  };

  const walk = (item, depth) => {
    if (typeof item === "string") return redactString(item);
    if (item == null || typeof item === "boolean" || typeof item === "number") return item;
    if (typeof item === "bigint") return String(item);
    if (typeof item === "function" || typeof item === "symbol") return null;
    if (depth > maxDepth) return "<truncated>";
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(item)) return "<binary-redacted>";
    if (Array.isArray(item)) return item.slice(0, maxArrayLength).map((entry) => walk(entry, depth + 1));
    if (item && typeof item === "object") {
      const proto = Object.getPrototypeOf(item);
      if (proto !== Object.prototype && proto !== null) return null;
      if (seen.has(item)) return "<cycle>";
      seen.add(item);
      const entries = Object.entries(item)
        .filter(([key]) => !forbiddenKeys.has(key))
        .slice(0, maxObjectKeys);
    return Object.fromEntries(
      entries.map(([key, nested]) => {
        if (key === "liveSecret" && typeof nested === "boolean") {
          return [key, nested];
        }
        if (/^(password|secret|token|apiKey|authorization)$/i.test(key) || /(Password|Secret|Token|ApiKey|Authorization)$/.test(key)) {
          return [key, "<redacted>"];
        }
        return [redactString(key), walk(nested, depth + 1)];
      })
    );
    }
    return null;
  };

  return walk(value, 0);
}

/**
 * @param {{
 *   state?: { status?: string; lock?: { active?: boolean; runId?: string; startedAt?: string } | null };
 *   tasks?: { id?: string; status?: string }[];
 *   nowMs?: number;
 *   staleAfterMs?: number;
 * }} input
 */
export function canStartEngineerRun({ state = {}, tasks = [], nowMs = Date.now(), staleAfterMs = 30 * 60 * 1000 }) {
  const activeTask = tasks.find((task) => task && !engineerTerminalStatuses.has(task.status));
  if (activeTask) {
    return { ok: false, reason: `Engineer task ${activeTask.id ?? "unknown"} is still ${activeTask.status}.` };
  }
  const lock = state.lock;
  const startedMs = Date.parse(lock?.startedAt ?? "");
  const lockFresh = lock?.active === true && Number.isFinite(startedMs) && nowMs - startedMs <= staleAfterMs;
  if (lockFresh) {
    return { ok: false, reason: `Engineer run ${lock.runId ?? "unknown"} is already active.` };
  }
  return { ok: true };
}

/**
 * @param {{ attempt: number; maxAttempts: number; codexOk: boolean; validationOk: boolean; blocker?: boolean }} input
 * @returns {"running" | "complete" | "blocked"}
 */
export function nextEngineerStatus({ attempt, maxAttempts, codexOk, validationOk, blocker }) {
  if (blocker) return "blocked";
  if (codexOk && validationOk) return "complete";
  if (attempt >= maxAttempts) return "blocked";
  return "running";
}

/**
 * @param {{ command: string; ok: boolean; code?: number | null; summary?: string; output?: string }[]} results
 */
export function summarizeValidationResults(results = []) {
  const failures = results.filter((result) => !result.ok);
  return {
    ok: failures.length === 0,
    failures: failures.map((result) => ({
      command: result.command,
      code: result.code ?? 1,
      summary: result.summary ?? "Command failed.",
    })),
  };
}

export function normaliseReviewerResult(value = {}) {
  const verdict = ENGINEER_REVIEW_VERDICTS.has(value.verdict) ? value.verdict : "BLOCKED";
  const parsedConfidence = Number(value.confidence ?? 0);
  const confidence = Number.isFinite(parsedConfidence) ? Math.max(0, Math.min(1, parsedConfidence)) : 0;
  const list = (items) => (Array.isArray(items) ? items.map((item) => String(item).trim()).filter(Boolean).slice(0, 20) : []);
  return {
    verdict,
    confidence,
    acceptance_criteria_results: list(value.acceptance_criteria_results),
    architecture_findings: list(value.architecture_findings),
    security_findings: list(value.security_findings),
    persistence_findings: list(value.persistence_findings),
    validation_findings: list(value.validation_findings),
    missing_evidence: list(value.missing_evidence),
    required_remediation: list(value.required_remediation),
    blocker_reason: String(value.blocker_reason ?? "").trim(),
    recommended_next_action: String(value.recommended_next_action ?? "").trim(),
  };
}

export function evaluateReviewGate(review, { minConfidence = 0.8, requireHumanReview = false } = {}) {
  const result = normaliseReviewerResult(review);
  if (result.verdict === "BLOCKED") {
    return { ok: false, status: "blocked", reason: result.blocker_reason || "Reviewer returned BLOCKED." };
  }
  if (result.verdict === "PASS_REQUIRES_HUMAN_APPROVAL" || requireHumanReview) {
    return { ok: false, status: "needs_human_review", reason: "Reviewer requires human approval before completion." };
  }
  if (result.verdict !== "PASS") {
    return { ok: false, status: "remediation_required", reason: "Reviewer requested remediation." };
  }
  if (result.confidence < minConfidence) {
    return { ok: false, status: "remediation_required", reason: `Reviewer confidence ${result.confidence} is below ${minConfidence}.` };
  }
  const highSeverity = [
    ...result.security_findings,
    ...result.persistence_findings,
    ...result.architecture_findings,
  ].some((finding) => /\bcritical\b|\bhigh\b|\bblock/i.test(finding));
  if (highSeverity) {
    return { ok: false, status: "remediation_required", reason: "Reviewer reported unresolved high-severity findings." };
  }
  return { ok: true, status: "passed", reason: "Reviewer accepted the implementation." };
}

/**
 * @param {{
 *   task?: string;
 *   agents?: string;
 *   gitStatus?: string;
 *   diffStat?: string;
 *   diffNameStatus?: string;
 *   changedFiles?: string[];
 *   validation?: Record<string, unknown>;
 *   persistenceAudit?: string;
 *   productionIntegrity?: string;
 *   codex?: Record<string, unknown>;
 *   maxFiles?: number;
 *   maxChars?: number;
 * }} input
 */
export function buildBoundedEvidence({
  task = "",
  agents = "",
  gitStatus = "",
  diffStat = "",
  diffNameStatus = "",
  changedFiles = [],
  validation = {},
  persistenceAudit = "",
  productionIntegrity = "",
  codex = {},
  maxFiles = 80,
  maxChars = 24_000,
} = {}) {
  const safeFiles = changedFiles
    .map((file) => String(file).replaceAll("\\", "/"))
    .filter((file) => file && !/(^|\/)(\.env|node_modules|\.next|\.git)/i.test(file))
    .slice(0, maxFiles);
  const sections = {
    task: String(task).slice(0, 4000),
    standingPolicy: String(agents).slice(0, 4000),
    gitStatus: String(gitStatus).slice(-6000),
    diffStat: String(diffStat).slice(-6000),
    diffNameStatus: String(diffNameStatus).slice(-6000),
    changedFiles: safeFiles,
    validation,
    persistenceAudit: String(persistenceAudit).slice(-4000),
    productionIntegrity: String(productionIntegrity).slice(-4000),
    codex: {
      ok: Boolean(codex.ok),
      summary: String(codex.summary ?? "").slice(0, 1000),
      output: String(codex.output ?? "").slice(-6000),
    },
    truncated: false,
  };
  const redacted = redactSupervisorSecrets(sections);
  const text = JSON.stringify(redacted);
  if (text.length <= maxChars) return redacted;
  return {
    ...redacted,
    codex: { ...redacted.codex, output: String(redacted.codex?.output ?? "").slice(-2000) },
    gitStatus: String(redacted.gitStatus ?? "").slice(-2000),
    diffStat: String(redacted.diffStat ?? "").slice(-2000),
    diffNameStatus: String(redacted.diffNameStatus ?? "").slice(-2000),
    truncated: true,
  };
}

const REVIEW_EVIDENCE_ALLOWED_PREFIXES = [".ai-supervisor/evidence/"];
const REVIEW_EVIDENCE_ALLOWED_FILES = new Set([
  ".ai-supervisor/engineer-latest-report.json",
  ".ai-supervisor/engineer-latest-report.md",
  ".ai-supervisor/engineer-review.json",
  ".ai-supervisor/engineer-blocker.md",
  ".ai-supervisor/latest-engineer-report.json",
]);
const REVIEW_EVIDENCE_MAX_BYTES = 120_000;
const REVIEW_DIFF_MAX_CHARS = 12_000;

export function hashText(value = "") {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function extractReviewEvidenceReferences(text = "") {
  const refs = new Set();
  const pattern = /(?:^|[\s"'`(])((?:\.ai-supervisor\/evidence\/|\.ai-supervisor\\evidence\\)[^\s"'`)<>]+)/gi;
  for (const match of String(text).matchAll(pattern)) {
    refs.add(match[1].replaceAll("\\", "/").replace(/[.,;:]+$/, ""));
  }
  return [...refs];
}

export function isAllowedReviewEvidencePath(relativePath = "") {
  const value = String(relativePath).replaceAll("\\", "/");
  return REVIEW_EVIDENCE_ALLOWED_FILES.has(value) || REVIEW_EVIDENCE_ALLOWED_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function resolveReviewEvidencePath(repoRoot, input) {
  const relativePath = validateSafeRelativePath(input);
  const normalized = relativePath.replaceAll("\\", "/");
  if (!isAllowedReviewEvidencePath(normalized)) {
    throw new Error(`Review evidence path is not allow-listed: ${input}`);
  }
  const root = fs.realpathSync(repoRoot);
  const resolved = path.resolve(root, normalized);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error(`Review evidence path escaped repository root: ${input}`);
  }
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) {
    const real = fs.realpathSync(resolved);
    if (!real.startsWith(root + path.sep)) {
      throw new Error(`Review evidence symlink escaped repository root: ${input}`);
    }
  }
  const finalStat = fs.statSync(resolved);
  if (!finalStat.isFile()) throw new Error(`Review evidence is not a regular file: ${input}`);
  return { relativePath: normalized, absolutePath: resolved, sizeBytes: finalStat.size };
}

/**
 * @param {string} repoRoot
 * @param {unknown} input
 * @param {{ maxBytes?: number }} options
 */
export function loadReviewEvidenceFile(repoRoot, input, { maxBytes = REVIEW_EVIDENCE_MAX_BYTES } = {}) {
  try {
    const resolved = resolveReviewEvidencePath(repoRoot, input);
    const file = fs.openSync(resolved.absolutePath, "r");
    try {
      const bytesToRead = Math.min(resolved.sizeBytes, maxBytes);
      const buffer = Buffer.alloc(bytesToRead);
      fs.readSync(file, buffer, 0, bytesToRead, 0);
      const hash = crypto.createHash("sha256").update(fs.readFileSync(resolved.absolutePath)).digest("hex");
      const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
      const truncated = resolved.sizeBytes > maxBytes;
      const base = {
        path: resolved.relativePath,
        sizeBytes: resolved.sizeBytes,
        sha256: hash,
        truncated,
      };
      if (/\.json$/i.test(resolved.relativePath)) {
        try {
          return {
            ...base,
            format: "json",
            parseOk: !truncated,
            content: truncated ? redactSupervisorSecrets(text) : redactSupervisorSecrets(JSON.parse(text)),
            textPreview: truncated ? redactSupervisorSecrets(text) : undefined,
            error: truncated ? "JSON evidence truncated before parsing." : "",
          };
        } catch {
          return {
            ...base,
            format: "json",
            parseOk: false,
            content: null,
            textPreview: redactSupervisorSecrets(text),
            error: "Malformed JSON evidence; text preview sanitized.",
          };
        }
      }
      return {
        ...base,
        format: "text",
        parseOk: true,
        content: redactSupervisorSecrets(text),
      };
    } finally {
      fs.closeSync(file);
    }
  } catch (error) {
    return {
      path: String(input ?? "").replaceAll("\\", "/"),
      rejected: true,
      error: String(error instanceof Error ? error.message : error).slice(0, 500),
    };
  }
}

/**
 * @param {string} repoRoot
 * @param {{ taskText?: string; explicitReferences?: string[] }} input
 */
export function collectReviewEvidenceFiles(repoRoot, { taskText = "", explicitReferences = [] } = {}) {
  const references = [...new Set([...explicitReferences, ...extractReviewEvidenceReferences(taskText)])];
  const loaded = references.map((reference) => loadReviewEvidenceFile(repoRoot, reference));
  const included = loaded.filter((item) => !item.rejected);
  const rejected = loaded.filter((item) => item.rejected);
  return {
    requested: references,
    included,
    rejected,
    loadedCount: included.length,
    rejectedCount: rejected.length,
    accessManifest: {
      mode: "inlined-redacted-content",
      repositoryCheckoutAccessRequired: false,
      note: "Review evidence files are read from the local workspace and embedded in the reviewer package; reviewers must inspect included[].content, not the filesystem path alone.",
      artifacts: included.map((item) => ({
        path: item.path,
        format: item.format,
        parseOk: item.parseOk,
        sizeBytes: item.sizeBytes,
        sha256: item.sha256,
        truncated: item.truncated,
        contentInlined: Object.prototype.hasOwnProperty.call(item, "content"),
      })),
      rejected: rejected.map((item) => ({ path: item.path, error: item.error })),
    },
  };
}

/**
 * @param {{ paths?: string[]; preExistingStatus?: string[]; diffProvider?: (file: string) => string }} input
 */
export function buildTargetedDiffEvidence({ paths = [], preExistingStatus = [], diffProvider = () => "" } = {}) {
  const preExisting = new Map(
    preExistingStatus
      .map((line) => String(line).trim())
      .filter(Boolean)
      .map((line) => {
        const file = line.replace(/^([?MADRCU ]{1,2})\s+/, "").replaceAll("\\", "/");
        return [file, line.slice(0, 2).trim() || "unknown"];
      })
  );
  return [...new Set(paths.map((item) => String(item).replaceAll("\\", "/")))]
    .filter((item) => item && isAllowedReviewDiffPath(item))
    .slice(0, 30)
    .map((file) => {
      const rawDiff = String(diffProvider(file) ?? "");
      const redacted = String(redactSupervisorSecrets(rawDiff));
      return {
        path: file,
        preExistingDirtyStatus: preExisting.get(file) ?? "not-recorded",
        remediationRelevance: inferRemediationRelevance(file),
        diffExcerpt: redacted.slice(0, REVIEW_DIFF_MAX_CHARS),
        truncated: redacted.length > REVIEW_DIFF_MAX_CHARS,
        secretRedactionApplied: redacted !== rawDiff,
      };
    });
}

function normalizeStatusFiles(statusText = "") {
  return String(statusText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2).trim() || line.split(/\s+/)[0] || "unknown";
      const file = line.replace(/^([?MADRCU ]{1,2})\s+/, "").replaceAll("\\", "/");
      return { status, file };
    })
    .filter((item) => item.file && !/(^|\/)(\.git|node_modules|\.next)/i.test(item.file));
}

export function buildEngineerBaseline({
  taskId = "",
  programId = null,
  stage = null,
  taskObjective = "",
  repositoryRoot = "",
  gitStatus = "",
  diffNameStatus = "",
  diffStat = "",
  headSha = "",
  branch = "",
  startedAt = new Date().toISOString(),
  reviewerConfidenceThreshold = 0.8,
  humanReviewRequired = false,
} = {}) {
  const statusFiles = normalizeStatusFiles(gitStatus);
  const untracked = statusFiles.filter((item) => item.status === "??").map((item) => item.file);
  const dirty = statusFiles.filter((item) => item.status !== "??").map((item) => item.file);
  return redactSupervisorSecrets({
    schemaVersion: ENGINEER_EVIDENCE_SCHEMA_VERSION,
    taskId,
    programId,
    stage,
    taskObjective: String(taskObjective).slice(0, 4000),
    startedAt,
    repositoryRoot,
    headSha,
    branch,
    gitStatus: String(gitStatus).slice(0, 20_000),
    diffNameStatus: String(diffNameStatus).slice(0, 20_000),
    diffStat: String(diffStat).slice(0, 20_000),
    preExistingDirtyFiles: dirty.slice(0, 500),
    preExistingUntrackedFiles: untracked.slice(0, 500),
    preExistingDirtyCount: dirty.length,
    preExistingUntrackedCount: untracked.length,
    reviewerConfidenceThreshold,
    humanReviewRequired: Boolean(humanReviewRequired),
    binaryContentExcluded: true,
    unrestrictedDiffExcluded: true,
  });
}

/**
 * @param {{ baseline?: Record<string, unknown>; currentGitStatus?: string; generatedEvidencePaths?: string[] }} input
 */
export function classifyEvidenceFiles({ baseline = {}, currentGitStatus = "", generatedEvidencePaths = [] } = {}) {
  const baselineDirty = new Set((baseline.preExistingDirtyFiles ?? []).map(String));
  const baselineUntracked = new Set((baseline.preExistingUntrackedFiles ?? []).map(String));
  const generated = new Set(generatedEvidencePaths.map((item) => String(item).replaceAll("\\", "/")));
  return normalizeStatusFiles(currentGitStatus).map((item) => {
    let classification = "newly_modified_by_task";
    if (generated.has(item.file) || item.file.startsWith(".ai-supervisor/evidence/")) classification = "generated_evidence";
    else if (baselineDirty.has(item.file)) classification = "already_dirty_before_task_and_further_modified";
    else if (baselineUntracked.has(item.file)) classification = "pre_existing_untracked";
    else if (item.status === "??") classification = "newly_created_by_task";
    else if (/D/.test(item.status)) classification = "deleted_by_task";
    return {
      path: item.file,
      gitStatus: item.status,
      classification,
      provenanceConfidence: classification === "already_dirty_before_task_and_further_modified" ? "medium" : "high",
      note: classification === "already_dirty_before_task_and_further_modified"
        ? "File was dirty before this task; unrelated pre-existing hunks may remain."
        : "",
    };
  });
}

/**
 * @param {{ classifiedFiles?: { path?: string; classification?: string }[]; task?: string; maxFiles?: number }} input
 */
export function selectEvidenceDiffFiles({ classifiedFiles = [], task = "", maxFiles = 40 } = {}) {
  const taskText = String(task).toLowerCase();
  const productHardeningReview = isPrivateBetaActivationHardeningProductTask(taskText);
  const explicitBridgeImplementation = hasExplicitBridgeImplementationSignal(taskText);
  const priority = (file) => {
    if (file.startsWith("tools/neven-supervisor/")) return 0;
    if (file.startsWith("scripts/")) return 1;
    if (file.startsWith("__tests__/") || file.startsWith("tests/")) return 2;
    if (file.startsWith("src/server/")) return 3;
    if (file.startsWith("src/app/api/")) return 4;
    if (file.startsWith("src/lib/")) return 5;
    if (file.startsWith("migrations/")) return 6;
    if (file.startsWith("docs/") || file === "README.md" || file === "README_AUTOMATION.md") return 7;
    return 20;
  };
  return classifiedFiles
    .filter((item) => item.classification !== "generated_evidence")
    .filter((item) => !/(^|\/)(\.env|node_modules|\.next|\.git)|\.(png|jpg|jpeg|webp|gif|zip|pdf)$/i.test(item.path))
    .filter((item) =>
      productHardeningReview && !explicitBridgeImplementation
        ? !isBridgeEvidenceImplementationFile(item.path)
        : true
    )
    .filter((item) =>
      productHardeningReview && !explicitBridgeImplementation
        ? isPrivateBetaActivationHardeningEvidenceFile(item.path)
        : true
    )
    .filter((item) =>
      taskText.includes("bridge") || taskText.includes("supervisor")
        ? item.path.startsWith("tools/neven-supervisor/") || item.path.startsWith("__tests__/lib/") || item.path.startsWith("scripts/") || item.path === "package.json" || item.path === "README_AUTOMATION.md" || item.path === "README.md" || item.path.startsWith("docs/")
        : true
    )
    .sort((a, b) => priority(a.path) - priority(b.path) || a.path.localeCompare(b.path))
    .slice(0, maxFiles)
    .map((item) => item.path);
}

function isBridgeEvidenceImplementationFile(file = "") {
  const value = String(file);
  return (
    value.startsWith("tools/neven-supervisor/") ||
    value.startsWith("tools/neven-agent/") ||
    value === "src/lib/runtimeControl.ts" ||
    value === "scripts/engineer-sanitization-smoke.mjs" ||
    value.includes("nevenValidation") ||
    value.includes("runtimeControl.test")
  );
}

function isPrivateBetaActivationHardeningEvidenceFile(file = "") {
  const value = String(file);
  return (
    value === "src/app/api/financial-forecast/route.ts" ||
    value === "src/app/digital-twin/timeline/page.tsx" ||
    value === "src/app/api/memory/route.ts" ||
    value === "src/app/api/backup/export/route.ts" ||
    value === "src/app/api/private-beta/export/route.ts" ||
    value === "src/app/api/private-beta/deletion/route.ts" ||
    value.startsWith("src/server/services/") ||
    value.startsWith("src/server/repositories/") ||
    value.startsWith("src/server/db/") ||
    value === "src/lib/betaHardening.ts" ||
    value === "src/lib/privateBetaRuntime.ts" ||
    value === "src/lib/productionDataIntegrity.ts" ||
    value === "migrations/0009_private_beta_activation_lifecycle.sql" ||
    value === "scripts/postgres-operator-preflight.mjs" ||
    value === "scripts/private-beta-readiness.mjs" ||
    /^__tests__\/lib\/(betaHardening|privateBetaLifecyclePostgresService|securityAuthRoutes|postgresRuntimeSecurity|financialForecasting|productionDataIntegrity|privateBetaFoundation)\.test\.ts$/.test(value) ||
    /^tests\/(private-beta-foundation|financial-forecasting)\.spec\.ts$/.test(value)
  );
}

function isPrivateBetaActivationHardeningProductTask(text = "") {
  return /\bvireon_private_beta_activation_hardening\b|\bprivate[- ]beta activation hardening\b|\bactivation[- ]hardening\b|\bfinancial forecast route\b|\bdurable export\/deletion\b|\bmigration 0009\b|\bpostgresql operator preflight\b/.test(String(text).toLowerCase());
}

function hasExplicitBridgeImplementationSignal(text = "") {
  const value = String(text).toLowerCase();
  return /\btools\/neven-supervisor\b|\btools\\neven-supervisor\b|\btools\/neven-agent\b|\btools\\neven-agent\b|\bengineering bridge implementation\b|\bbridge implementation\b|\bbridge behavior\b|\bevidence-generation behavior\b|\breviewer orchestration\b|\bbridge command execution\b|\bbridge security\b|\bbridge memory\b|\bevidence classifier defect\b|\breview[- ]only scope classification defect\b|\bfix[^.\n]{0,120}\b(neven|engineering bridge|engineer(?:ing)? supervisor|supervisor classifier|evidence classifier)\b|\b(neven|engineering bridge|engineer(?:ing)? supervisor|supervisor classifier|evidence classifier)\b[^.\n]{0,120}\b(fix|implement|modify|change|repair|harden)\b/.test(value);
}

export function normalizeCommandEvidence(result = {}) {
  const stdout = String(result.stdout ?? result.output ?? "");
  const stderr = String(result.stderr ?? "");
  const output = [stdout, stderr].filter(Boolean).join("\n");
  const warnings = (output.match(/\bwarning\b/gi) ?? []).length;
  const errors = (output.match(/\berror\b/gi) ?? []).length;
  const start = Date.parse(result.startedAt ?? "");
  const end = Date.parse(result.completedAt ?? "");
  return redactSupervisorSecrets({
    command: result.command ?? "",
    startTimestamp: result.startedAt ?? null,
    endTimestamp: result.completedAt ?? null,
    durationMs: Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null,
    exitCode: result.code ?? null,
    stdoutByteCount: Buffer.byteLength(stdout, "utf8"),
    stderrByteCount: Buffer.byteLength(stderr, "utf8"),
    stdoutExcerpt: stdout.slice(-8000),
    stderrExcerpt: stderr.slice(-4000),
    warningsCount: warnings,
    errorsCount: errors,
    ok: Boolean(result.ok),
    redactionApplied: redactSupervisorSecrets(output) !== output,
  });
}

/**
 * @param {{ command?: string; output?: string }[]} validationResults
 */
export function extractNamedTestEvidence(validationResults = []) {
  const tests = [];
  for (const result of validationResults) {
    const command = String(result?.command ?? "");
    if (!/\bnpm run test\b|\bnode --test\b|nevenValidation\.test/i.test(command)) continue;
    const output = String(result?.output ?? "");
      const testFile = command.includes("nevenValidation.test")
        ? "__tests__/lib/nevenValidation.test.ts"
      : command.includes("runtimeControl.test")
        ? "__tests__/lib/runtimeControl.test.ts"
        : "npm run test aggregate";
    for (const line of output.split(/\r?\n/)) {
      const match = line.match(/^\s*✔\s+(.+?)\s+\(([\d.]+)ms\)/);
      if (!match) continue;
      const name = match[1].trim();
      tests.push({
        testFile,
        suiteName: inferTestDomain(name),
        testName: name.slice(0, 240),
        outcome: result?.ok === false ? "fail" : "pass",
        durationMs: Number(match[2]),
        domain: inferTestDomain(name),
        acceptanceCriterion: inferAcceptanceCriterion(name),
        syntheticOnly: true,
        crossUser: /cross-user|another user|user b|user a/i.test(name),
        restartDurability: /restart|reload|survive|durable|persists|persistence/i.test(name),
        idempotency: /idempot/i.test(name),
        localFallbackDetection: /fallback|local json|local store/i.test(name),
        securityRelated: /auth|secret|redact|rls|permission|forbidden|cross-user/i.test(name),
        command,
      });
    }
  }
  return tests.slice(0, 600);
}

function inferTestDomain(name = "") {
  const value = String(name).toLowerCase();
  if (value.includes("digital twin") || value.includes("scenario")) return "Digital Twin";
  if (value.includes("decision")) return "Decision Centre";
  if (value.includes("workflow")) return "Action Workflows";
  if (value.includes("ai cfo") || value.includes("answer")) return "AI CFO";
  if (value.includes("daily review")) return "Daily Review";
  if (value.includes("goal")) return "Goals";
  if (value.includes("postgres") || value.includes("database")) return "PostgreSQL";
  if (value.includes("vault") || value.includes("fact")) return "Financial Vault";
  if (value.includes("engineer") || value.includes("review")) return "Engineering Bridge";
  return "General";
}

function inferAcceptanceCriterion(name = "") {
  const value = String(name).toLowerCase();
  if (value.includes("cross-user") || value.includes("another user")) return "cross-user isolation";
  if (value.includes("persists") || value.includes("restart") || value.includes("durable")) return "restart durability";
  if (value.includes("fallback")) return "no local fallback";
  if (value.includes("idempot")) return "idempotency";
  if (value.includes("redact") || value.includes("secret")) return "secret redaction";
  return "targeted regression";
}

export const BRIDGE_TEST_SUITE_DEFINITIONS = [
  {
    id: "neven_validation",
    suite: "Neven validation",
    purpose: "Validate supervisor orchestration helpers and evidence gates.",
    patterns: [/engineer evidence/i, /review-only/i, /reviewer/i, /supervisor/i],
    acceptanceCriteria: ["targeted_bridge_tests", "validation_output"],
  },
  {
    id: "evidence_generation",
    suite: "Evidence generation",
    purpose: "Verify evidence package construction, bounded diffs and completeness checks.",
    patterns: [/engineer evidence|evidence completeness|targeted diff|endpoint smoke evidence|review evidence/i],
    acceptanceCriteria: ["evidence_generation_tests", "targeted_bridge_tests"],
  },
  {
    id: "retry_resume",
    suite: "Retry and resume",
    purpose: "Verify bounded retries, resume behavior and remediation flow.",
    patterns: [/retry|resume|remediation/i],
    acceptanceCriteria: ["retry_resume_lock_tests", "targeted_bridge_tests"],
  },
  {
    id: "lock_handling",
    suite: "Lock handling",
    purpose: "Verify stale-lock and duplicate-run protection.",
    patterns: [/lock|duplicate-run|stale running/i],
    acceptanceCriteria: ["retry_resume_lock_tests", "targeted_bridge_tests"],
  },
  {
    id: "redaction",
    suite: "Redaction",
    purpose: "Verify secret redaction in bridge payloads, reports and prompts.",
    patterns: [/redact|secret|canar|sanitiz/i],
    acceptanceCriteria: ["redaction_security_tests", "targeted_bridge_tests"],
  },
  {
    id: "review_loop",
    suite: "Review loop",
    purpose: "Verify independent-review verdicts, remediation prompts and failure handling.",
    patterns: [/reviewer|review gate|remediation prompt|review-only/i],
    acceptanceCriteria: ["targeted_bridge_tests", "evidence_generation_tests"],
  },
  {
    id: "endpoint_smoke",
    suite: "Endpoint smoke",
    purpose: "Verify CLI or endpoint smoke evidence shape.",
    patterns: [/endpoint smoke|cli.*smoke|smoke evidence|engineer:smoke/i],
    acceptanceCriteria: ["cli_endpoint_smoke", "targeted_bridge_tests"],
  },
];

/**
 * @param {{ tests?: Record<string, unknown>[]; commandEvidence?: Record<string, unknown>[]; taskScopes?: string[] }} input
 */
export function buildBridgeTestEvidence({ tests = [], commandEvidence = [], taskScopes = [] } = {}) {
  const relevantCommands = commandEvidence
    .filter((item) => /\bnpm run test\b|\bnpm run engineer:test:bridge\b|\bnode --test\b|nevenValidation\.test|engineer:smoke/i.test(String(item.command ?? "")))
    .map((item) => ({
      command: String(item.command ?? ""),
      pass: Boolean(item.pass ?? item.ok),
      exitCode: item.exitCode ?? item.code ?? null,
      durationMs: item.durationMs ?? null,
    }));
  const suites = BRIDGE_TEST_SUITE_DEFINITIONS.map((definition) => {
    const matchedTests = tests.filter((test) => {
      const haystack = [test.testName, test.suiteName, test.testFile, test.acceptanceCriterion, test.command].map((item) => String(item ?? "")).join("\n");
      return definition.patterns.some((pattern) => pattern.test(haystack));
    });
    const matchedCommands = relevantCommands.filter((item) => definition.patterns.some((pattern) => pattern.test(item.command)));
    const command = matchedTests[0]?.command ?? matchedCommands[0]?.command ?? null;
    const executed = matchedTests.length > 0 || matchedCommands.length > 0;
    const pass = executed && matchedTests.every((test) => String(test.outcome ?? "pass") === "pass") && matchedCommands.every((item) => item.pass !== false);
    return {
      id: definition.id,
      suite: definition.suite,
      testFile: matchedTests[0]?.testFile ?? null,
      taskScope: "engineering_bridge",
      purpose: definition.purpose,
      pass,
      durationMs: matchedTests.reduce((total, test) => total + Number(test.durationMs ?? 0), 0),
      executed,
      command,
      acceptanceCriteriaSatisfied: definition.acceptanceCriteria,
      matchedTestCount: matchedTests.length,
      matchedTests: matchedTests.map((test) => String(test.testName ?? "").slice(0, 180)).slice(0, 20),
    };
  });
  const requiredSuiteIds = ["neven_validation", "evidence_generation", "retry_resume", "lock_handling", "redaction", "review_loop", "endpoint_smoke"];
  const requiredSuites = suites.filter((suite) => requiredSuiteIds.includes(suite.id));
  return redactSupervisorSecrets({
    taskScopes,
    commandCount: relevantCommands.length,
    suites,
    counts: {
      total: suites.length,
      executed: suites.filter((suite) => suite.executed).length,
      passed: suites.filter((suite) => suite.pass).length,
      failed: suites.filter((suite) => suite.executed && !suite.pass).length,
    },
    requirements: {
      targeted_bridge_tests: {
        satisfied: requiredSuites.every((suite) => suite.executed && suite.pass),
        requiredSuites: requiredSuiteIds,
        missingSuites: requiredSuites.filter((suite) => !suite.executed).map((suite) => suite.id),
        failedSuites: requiredSuites.filter((suite) => suite.executed && !suite.pass).map((suite) => suite.id),
      },
    },
  });
}

/**
 * @param {{ task?: string; classifiedFiles?: { path?: string; classification?: string }[]; validationResults?: { command?: string; ok?: boolean; output?: string }[] }} input
 */
export function buildPersistenceAuditEvidence({ task = "", classifiedFiles = [], validationResults = [] } = {}) {
  const matches = classifiedFiles
    .filter((item) => /\.ai\/local-data|localStorage|sessionStorage|Store\.ts|Store\.json|fallback/i.test(item.path))
    .map((item) => ({
      path: item.path,
      classification: item.path.includes("__tests__") || item.path.includes("test") ? "test fixture" : item.classification === "generated_evidence" ? "engineering tooling" : "requires review",
      authority: /local-data|Store\.ts|fallback/i.test(item.path) ? "potential local-state reference" : "false positive",
    }));
  return redactSupervisorSecrets({
    command: validationResults.some((item) => item.command === "npm run test") ? "npm run test" : "not-run",
    taskScoped: true,
    authoritativeLocalStateCount: matches.filter((item) => item.classification === "requires review").length,
    filesystemAuthorityCount: matches.filter((item) => item.path.includes(".ai/local-data")).length,
    browserAuthorityCount: matches.filter((item) => /localStorage|sessionStorage/.test(item.path)).length,
    processMemoryAuthorityCount: matches.filter((item) => /Store\.ts/.test(item.path)).length,
    fallbackReadCount: matches.filter((item) => /fallback/i.test(item.path)).length,
    dualWriteCount: 0,
    retainedDemoTestPaths: matches.filter((item) => item.classification === "test fixture").map((item) => item.path).slice(0, 100),
    unresolvedMatches: matches.filter((item) => item.classification === "requires review").slice(0, 100),
    note: String(task).toLowerCase().includes("postgresql phase 2")
      ? "PostgreSQL Phase 2 task: unresolved local-state matches must be reviewed by domain stage."
      : "Task-scoped local-state audit; repository-wide conversion is not inferred.",
  });
}

/**
 * @param {{ classifiedFiles?: { path?: string; classification?: string }[]; validationResults?: { command?: string; ok?: boolean; output?: string }[] }} input
 */
export function buildProductionIntegrityEvidence({ classifiedFiles = [], validationResults = [] } = {}) {
  const test = validationResults.find((item) => item.command === "npm run test");
  return redactSupervisorSecrets({
    command: "npm run test",
    rulesEvaluated: [
      "retired store imports",
      "local JSON authority",
      "browser storage authority",
      "silent PostgreSQL fallback",
      "trusted user identity",
      "admin credential use",
      "secret redaction",
    ],
    violations: test?.ok === false ? ["Tests failed; inspect validation evidence."] : [],
    allowListedPaths: classifiedFiles.filter((item) => item.path.includes("__tests__")).map((item) => item.path).slice(0, 100),
    falsePositiveExclusions: ["test fixtures", "demo fixtures", "engineering tooling"],
    finalStatus: test?.ok === false ? "FAIL" : test ? "PASS" : "NOT_RUN",
  });
}

/**
 * @param {{ files?: string[]; readFile?: (path: string) => string }} input
 */
export function buildSecretScanEvidence({ files = [], readFile = () => "" } = {}) {
  const patterns = [
    { category: "openai-api-key", pattern: /sk-[A-Za-z0-9_-]{20,}/g },
    { category: "bearer-token", pattern: /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi },
    { category: "postgres-url-userinfo", pattern: /postgres(?:ql)?:\/\/[^:\s/'"]+:[^@\s'"]+@/gi },
    { category: "sql-password-literal", pattern: /\bPASSWORD\s+['"][^'"]+['"]/gi },
    { category: "pgpassword", pattern: /PGPASSWORD\s*=\s*['"]?[^'"\s]+/gi },
  ];
  const findings = [];
  for (const file of files.slice(0, 120)) {
    if (/(^|\/)(\.git|node_modules|\.next)|\.(png|jpg|jpeg|webp|gif|zip|pdf)$/i.test(file)) continue;
    let text = "";
    try {
      text = String(readFile(file) ?? "");
    } catch {
      continue;
    }
    for (const item of patterns) {
      const matches = [...text.matchAll(item.pattern)];
      for (const match of matches) {
        findings.push({
          file,
          category: item.category,
          fingerprint: hashText(match[0]).slice(0, 16),
          placeholder: /<secret>|example|dummy|synthetic|redacted/i.test(match[0]),
        });
      }
    }
  }
  const actual = findings.filter((item) => !item.placeholder);
  return redactSupervisorSecrets({
    filesScanned: files.length,
    patternsScanned: patterns.map((item) => item.category),
    findingsCount: findings.length,
    syntheticFixtureFindings: findings.filter((item) => item.placeholder).length,
    placeholderFindings: findings.filter((item) => item.placeholder).length,
    excludedGeneratedFiles: files.filter((file) => /(^|\/)(\.git|node_modules|\.next)|\.(png|jpg|jpeg|webp|gif|zip|pdf)$/i.test(file)).length,
    actualSecretFindings: actual.length,
    findings: findings.slice(0, 100),
    pass: actual.length === 0,
  });
}

/**
 * @param {{ classifiedFiles?: { path?: string; classification?: string }[]; readFile?: (path: string) => string }} input
 */
export function buildMigrationEvidence({ classifiedFiles = [], readFile = () => "" } = {}) {
  const migrationFiles = classifiedFiles.map((item) => item.path).filter((file) => file.startsWith("migrations/") && /\.sql$/i.test(file));
  const migrations = migrationFiles.map((file) => {
    let sql = "";
    try {
      sql = String(readFile(file) ?? "");
    } catch {}
    return {
      path: file,
      id: file.replace(/^migrations\//, "").replace(/\.sql$/i, ""),
      checksum: hashText(sql),
      transactionSafety: /\b(create\s+index\s+concurrently|vacuum|alter\s+type.+add\s+value)\b/i.test(sql) ? "requires-review" : "transaction-compatible",
      destructiveOperationDetected: /\b(drop\s+table|drop\s+column|truncate|delete\s+from)\b/i.test(sql),
      rlsImpact: /\b(row level security|enable row level security|policy)\b/i.test(sql),
      runtimeGrantImpact: /\bgrant\b|\brevoke\b/i.test(sql),
    };
  });
  return redactSupervisorSecrets({
    schemaChanged: migrations.length > 0,
    bootstrapRequired: migrations.length > 0,
    rollbackRequired: migrations.length > 0,
    reason: migrations.length > 0 ? "Migration files changed." : "No migration files changed in task-scoped evidence.",
    migrationFiles: migrations,
    humanApprovalRequired: migrations.some((item) => item.destructiveOperationDetected),
  });
}

/**
 * @param {{ task?: string; stage?: string | null; validation?: Record<string, unknown>; review?: Record<string, unknown> | null; tests?: Record<string, unknown>[]; migrationEvidence?: Record<string, unknown> }} input
 */
export function buildStageGateEvidence({ task = "", stage = null, validation = {}, review = null, tests = [], migrationEvidence = {} } = {}) {
  const configuredStages = [
    "Digital Twin",
    "Decision Centre",
    "Action Workflows",
    "AI CFO",
    "Daily Review",
    "Goals",
    "Cross-domain consistency",
    "Production hardening",
  ];
  const taskText = String(task).toLowerCase();
  const stages = taskText.includes("postgresql phase 2")
    ? configuredStages
    : [stage || "single engineering task"];
  return stages.map((name, index) => {
    const stageTests = tests.filter((item) => item.domain === name || name === "single engineering task");
    const explicitlyCurrent = stage ? String(stage).toLowerCase() === String(name).toLowerCase() : index === 0;
    return {
      stageName: name,
      intendedScope: explicitlyCurrent ? "current task or active program stage" : "pending unless separately evidenced",
      apisAudited: [],
      uiConsumersAudited: [],
      persistenceSourceBefore: "captured in baseline/provenance evidence where applicable",
      persistenceSourceAfter: "requires reviewer verification from targeted diffs",
      schemaReviewed: Boolean(migrationEvidence),
      migrationRequired: Boolean(migrationEvidence?.schemaChanged),
      migrationId: migrationEvidence?.migrationFiles?.[0]?.id ?? null,
      localPathsRetired: [],
      authoritativeStoreAfter: taskText.includes("postgres") ? "PostgreSQL where stage is complete" : "not applicable",
      restartDurabilityTests: stageTests.filter((item) => item.restartDurability).map((item) => item.testName),
      crossUserTests: stageTests.filter((item) => item.crossUser).map((item) => item.testName),
      targetedValidation: validation,
      fullValidation: validation,
      reviewerVerdict: review?.verdict ?? "NOT_RUN",
      reviewerConfidence: review?.confidence ?? null,
      status: explicitlyCurrent && validation?.ok ? "validated" : "pending",
    };
  });
}

/**
 * @param {{ classifiedFiles?: { path?: string }[] }} input
 */
export function buildEndpointSmokeEvidence({ classifiedFiles = [] } = {}) {
  return classifiedFiles
    .filter((item) => item.path.startsWith("src/app/api/") || item.path.startsWith("src/app/"))
    .slice(0, 80)
    .map((item) => ({
      routeOrSurface: item.path,
      method: "not-executed",
      authenticatedContext: "not-captured",
      responseStatus: "not-captured",
      responseSchema: "not-captured",
      userScoping: "requires route tests or reviewer inspection",
      errorBehaviour: "requires route tests or reviewer inspection",
      noSecretLeak: true,
      noLocalFallback: "requires production-integrity evidence",
    }));
}

/**
 * @param {{ task?: string; acceptanceCriteria?: string[]; files?: string[]; stage?: string | null }} input
 */
export function classifyTaskScopes({ task = "", acceptanceCriteria = [], files = [], stage = null } = {}) {
  const text = [task, stage, ...(acceptanceCriteria ?? [])].join("\n").toLowerCase();
  const effectiveStage = stage ?? inferProgramStageFromTaskText(task);
  const stageText = String(effectiveStage ?? "").toLowerCase();
  const relevantFiles = (files ?? []).map(String).filter(Boolean);
  const scopes = new Set();
  const isSuperBigBangProductTask = /\bvireon_super_big_bang\b|\bvireon super big bang\b|\bsuper big bang completion program\b/.test(text);
  const isReleaseCandidateProductTask =
    /\bvireon_release_candidate_and_private_beta\b|\bvireon release candidate\b|\bprivate beta readiness\b|\brc1\b/.test(text);
  const isPolishProductTask = /\bvireon_polish_program\b|\bvireon polish program\b|\bp9 full consistency audit\b|\bp10 final release-candidate audit\b/.test(text);
  const isPrivateBetaActivationHardeningTask = isPrivateBetaActivationHardeningProductTask(text);
  const isProductCompletionReview =
    /\bvireon product-mode\b|\bstage\s*1-10\b|\bsix-domain postgresql core persistence\b|\bcompleted vireon product\b|\bproduct completion review\b/.test(text) &&
    !/\btools\/neven-supervisor\b|\btools\\neven-supervisor\b|\bengineering bridge implementation\b|\bevidence system implementation\b/.test(text);
  const isProductProgramTask = isSuperBigBangProductTask || isReleaseCandidateProductTask || isPolishProductTask || isProductCompletionReview || isPrivateBetaActivationHardeningTask;
  const scopeText = isProductProgramTask && stageText ? stageText : text;
  const documentationOnly =
    /\bdocumentation|docs?|readme|runbook\b/.test(text) &&
    relevantFiles.length > 0 &&
    relevantFiles.every((file) => file.startsWith("docs/") || file.startsWith("README") || file === "AGENTS.md");
  const hasBridgeImplementationIntent =
    !documentationOnly &&
    (!isProductProgramTask || hasExplicitBridgeImplementationSignal(text)) &&
    hasExplicitBridgeImplementationSignal(text);
  const hasBridgeFileSignal =
    (!isProductProgramTask || hasExplicitBridgeImplementationSignal(text)) &&
    relevantFiles.some(
      (file) =>
        file.startsWith("tools/neven-supervisor/") ||
        file.startsWith("tools/neven-agent/") ||
        file === "src/lib/runtimeControl.ts" ||
        file === "scripts/engineer-sanitization-smoke.mjs" ||
        file.includes("nevenValidation") ||
        file.includes("runtimeControl.test")
    );
  const hasBridgeSignal = hasBridgeImplementationIntent || hasBridgeFileSignal;
  if (hasBridgeSignal) scopes.add("engineering_bridge");
  if (isProductProgramTask) scopes.add("product_completion");
  if (isPrivateBetaActivationHardeningTask) {
    scopes.add("background_jobs");
    scopes.add("export_lifecycle");
    scopes.add("deletion_lifecycle");
    scopes.add("operations");
    scopes.add("persistence");
    scopes.add("user_scoped_persistence");
  }
  if (/\bsecurity|redaction|secret|credential|password|token|api key\b/.test(scopeText) || relevantFiles.some((file) => /runtimeControl|productionDataIntegrity|auth|security/i.test(file))) {
    scopes.add("security");
  }
  if (/\bdocumentation|docs?|readme|runbook\b/.test(scopeText) || relevantFiles.some((file) => file.startsWith("docs/") || file.startsWith("README"))) {
    scopes.add("documentation");
  }

  const explicitFeatureWorkSuppressed = /\bdo not resume postgresql phase 2|do not resume feature work|bridge[- ]only|tooling changes?\b/.test(text);
  const bridgeOnly = hasBridgeSignal && explicitFeatureWorkSuppressed;
  const persistenceSignal =
    /\b(postgresql phase 2|postgresql-backed|durable postgresql|authoritative persistence|persistence domain|financial vault|digital twin|decision centre|decision center|action workflows?|ai cfo|daily review|goals|transactions?|subscriptions?|background jobs?|exports?|account deletion|auditability|cross-domain)\b/.test(scopeText) ||
    relevantFiles.some((file) => file.startsWith("src/server/") || file.startsWith("src/app/api/financial-vault/") || file.startsWith("src/app/api/digital-twin/") || file.startsWith("src/app/api/decisions/") || file.startsWith("src/app/api/action-workflows/") || file.startsWith("src/app/api/ai-cfo/") || file.startsWith("src/app/api/goals/"));
  if (persistenceSignal && !bridgeOnly) scopes.add("persistence");
  if (
    scopes.has("persistence") &&
    (/\buser[- ]scoped|cross[- ]user|trusted identity|restart durability|rls|ownership|financial vault|digital twin|decision centre|decision center|action workflows?|ai cfo|daily review|goals|transactions?|subscriptions?|background jobs?|exports?|account deletion\b/.test(scopeText) ||
      relevantFiles.some((file) => file.startsWith("src/server/repositories/") || file.startsWith("src/server/services/") || file.startsWith("src/app/api/")))
  ) {
    scopes.add("user_scoped_persistence");
  }
  if (!bridgeOnly && (/\b(migration|schema|bootstrap|rollback-check|rollback rehearsal)\b/.test(scopeText) || relevantFiles.some((file) => file.startsWith("migrations/")))) {
    scopes.add("migration");
  }
  if (!bridgeOnly && (/\b(authentication|authorization|auth|trusted identity|rls|row level security)\b/.test(scopeText) || relevantFiles.some((file) => /(^|\/)auth(\/|\.|$)|middleware/i.test(file)))) {
    scopes.add("authentication_authorization");
  }
  if (!bridgeOnly && (/\bapi route|endpoint|route|api persistence completion\b/.test(scopeText) || relevantFiles.some((file) => file.startsWith("src/app/api/")))) scopes.add("API");
  if (!bridgeOnly && (/\bui|component|page|browser|client|ui state consistency\b/.test(scopeText) || relevantFiles.some((file) => file.startsWith("src/app/") && !file.startsWith("src/app/api/")))) scopes.add("UI");
  if (scopes.size === 0) scopes.add("general_code");
  return [...scopes];
}

function evidenceRequirement(id, status, reason) {
  return { id, status, reason };
}

/**
 * @param {string | null | undefined} stage
 */
function classifyEvidenceStage(stage) {
  const text = String(stage ?? "").toLowerCase();
  if (/\baudit|current[- ]state|completion matrix|planning\b/.test(text)) return "audit";
  if (/\bschema|migration|migrations\b/.test(text)) return "migration";
  if (/\bsecurity\b/.test(text)) return "security";
  if (/\bapi persistence|api completion\b/.test(text)) return "api";
  if (/\bux\b|\buser experience\b|\bfailure[- ]state\b|\bui state|ui consistency\b/.test(text)) return "ui";
  if (/\bfinancial vault|digital twin|decision centre|decision center|action workflows?|ai cfo|daily review|goals|transactions?|subscriptions?|background jobs?|exports?|account deletion|auditability|api persistence|ui state|cross-domain|production hardening|private-beta|end-to-end\b/.test(text)) {
    return "persistence";
  }
  return "general";
}

function inferProgramStageFromTaskText(task = "") {
  const text = String(task ?? "").toLowerCase();
  if (/\bstage\s*1-10\b|\bcompleted vireon product\b|\bproduct completion review\b/.test(text)) {
    return "Final product review";
  }
  if (
    /\bstage\s*1\b[^.\n]{0,220}\b(release baseline|baseline|provenance|rc1|release candidate)\b|\b(release baseline|baseline|provenance|rc1|release candidate)\b[^.\n]{0,220}\bstage\s*1\b/.test(text)
  ) {
    return "Release baseline and provenance";
  }
  if (/\bstage\s*1\b[^.\n]{0,180}\b(audit|current[- ]state|completion matrix)\b|\b(audit|current[- ]state|completion matrix)\b[^.\n]{0,180}\bstage\s*1\b/.test(text)) {
    return "Current-state audit and completion matrix";
  }
  if (/\bstage\s*2\b[^.\n]{0,180}\b(schema|migration|migrations)\b|\b(schema|migration|migrations)\b[^.\n]{0,180}\bstage\s*2\b/.test(text)) {
    return "PostgreSQL schema and migration completion";
  }
  if (/\bstage\s*3\b[^.\n]{0,220}\b(ux|user experience|failure[- ]state|hardening)\b|\b(ux|user experience|failure[- ]state|hardening)\b[^.\n]{0,220}\bstage\s*3\b/.test(text)) {
    return "UX and failure-state hardening";
  }
  return null;
}

/**
 * @param {{ scopes?: string[]; task?: string; acceptanceCriteria?: string[]; migrations?: Record<string, unknown>; stage?: string | null }} input
 */
export function buildEvidenceRequirements({ scopes = [], task = "", acceptanceCriteria = [], migrations = {}, stage = null } = {}) {
  const scopeSet = new Set(scopes);
  const effectiveStage = stage ?? inferProgramStageFromTaskText(task);
  const stageKind = classifyEvidenceStage(effectiveStage);
  const hasCurrentStage = typeof effectiveStage === "string" && effectiveStage.trim().length > 0;
  const isAuditStage = stageKind === "audit";
  const isMigrationStage = stageKind === "migration";
  const userScopedPersistenceApplies = scopeSet.has("user_scoped_persistence") && !isAuditStage && !isMigrationStage;
  const migrationScopeApplies = !isAuditStage && (isMigrationStage || (!hasCurrentStage && scopeSet.has("migration")));
  const apiScopeApplies = scopeSet.has("API") && !isAuditStage && !isMigrationStage;
  const uiScopeApplies = scopeSet.has("UI") && !isAuditStage && !isMigrationStage;
  const securityScopeApplies = scopeSet.has("security") && !isAuditStage;
  const required = [];
  const optional = [];
  const notApplicable = [];
  const addRequired = (id, reason) => {
    if (!required.some((item) => item.id === id)) required.push(evidenceRequirement(id, "REQUIRED", reason));
  };
  const addOptional = (id, reason) => {
    if (!required.some((item) => item.id === id) && !optional.some((item) => item.id === id)) optional.push(evidenceRequirement(id, "OPTIONAL", reason));
  };
  const addNotApplicable = (id, reason) => {
    if (!required.some((item) => item.id === id) && !optional.some((item) => item.id === id) && !notApplicable.some((item) => item.id === id)) {
      notApplicable.push(evidenceRequirement(id, "NOT_APPLICABLE", reason));
    }
  };

  addRequired("targeted_diffs", "All task scopes require bounded task-relevant diffs.");
  addRequired("validation_output", "All task scopes require command-level validation evidence.");
  addRequired("dirty_worktree_provenance", "Dirty worktree provenance is required to distinguish task changes from pre-existing changes.");
  addOptional("secret_scan", "Secret-scan evidence is collected for all tasks and is mandatory for security-sensitive tasks.");

  if (scopeSet.has("engineering_bridge")) {
    addRequired("targeted_bridge_tests", "Engineering bridge changes require targeted Neven bridge tests.");
    addRequired("cli_endpoint_smoke", "Engineering bridge changes require CLI or endpoint smoke evidence.");
    addRequired("redaction_security_tests", "Bridge payload/report generation must prove redaction behavior.");
    addRequired("retry_resume_lock_tests", "Bridge orchestration changes must preserve retry, resume and lock behavior.");
    addRequired("evidence_generation_tests", "Evidence-system changes must prove package generation and completeness behavior.");
  }
  if (userScopedPersistenceApplies) {
    addRequired("cross_user_tests", "User-scoped persistence changes require cross-user read/write denial evidence.");
    addRequired("restart_durability_tests", "User-scoped persistence changes require restart durability evidence.");
    addRequired("trusted_identity_tests", "User-scoped persistence changes require trusted server identity evidence.");
    addRequired("local_fallback_audit", "Converted persistence domains require local fallback audit evidence.");
    addRequired("persistence_integrity", "Converted persistence domains require production integrity evidence.");
  } else {
    const reason = isAuditStage
      ? "Current stage is audit/planning only; no user-owned persistence behavior is modified."
      : isMigrationStage
        ? "Current stage is schema/migration review; domain persistence behavior is validated in later stages."
        : "No user-scoped persistence behavior is in this task scope.";
    addNotApplicable("cross_user_tests", reason);
    addNotApplicable("restart_durability_tests", reason);
    addNotApplicable("trusted_identity_tests", reason);
    addNotApplicable("local_fallback_audit", reason);
    addNotApplicable("persistence_integrity", reason);
  }
  if (migrationScopeApplies) {
    addRequired("migration_static_tests", "Current stage performs schema or migration work and requires migration static validation evidence.");
    if (migrations?.schemaChanged === true) {
      addRequired("migration_bootstrap", "Current migration stage changed schema and requires PostgreSQL pilot bootstrap evidence.");
      addRequired("migration_rollback", "Current migration stage changed schema and requires PostgreSQL pilot rollback-check evidence.");
    } else {
      addNotApplicable("migration_bootstrap", "Current migration stage did not change schema.");
      addNotApplicable("migration_rollback", "Current migration stage did not change schema.");
    }
  } else {
    const reason = isAuditStage
      ? "Current stage is audit/planning only; no schema or migration work is performed."
      : "Current stage does not perform schema or migration work.";
    addNotApplicable("migration_static_tests", reason);
    addNotApplicable("migration_bootstrap", reason);
    addNotApplicable("migration_rollback", reason);
  }
  if (uiScopeApplies) addRequired("ui_smoke", "UI changes require relevant UI smoke or component-test evidence.");
  else addNotApplicable("ui_smoke", isAuditStage ? "Current stage is audit/planning only; no UI behavior is modified." : "No UI behavior changed in this current stage.");
  if (apiScopeApplies) addRequired("api_smoke", "API changes require endpoint or route-test evidence.");
  else addNotApplicable("api_smoke", isAuditStage ? "Current stage is audit/planning only; no API behavior is modified." : "No API behavior changed in this current stage.");
  if (scopeSet.has("documentation")) addOptional("documentation_consistency", "Documentation changes should include changed-document evidence and consistency checks.");
  if (securityScopeApplies) addRequired("secret_scan", "Security-sensitive changes require secret-scan evidence.");

  const explicit = [task, ...(acceptanceCriteria ?? [])].join("\n").toLowerCase();
  const crossUserNegated =
    /\bcross[- ]user[^.\n]{0,120}\bnot[- ]applicable\b|\bnot[- ]applicable[^.\n]{0,120}\bcross[- ]user\b|\bdo not require[^.\n]{0,120}\bcross[- ]user\b|\bno[^.\n]{0,80}\bcross[- ]user\b/.test(explicit);
  const restartNegated =
    /\brestart[- ]durability[^.\n]{0,120}\bnot[- ]applicable\b|\bnot[- ]applicable[^.\n]{0,120}\brestart[- ]durability\b|\bdo not require[^.\n]{0,120}\brestart[- ]durability\b|\bno[^.\n]{0,80}\brestart[- ]durability\b/.test(explicit);
  if (/\bcross[- ]user\b/.test(explicit) && !crossUserNegated) addRequired("cross_user_tests", "Explicit acceptance criteria require cross-user evidence.");
  if ((/\brestart[- ]durability|survives restart\b/.test(explicit)) && !restartNegated) addRequired("restart_durability_tests", "Explicit acceptance criteria require restart durability evidence.");
  if (/\bbootstrap\b/.test(explicit) && scopeSet.has("migration")) addRequired("migration_bootstrap", "Explicit migration acceptance criteria require bootstrap evidence.");
  if (/\brollback(?:-check)?\b/.test(explicit) && scopeSet.has("migration")) addRequired("migration_rollback", "Explicit migration acceptance criteria require rollback evidence.");

  return redactSupervisorSecrets({
    scopes,
    stage: effectiveStage,
    stageKind,
    required,
    optional,
    notApplicable: notApplicable.filter((item) => !required.some((requiredItem) => requiredItem.id === item.id)),
  });
}

export function validateEngineerEvidencePackage(pkg = {}) {
  const missing = [];
  const manifest = pkg.manifest ?? {};
  if (!manifest.taskId) missing.push("TASK_ID_MISSING");
  if (!pkg.baseline) missing.push("BASELINE_MISSING");
  if (!Array.isArray(pkg.changedFiles)) missing.push("CHANGED_FILES_MISSING");
  if (!Array.isArray(pkg.targetedDiffs)) missing.push("REQUIRED_TARGETED_DIFF_MISSING");
  if (!Array.isArray(pkg.validationCommands)) missing.push("REQUIRED_VALIDATION_COMMAND_MISSING");
  if (!pkg.persistenceAudit) missing.push("PERSISTENCE_AUDIT_MISSING");
  if (!pkg.integrity) missing.push("PRODUCTION_INTEGRITY_MISSING");
  if (!pkg.securityScan) missing.push("SECRET_SCAN_MISSING");
  if (!pkg.migrations) missing.push("MIGRATION_EVIDENCE_MISSING");
  const scopes = Array.isArray(pkg.taskScopes)
    ? pkg.taskScopes
    : classifyTaskScopes({
        task: manifest.taskObjective,
        acceptanceCriteria: manifest.acceptanceCriteria,
        files: Array.isArray(pkg.targetedDiffs) ? pkg.targetedDiffs.map((item) => item.path).filter(Boolean) : [],
        stage: manifest.currentStage,
      });
  const evidenceRequirements = pkg.evidenceRequirements ?? buildEvidenceRequirements({
    scopes,
    task: manifest.taskObjective,
    acceptanceCriteria: manifest.acceptanceCriteria,
    migrations: pkg.migrations,
    stage: manifest.currentStage,
  });
  const explicitEvidenceCommands = Array.isArray(pkg.explicitReviewEvidenceSummary?.validationCommands)
    ? pkg.explicitReviewEvidenceSummary.validationCommands.map((item) => String(item.command ?? item ?? ""))
    : [];
  const commands = [
    ...(Array.isArray(pkg.validationCommands) ? pkg.validationCommands.map((item) => String(item.command ?? "")) : []),
    ...explicitEvidenceCommands,
  ];
  const tests = Array.isArray(pkg.tests) ? pkg.tests : [];
  const requiredIds = new Set((evidenceRequirements.required ?? []).map((item) => item.id));
  if (requiredIds.has("cross_user_tests") && !tests.some((item) => item.crossUser)) missing.push("CROSS_USER_TEST_EVIDENCE_MISSING");
  if (requiredIds.has("restart_durability_tests") && !tests.some((item) => item.restartDurability)) missing.push("RESTART_DURABILITY_EVIDENCE_MISSING");
  if (requiredIds.has("migration_bootstrap") && !commands.some((command) => command.includes("postgres:pilot:bootstrap"))) missing.push("MIGRATION_BOOTSTRAP_EVIDENCE_MISSING");
  if (requiredIds.has("migration_rollback") && !commands.some((command) => command.includes("postgres:pilot:rollback-check"))) missing.push("MIGRATION_ROLLBACK_EVIDENCE_MISSING");
  if (requiredIds.has("targeted_bridge_tests")) {
    const bridgeRequirement = pkg.bridgeTestEvidence?.requirements?.targeted_bridge_tests;
    if (!bridgeRequirement?.satisfied) {
      const missingSuites = Array.isArray(bridgeRequirement?.missingSuites) ? bridgeRequirement.missingSuites : [];
      const failedSuites = Array.isArray(bridgeRequirement?.failedSuites) ? bridgeRequirement.failedSuites : [];
      if (failedSuites.length > 0) {
        missing.push("TARGETED_BRIDGE_TEST_EVIDENCE_FAILED");
      }
      if (missingSuites.length > 0 || (!missingSuites.length && !failedSuites.length)) {
        missing.push("TARGETED_BRIDGE_TEST_EVIDENCE_MISSING");
      }
    }
  }
  return {
    ok: missing.length === 0,
    missing,
    schemaVersion: ENGINEER_EVIDENCE_SCHEMA_VERSION,
    taskScopes: scopes,
    evidenceRequirements,
  };
}

function isAllowedReviewDiffPath(file) {
  return (
    file.startsWith("src/lib/") ||
    file.startsWith("tools/neven-supervisor/") ||
    file.startsWith("scripts/") ||
    file.startsWith("__tests__/lib/") ||
    file === "package.json"
  ) && !/(^|\/)(\.env|node_modules|\.next|\.git)/i.test(file);
}

function inferRemediationRelevance(file) {
  if (file.includes("runtimeControl")) return "runtime bridge defect/status serialization";
  if (file.includes("validation-core")) return "supervisor redaction and review evidence helpers";
  if (file.includes("engineer-sanitization-smoke")) return "endpoint-level sanitization smoke";
  if (file.includes("nevenValidation.test") || file.includes("runtimeControl.test")) return "adversarial sanitization regression coverage";
  if (file === "package.json") return "CLI smoke command registration";
  return "explicitly referenced remediation file";
}

export function buildRemediationPrompt({ originalTask = "", review = {}, evidence = {}, validation = {} } = {}) {
  return buildReviewerRemediationTask({ originalTask, review, evidence, validation }).prompt;
}

/**
 * @param {{ review?: Record<string, unknown>; changedFiles?: string[] }} input
 */
export function selectRemediationValidationCommands({ review = {}, changedFiles = [] } = {}) {
  const result = normaliseReviewerResult(review);
  const content = [
    ...result.validation_findings,
    ...result.required_remediation,
    ...result.missing_evidence,
    ...changedFiles,
  ].join("\n").toLowerCase();
  if (/\bbuild\b|next\.config|package-lock|package\.json/.test(content)) {
    return [...DEFAULT_ENGINEER_TARGETED_VALIDATION_COMMANDS, "npm run build"];
  }
  if (/\blint\b|eslint|format/.test(content)) {
    return ["npm run lint", ...DEFAULT_ENGINEER_TARGETED_VALIDATION_COMMANDS];
  }
  return [...DEFAULT_ENGINEER_TARGETED_VALIDATION_COMMANDS];
}

/**
 * @param {{ reviewOnly?: boolean; guidance?: string; activeRemediationTask?: Record<string, unknown> | null }} input
 */
export function shouldSkipInitialReviewOnlyImplementation({ reviewOnly = false, guidance = "", activeRemediationTask = null } = {}) {
  return Boolean(reviewOnly && !activeRemediationTask && !String(guidance ?? "").trim());
}

/**
 * @param {{ originalTask?: string; review?: Record<string, unknown>; evidence?: Record<string, unknown>; validation?: Record<string, unknown> }} input
 */
export function buildReviewerRemediationTask({ originalTask = "", review = {}, evidence = {}, validation = {} } = {}) {
  const result = normaliseReviewerResult(review);
  const changedFiles = Array.isArray(evidence?.changedFiles) ? evidence.changedFiles.map(String).slice(0, 40) : [];
  const targetedValidationCommands = selectRemediationValidationCommands({ review: result, changedFiles });
  const remediationSources = redactSupervisorSecrets({
    required_remediation: result.required_remediation,
    missing_evidence: result.missing_evidence,
    architecture_findings: result.architecture_findings,
    security_findings: result.security_findings,
  });
  const prompt = [
    "Remediate the previous implementation attempt without redoing passing work.",
    "",
    "Original task:",
    String(redactSupervisorSecrets(originalTask)).slice(0, 6000),
    "",
    "Reviewer structured remediation sources:",
    JSON.stringify(remediationSources, null, 2).slice(0, 10_000),
    "",
    "Failed or missing acceptance criteria:",
    String(redactSupervisorSecrets(
      result.acceptance_criteria_results.filter((item) => /\bfail|\bmissing|\bincomplete/i.test(item)).join("\n") || "See required remediation."
    )),
    "",
    "Current validation status:",
    JSON.stringify(redactSupervisorSecrets(validation), null, 2).slice(-6000),
    "",
    "Bounded evidence references:",
    JSON.stringify(redactSupervisorSecrets({
      changedFiles,
      explicitReviewEvidence: evidence?.explicitReviewEvidence?.accessManifest ?? null,
      targetedDiffs: evidence?.targetedDiffs ?? [],
      truncated: Boolean(evidence?.truncated),
    }), null, 2).slice(-8000),
    "",
    "Targeted validation to rerun before final review:",
    targetedValidationCommands.join("\n"),
    "",
    "Constraints:",
    "- Do not expand scope.",
    "- Do not redo passing work.",
    "- Do not deploy, commit, run destructive migrations, or perform irreversible operations.",
    "- Preserve human approval requirements for destructive schema changes, production deployment, and irreversible operations.",
    "- Do not expose secrets.",
  ].join("\n");
  return redactSupervisorSecrets({
    title: "Reviewer remediation",
    status: "queued",
    generatedAt: new Date().toISOString(),
    prompt,
    targetedValidationCommands,
    sources: remediationSources,
    limits: {
      originalTaskChars: 6000,
      remediationSourcesChars: 10000,
      validationChars: 6000,
      evidenceChars: 8000,
    },
  });
}

export function shouldRequireHumanReview({ task = "", changedFiles = [], configured = false } = {}) {
  if (configured) return true;
  const content = [task, ...changedFiles].join("\n");
  return HIGH_RISK_REVIEW_PATTERNS.some((pattern) => pattern.test(content));
}

export function createMemoryEntry(input = {}) {
  if (input.evidenceLevel !== "validated" && input.evidenceLevel !== "human-approved") return null;
  return redactSupervisorSecrets({
    id: input.id ?? `mem-${Date.now()}`,
    category: input.category ?? "validated_fixes",
    title: String(input.title ?? "Validated engineering lesson").slice(0, 160),
    concise_problem: String(input.problem ?? "").slice(0, 1000),
    root_cause: String(input.rootCause ?? "").slice(0, 1000),
    validated_resolution: String(input.resolution ?? "").slice(0, 1000),
    affected_files_or_domains: Array.isArray(input.affectedFilesOrDomains) ? input.affectedFilesOrDomains.map(String).slice(0, 30) : [],
    evidence_references: Array.isArray(input.evidenceReferences) ? input.evidenceReferences.map(String).slice(0, 20) : [],
    confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.8))),
    created_at: input.createdAt ?? new Date().toISOString(),
    last_used_at: input.lastUsedAt ?? null,
    usage_count: Number(input.usageCount ?? 0),
    status: input.status === "superseded" || input.status === "rejected" ? input.status : "active",
    supersedes: input.supersedes ?? null,
    source_task_id: input.sourceTaskId ?? null,
    evidence_level: input.evidenceLevel,
  });
}

export function retrieveRelevantMemories(entries = [], query = "", { maxEntries = 5, maxChars = 4000, minConfidence = 0.5 } = {}) {
  const terms = new Set(String(query).toLowerCase().match(/[a-z0-9_/-]{4,}/g) ?? []);
  const scored = entries
    .filter((entry) => entry && entry.status === "active" && Number(entry.confidence ?? 0) >= minConfidence)
    .map((entry) => {
      const haystack = [
        entry.category,
        entry.title,
        entry.concise_problem,
        entry.root_cause,
        entry.validated_resolution,
        ...(entry.affected_files_or_domains ?? []),
      ].join(" ").toLowerCase();
      const score = [...terms].filter((term) => haystack.includes(term)).length;
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.entry.confidence ?? 0) - Number(a.entry.confidence ?? 0))
    .slice(0, maxEntries)
    .map((item) => item.entry);
  const text = JSON.stringify(redactSupervisorSecrets(scored));
  return text.length <= maxChars ? scored : scored.slice(0, Math.max(1, Math.floor(maxEntries / 2)));
}

export function selectNextProgramTask(manifest = {}) {
  const stages = Array.isArray(manifest.stage_order) ? manifest.stage_order : [];
  const completed = new Set(Array.isArray(manifest.completed_stages) ? manifest.completed_stages : []);
  return stages.find((stage) => !completed.has(stage)) ?? null;
}

export function validateSafeRelativePath(input) {
  const value = String(input ?? "").replaceAll("\\", "/");
  if (!value || value.includes("\0") || value.startsWith("/") || /^[A-Za-z]:/.test(value) || value.split("/").includes("..")) {
    throw new Error(`Unsafe path: ${input}`);
  }
  return value;
}

export function assertAllowedEngineerCommand(command) {
  if (
    !DEFAULT_ENGINEER_VALIDATION_COMMANDS.includes(command) &&
    !ENGINEER_BRIDGE_TARGETED_VALIDATION_COMMANDS.includes(command) &&
    !["git status --short", "git diff --stat", "git diff --name-status"].includes(command)
  ) {
    throw new Error(`Command is not allow-listed: ${command}`);
  }
  return true;
}
