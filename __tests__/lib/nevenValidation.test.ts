import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  assertNoSecretValuesInDiagnostics,
  formatEnvDiagnostics,
  loadRepositoryNextEnv,
  readEnvLocalNames,
} from "../../scripts/load-next-env.mjs";
import {
  DEFAULT_ENGINEER_VALIDATION_COMMANDS,
  assertGptCannotMutateRemediationState,
  assertAllowedEngineerCommand,
  buildBridgeTestEvidence,
  buildBoundedEvidence,
  buildEvidenceRequirements,
  buildEngineerBaseline,
  buildEndpointSmokeEvidence,
  buildMigrationEvidence,
  buildOpenAiEnvironmentTrace,
  buildPersistenceAuditEvidence,
  buildProductionIntegrityEvidence,
  buildRemediationPrompt,
  buildReviewerRemediationTask,
  buildSecretScanEvidence,
  buildStageGateEvidence,
  buildTargetedDiffEvidence,
  canAcquireValidationLock,
  canStartEngineerRun,
  classifyTaskScopes,
  classifyEvidenceFiles,
  collectReviewEvidenceFiles,
  classifyBrowserIssues,
  createMemoryEntry,
  evaluateReviewGate,
  extractNamedTestEvidence,
  nextEngineerStatus,
  normaliseReviewerResult,
  redactSupervisorSecrets,
  reviewerApiKeyState,
  resolveReviewerApiKey,
  retrieveRelevantMemories,
  resolveReviewEvidencePath,
  selectEvidenceDiffFiles,
  selectRemediationValidationCommands,
  selectNextProgramTask,
  shouldRequireHumanReview,
  shouldSkipInitialReviewOnlyImplementation,
  isLockStale,
  loadReviewEvidenceFile,
  listStaleRunningTasks,
  summarizeValidationResults,
  validateEngineerEvidencePackage,
  validateSafeRelativePath,
  shouldEnterRemediation,
} from "../../tools/neven-supervisor/validation-core.mjs";

function withTempRepo(fn: (repo: string) => void) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "neven-evidence-"));
  fs.mkdirSync(path.join(repo, ".ai-supervisor", "evidence"), { recursive: true });
  try {
    fn(repo);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

function processEnvFixture(values: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values } as NodeJS.ProcessEnv;
}

test("standalone Next env loader exposes .env.local values to engineer diagnostics", () => {
  withTempRepo((repo) => {
    fs.writeFileSync(
      path.join(repo, ".env.local"),
      [
        "NEXT_PUBLIC_SUPABASE_URL=https://synthetic.supabase.test",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-anon-key-not-logged",
        "SUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-not-logged",
      ].join("\n"),
      "utf8"
    );
    const result = spawnSync(process.execPath, [path.join(process.cwd(), "tools/neven-supervisor/engineer.mjs"), "--env-diagnostics"], {
      cwd: repo,
      env: { ...process.env, NEVEN_REPO: repo },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /NEXT_PUBLIC_SUPABASE_URL/);
    assert.match(result.stdout, /PRESENT/);
    assert.match(result.stdout, /repository-env/);
    assert.doesNotMatch(result.stdout + result.stderr, /synthetic-service-role-not-logged|synthetic-anon-key-not-logged/);
  });
});

test("standalone Next env loader keeps process environment precedence over .env.local", () => {
  withTempRepo((repo) => {
    fs.writeFileSync(path.join(repo, ".env.local"), "NEXT_PUBLIC_SUPABASE_URL=https://repo-env.example\n", "utf8");
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://process-env.example";
    try {
      const report = loadRepositoryNextEnv({ repoRoot: repo, variableNames: ["NEXT_PUBLIC_SUPABASE_URL"] });
      assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "https://process-env.example");
      assert.equal(report.variables[0].source, "process");
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  });
});

test("standalone Next env loader fails safely for missing and malformed env files", () => {
  withTempRepo((repo) => {
    const missing = loadRepositoryNextEnv({ repoRoot: repo, variableNames: ["SUPABASE_SERVICE_ROLE_KEY"] });
    assert.equal(missing.envLocalExists, false);
    assert.equal(missing.variables[0].status, "MISSING");
    fs.writeFileSync(path.join(repo, ".env.local"), "not a valid env assignment\nSUPABASE_SERVICE_ROLE_KEY=value\n", "utf8");
    assert.equal(readEnvLocalNames(repo).malformed, true);
    assert.throws(() => loadRepositoryNextEnv({ repoRoot: repo, failOnMalformed: true }), /MALFORMED_ENV_LOCAL/);
  });
});

test("standalone Next env diagnostics do not log values and child processes inherit resolved config", () => {
  withTempRepo((repo) => {
    fs.writeFileSync(path.join(repo, ".env.local"), "SUPABASE_SERVICE_ROLE_KEY=child-secret-not-logged\n", "utf8");
    const report = loadRepositoryNextEnv({ repoRoot: repo, variableNames: ["SUPABASE_SERVICE_ROLE_KEY"] });
    const text = formatEnvDiagnostics(report);
    assertNoSecretValuesInDiagnostics(text, processEnvFixture({ SUPABASE_SERVICE_ROLE_KEY: "child-secret-not-logged" }));
    assert.doesNotMatch(text, /child-secret-not-logged/);
    const child = spawnSync(process.execPath, ["-e", "console.log(process.env.SUPABASE_SERVICE_ROLE_KEY ? 'PRESENT' : 'MISSING')"], {
      env: process.env,
      encoding: "utf8",
    });
    assert.equal(child.stdout.trim(), "PRESENT");
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
});

test("standalone Next env loader accepts Windows repository paths", () => {
  withTempRepo((repo) => {
    fs.writeFileSync(path.join(repo, ".env.local"), "NEXT_PUBLIC_SUPABASE_ANON_KEY=windows-path-secret\n", "utf8");
    const report = loadRepositoryNextEnv({ repoRoot: path.resolve(repo), variableNames: ["NEXT_PUBLIC_SUPABASE_ANON_KEY"] });
    assert.equal(path.isAbsolute(report.repoRoot), true);
    assert.equal(report.variables[0].status, "PRESENT");
    assert.doesNotMatch(formatEnvDiagnostics(report), /windows-path-secret/);
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });
});

test("healthy supervisor skips remediation", () => {
  assert.equal(shouldEnterRemediation({ browserOk: true, supervisorHealthy: true, staleRunningTasks: [] }), false);
});

test("recoverable browser server failure is classified for bounded repair", () => {
  const result = classifyBrowserIssues(["http 500: http://localhost:3000/_next/static/chunks/app.css"]);
  assert.equal(result.kind, "recoverable-server-state");
  assert.equal(result.recoverable, true);
});

test("unrecoverable hydration failure exits without supervisor task remediation", () => {
  const result = classifyBrowserIssues(["page error: Hydration failed because the server rendered text didn't match the client"]);
  assert.equal(result.kind, "unrecoverable-app-hydration");
  assert.equal(result.recoverable, false);
});

test("browser runtime failure exits quickly", () => {
  const result = classifyBrowserIssues(["browser check failed: browserType.launch: spawn EPERM"]);
  assert.equal(result.kind, "unrecoverable-browser-runtime");
  assert.equal(result.recoverable, false);
});

test("stale running supervisor task is detected", () => {
  const now = Date.parse("2026-07-19T10:00:00.000Z");
  const stale = listStaleRunningTasks(
    [
      { id: "old", status: "running", startedAt: "2026-07-19T09:50:00.000Z" },
      { id: "new", status: "running", startedAt: "2026-07-19T09:59:30.000Z" },
      { id: "done", status: "complete", startedAt: "2026-07-19T08:00:00.000Z" },
    ],
    now,
    5 * 60 * 1000
  );
  assert.deepEqual(
    stale.map((task) => task.id),
    ["old"]
  );
});

test("active validation lock blocks concurrent runs", () => {
  const existingLock = {
    runId: "run-a",
    ownerPid: 123,
    createdAt: "2026-07-19T09:59:00.000Z",
  };
  const result = canAcquireValidationLock({
    existingLock,
    activePids: new Set([123]),
    nowMs: Date.parse("2026-07-19T10:00:00.000Z"),
    staleAfterMs: 5 * 60 * 1000,
  });
  assert.equal(result.ok, false);
  assert.equal(result.action, "blocked");
});

test("stale lock can be safely replaced", () => {
  const existingLock = {
    runId: "run-a",
    ownerPid: 123,
    createdAt: "2026-07-19T09:00:00.000Z",
  };
  assert.equal(
    isLockStale(existingLock, new Set([123]), Date.parse("2026-07-19T10:00:00.000Z"), 5 * 60 * 1000),
    true
  );
  const result = canAcquireValidationLock({
    existingLock,
    activePids: new Set([123]),
    nowMs: Date.parse("2026-07-19T10:00:00.000Z"),
    staleAfterMs: 5 * 60 * 1000,
  });
  assert.equal(result.ok, true);
  assert.equal(result.action, "replace-stale");
});

test("recursive remediation prevention uses the same lock semantics", () => {
  const result = canAcquireValidationLock({
    existingLock: {
      runId: "same-process-parent",
      ownerPid: 777,
      createdAt: "2026-07-19T09:59:50.000Z",
    },
    activePids: new Set([777]),
    nowMs: Date.parse("2026-07-19T10:00:00.000Z"),
    staleAfterMs: 5 * 60 * 1000,
  });
  assert.equal(result.ok, false);
});

test("model output cannot mutate remediation state", () => {
  const result = assertGptCannotMutateRemediationState({ status: "complete", explanation: "Done" });
  assert.equal(result.ok, false);
  assert.deepEqual(result.attempted, ["status"]);
});

test("engineer validation sequence includes full repository gates", () => {
  assert.deepEqual(DEFAULT_ENGINEER_VALIDATION_COMMANDS, [
    "npm run lint",
    "npm run typecheck",
    "npm run test",
    "npm run build",
    "npm run validate",
  ]);
});

test("engineer duplicate-run prevention blocks active tasks", () => {
  const result = canStartEngineerRun({
    state: { status: "running", lock: null },
    tasks: [{ id: "task-a", status: "running" }],
  });
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /task-a/);
});

test("engineer restart resume can replace stale lock after timeout", () => {
  const result = canStartEngineerRun({
    state: { lock: { active: true, runId: "old-run", startedAt: "2026-07-19T09:00:00.000Z" } },
    tasks: [],
    nowMs: Date.parse("2026-07-19T10:00:00.000Z"),
    staleAfterMs: 30 * 60 * 1000,
  });
  assert.equal(result.ok, true);
});

test("engineer retry bounds continue until max attempts then block", () => {
  assert.equal(
    nextEngineerStatus({ attempt: 1, maxAttempts: 3, codexOk: false, validationOk: false, blocker: false }),
    "running"
  );
  assert.equal(
    nextEngineerStatus({ attempt: 3, maxAttempts: 3, codexOk: false, validationOk: false, blocker: false }),
    "blocked"
  );
  assert.equal(
    nextEngineerStatus({ attempt: 1, maxAttempts: 3, codexOk: true, validationOk: true, blocker: false }),
    "complete"
  );
});

test("engineer validation summary preserves command failures without raw noise", () => {
  const summary = summarizeValidationResults([
    { command: "npm run lint", ok: true, code: 0, summary: "PASS" },
    { command: "npm run test", ok: false, code: 1, summary: "FAIL", output: "stack" },
  ]);
  assert.equal(summary.ok, false);
  assert.deepEqual(summary.failures, [{ command: "npm run test", code: 1, summary: "FAIL" }]);
});

test("engineer redaction removes API keys URLs PGPASSWORD and nested secrets", () => {
  const secret = "sk-test-secret-value";
  const password = "p@ss:'word";
  const redacted = redactSupervisorSecrets(
    {
      argv: ["postgresql://user:p%40ss@db.example/postgres", "PGPASSWORD=p@ss:'word"],
      stderr: `Authorization: Bearer ${secret}\nALTER ROLE vireon_app PASSWORD '${password}'`,
      nested: { apiKey: secret, password, secretsRedacted: true },
    },
    [secret, password]
  );
  const text = JSON.stringify(redacted);
  assert.equal(text.includes(secret), false);
  assert.equal(text.includes(password), false);
  assert.match(text, /<redacted>/);
  assert.equal(redacted.nested.secretsRedacted, true);
});

test("engineer redaction sanitizes final reports without leaking canaries", () => {
  const canary = "canary-final-green-report-6f89c1d2";
  const report = {
    status: "PASS",
    codex: {
      output: `Codex output with Bearer ${canary}`,
      stderr: `ALTER ROLE vireon_app PASSWORD '${canary}'`,
    },
    validation: {
      summary: `PGPASSWORD=${canary}`,
      nested: { token: canary, connectionString: `postgresql://user:${canary}@db.example/postgres` },
    },
    reviewer: {
      security_findings: [`unexpected secret ${canary}`],
      rawSecret: canary,
    },
  };
  const text = JSON.stringify(redactSupervisorSecrets(report, [canary]));
  assert.equal(text.includes(canary), false);
  assert.match(text, /<redacted>/);
});

test("engineer redaction strips prototype pollution keys cycles buffers and oversized values", () => {
  const canary = "canary-bridge-redaction-a3a826d9";
  const payload: Record<string, unknown> = JSON.parse(`{"safe":"${canary}","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"bad":true}}`);
  payload.self = payload;
  payload.binary = Buffer.from(canary);
  payload.large = `${canary} `.repeat(5000);
  const redacted = redactSupervisorSecrets(payload, [canary]) as Record<string, unknown>;
  const text = JSON.stringify(redacted);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.equal(text.includes(canary), false);
  assert.equal(Object.prototype.hasOwnProperty.call(redacted, "__proto__"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(redacted, "constructor"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(redacted, "prototype"), false);
  assert.equal(redacted.self, "<cycle>");
  assert.equal(redacted.binary, "<binary-redacted>");
  assert.match(String(redacted.large), /<truncated>$/);
});

test("OpenAI reviewer API key diagnostics distinguish missing present and empty values", () => {
  const missing = reviewerApiKeyState(processEnvFixture());
  assert.equal(missing.usable, false);
  assert.equal(missing.diagnostics.present, false);
  assert.equal(missing.diagnostics.empty, false);
  assert.equal(missing.diagnostics.source, "missing");

  const empty = reviewerApiKeyState(processEnvFixture({ OPENAI_API_KEY: "" }));
  assert.equal(empty.usable, false);
  assert.equal(empty.diagnostics.present, true);
  assert.equal(empty.diagnostics.empty, true);

  const present = reviewerApiKeyState(processEnvFixture({ OPENAI_API_KEY: "test-key-do-not-print" }));
  assert.equal(present.usable, true);
  assert.equal(present.diagnostics.present, true);
  assert.equal(present.diagnostics.empty, false);
  assert.equal(JSON.stringify(present).includes("test-key-do-not-print"), false);
});

test("OpenAI reviewer API key resolver returns exact or case-insensitive values without logging them", () => {
  const exact = resolveReviewerApiKey(processEnvFixture({ OPENAI_API_KEY: "test-key-do-not-print" }));
  assert.equal(exact.usable, true);
  assert.equal(exact.reviewerApiKey, "test-key-do-not-print");
  assert.equal(exact.diagnostics.sourceKey, "OPENAI_API_KEY");

  const caseInsensitive = resolveReviewerApiKey(processEnvFixture({ openai_api_key: "case-key-do-not-print" }));
  assert.equal(caseInsensitive.usable, true);
  assert.equal(caseInsensitive.reviewerApiKey, "case-key-do-not-print");
  assert.equal(caseInsensitive.diagnostics.sourceKey, "openai_api_key");

  const redacted = redactSupervisorSecrets({ exact, caseInsensitive });
  assert.ok(!JSON.stringify(redacted).includes("test-key-do-not-print"));
  assert.ok(!JSON.stringify(redacted).includes("case-key-do-not-print"));
});

test("OpenAI environment trace proves review-only and child env forwarding without exposing the key", () => {
  const env = processEnvFixture({ OPENAI_API_KEY: "test-key-do-not-print" });
  const trace = buildOpenAiEnvironmentTrace({ parentEnv: env, childEnv: env, reviewerEnv: env });
  const text = JSON.stringify(trace);
  assert.equal(text.includes("test-key-do-not-print"), false);
  assert.equal((trace.powershellEnvironment as Record<string, unknown>).present, true);
  assert.equal((trace.childProcessEnvironment as Record<string, unknown>).forwardedToChildProcess, true);
  assert.equal((trace.reviewerEnvironment as Record<string, unknown>).present, true);
  assert.equal(trace.reviewerExpectedVariableName, "OPENAI_API_KEY");
});

test("PowerShell OPENAI_API_KEY is visible inside a spawned Node engineer process without printing the key", { skip: process.platform !== "win32" }, () => {
  const script = "$env:OPENAI_API_KEY='test-key-do-not-print'; node -e \"console.log('present=' + Boolean(process.env.OPENAI_API_KEY)); console.log('empty=' + (process.env.OPENAI_API_KEY === ''))\"";
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /present=true/);
  assert.match(result.stdout, /empty=false/);
  assert.equal(`${result.stdout}${result.stderr}`.includes("test-key-do-not-print"), false);
});

test("PowerShell OPENAI_API_KEY is visible inside npm-launched engineer process without printing the key", { skip: process.platform !== "win32" }, () => {
  const script = [
    "$env:OPENAI_API_KEY='test-key-do-not-print';",
    "npm run engineer -- --status | Out-Null;",
    "node -e \"import('./tools/neven-supervisor/validation-core.mjs').then(m=>{const s=m.resolveReviewerApiKey(process.env); console.log('usable=' + s.usable); console.log('source=' + s.diagnostics.source);})\"",
  ].join(" ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
    cwd: path.resolve("."),
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /usable=true/);
  assert.match(result.stdout, /source=process\.env exact/);
  assert.equal(`${result.stdout}${result.stderr}`.includes("test-key-do-not-print"), false);
});

test("case-insensitive PowerShell-style OpenAI key is diagnosed without changing the canonical reviewer name", () => {
  const state = reviewerApiKeyState(processEnvFixture({ openai_api_key: "test-key-do-not-print" }));
  assert.equal(state.usable, true);
  assert.equal(state.diagnostics.source, "process.env case-insensitive");
  assert.equal(state.diagnostics.sourceKey, "openai_api_key");
});

test("reviewer PASS requires sufficient confidence", () => {
  const low = evaluateReviewGate({ verdict: "PASS", confidence: 0.6 }, { minConfidence: 0.8 });
  assert.equal(low.ok, false);
  assert.equal(low.status, "remediation_required");

  const pass = evaluateReviewGate({ verdict: "PASS", confidence: 0.9 }, { minConfidence: 0.8 });
  assert.equal(pass.ok, true);
});

test("reviewer remediation and blocker verdicts stop completion", () => {
  assert.equal(evaluateReviewGate({ verdict: "REMEDIATION_REQUIRED", confidence: 0.9 }).status, "remediation_required");
  assert.equal(evaluateReviewGate({ verdict: "BLOCKED", confidence: 0.9, blocker_reason: "Need owner decision" }).status, "blocked");
  assert.equal(evaluateReviewGate({ verdict: "PASS_REQUIRES_HUMAN_APPROVAL", confidence: 0.95 }).status, "needs_human_review");
});

test("malformed reviewer response fails closed", () => {
  const result = normaliseReviewerResult({ verdict: "MAYBE", confidence: "not-a-number" });
  assert.equal(result.verdict, "BLOCKED");
  assert.equal(result.confidence, 0);
});

test("bounded evidence excludes sensitive paths and limits content", () => {
  const evidence = buildBoundedEvidence({
    task: "Fix auth",
    agents: "policy",
    gitStatus: "M .env.local\nM src/app/api/auth/route.ts",
    diffStat: "x".repeat(20_000),
    diffNameStatus: "M\t.env.local\nM\tsrc/app/api/auth/route.ts",
    changedFiles: [".env.local", "src/app/api/auth/route.ts"],
    codex: { ok: true, output: "done" },
    validation: { ok: true },
    maxChars: 2000,
  });
  assert.deepEqual(evidence.changedFiles, ["src/app/api/auth/route.ts"]);
  assert.equal(evidence.truncated, true);
});

test("referenced JSON evidence is loaded into the reviewer package with metadata", () => {
  withTempRepo((repo) => {
    const evidencePath = path.join(repo, ".ai-supervisor", "evidence", "bridge-sanitization-remediation.json");
    fs.writeFileSync(evidencePath, `\uFEFF${JSON.stringify({ status: "PASS", canary: "canary-evidence-json-load" })}`, "utf8");

    const evidence = collectReviewEvidenceFiles(repo, {
      taskText: "Review .ai-supervisor/evidence/bridge-sanitization-remediation.json",
    });

    assert.equal(evidence.loadedCount, 1);
    assert.equal(evidence.rejectedCount, 0);
    const loaded = evidence.included[0] as Record<string, unknown>;
    assert.equal(loaded.path, ".ai-supervisor/evidence/bridge-sanitization-remediation.json");
    assert.equal(loaded.format, "json");
    assert.equal(loaded.parseOk, true);
    assert.equal(JSON.stringify(evidence).includes("canary-evidence-json-load"), false);
    assert.match(String(loaded.sha256), /^[a-f0-9]{64}$/);
    assert.equal(evidence.accessManifest.mode, "inlined-redacted-content");
    assert.equal(evidence.accessManifest.repositoryCheckoutAccessRequired, false);
    assert.deepEqual(evidence.accessManifest.artifacts, [
      {
        path: ".ai-supervisor/evidence/bridge-sanitization-remediation.json",
        format: "json",
        parseOk: true,
        sizeBytes: (loaded.sizeBytes as number),
        sha256: loaded.sha256,
        truncated: false,
        contentInlined: true,
      },
    ]);
  });
});

test("filename alone is not treated as evidence content", () => {
  withTempRepo((repo) => {
    fs.writeFileSync(path.join(repo, ".ai-supervisor", "evidence", "bridge-sanitization-remediation.json"), "{}", "utf8");
    const evidence = collectReviewEvidenceFiles(repo, {
      taskText: "Review bridge-sanitization-remediation.json",
    });
    assert.equal(evidence.loadedCount, 0);
    assert.deepEqual(evidence.requested, []);
  });
});

test("review evidence rejects traversal and arbitrary repository files", () => {
  withTempRepo((repo) => {
    fs.mkdirSync(path.join(repo, "src"), { recursive: true });
    fs.writeFileSync(path.join(repo, "src", "secret.json"), "{}", "utf8");
    const evidence = collectReviewEvidenceFiles(repo, {
      explicitReferences: ["../outside.json", "src/secret.json"],
    });
    assert.equal(evidence.loadedCount, 0);
    assert.equal(evidence.rejectedCount, 2);
    assert.match(evidence.rejected.map((item) => item.error).join(" "), /Unsafe path|not allow-listed/);
  });
});

test("review evidence rejects symlink escapes when the platform permits symlinks", () => {
  withTempRepo((repo) => {
    const outside = path.join(os.tmpdir(), `neven-outside-${Date.now()}.json`);
    const link = path.join(repo, ".ai-supervisor", "evidence", "escape.json");
    fs.writeFileSync(outside, "{}", "utf8");
    try {
      try {
        fs.symlinkSync(outside, link, "file");
      } catch {
        return;
      }
      assert.throws(() => resolveReviewEvidencePath(repo, ".ai-supervisor/evidence/escape.json"), /symlink escaped|escaped repository root/);
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });
});

test("oversized and malformed review evidence are bounded and safe", () => {
  withTempRepo((repo) => {
    fs.writeFileSync(path.join(repo, ".ai-supervisor", "evidence", "large.json"), `{"value":"${"x".repeat(1000)}"}`, "utf8");
    fs.writeFileSync(path.join(repo, ".ai-supervisor", "evidence", "bad.json"), "{not-json", "utf8");
    const evidence = collectReviewEvidenceFiles(repo, {
      explicitReferences: [".ai-supervisor/evidence/large.json", ".ai-supervisor/evidence/bad.json"],
    });
    const large = evidence.included.find((item) => item.path === ".ai-supervisor/evidence/large.json") as Record<string, unknown>;
    const bad = evidence.included.find((item) => item.path === ".ai-supervisor/evidence/bad.json") as Record<string, unknown>;
    assert.equal(large?.truncated, false);
    const truncated = loadReviewEvidenceFile(repo, ".ai-supervisor/evidence/large.json", { maxBytes: 100 }) as Record<string, unknown>;
    const direct = resolveReviewEvidencePath(repo, ".ai-supervisor/evidence/large.json");
    assert.equal(direct.sizeBytes > 100, true);
    assert.equal(bad?.parseOk, false);
    assert.match(String(bad?.error), /Malformed JSON/);
    assert.equal(truncated.truncated, true);
    assert.equal(truncated.parseOk, false);
  });
});

test("targeted file diffs include only remediation allow-listed paths", () => {
  const diffs = buildTargetedDiffEvidence({
    paths: [
      "src/lib/runtimeControl.ts",
      "tools/neven-supervisor/validation-core.mjs",
      ".ai-supervisor/actions.log",
      "README.md",
      ".env.local",
    ],
    preExistingStatus: [" M src/lib/runtimeControl.ts", " M README.md"],
    diffProvider: (file) => `diff --git a/${file} b/${file}\n+PGPASSWORD=canary-targeted-diff`,
  });
  assert.deepEqual(
    diffs.map((item) => item.path),
    ["src/lib/runtimeControl.ts", "tools/neven-supervisor/validation-core.mjs"]
  );
  assert.equal(JSON.stringify(diffs).includes("canary-targeted-diff"), false);
  assert.equal(diffs[0].preExistingDirtyStatus, "M");
  assert.equal(diffs[0].secretRedactionApplied, true);
});

test("engineer evidence baseline captures dirty and untracked provenance", () => {
  const baseline = buildEngineerBaseline({
    taskId: "task-1",
    taskObjective: "Bridge evidence task",
    gitStatus: " M tools/neven-supervisor/engineer.mjs\n?? scripts/new-smoke.mjs\n",
    diffNameStatus: "M\ttools/neven-supervisor/engineer.mjs",
    diffStat: "tools/neven-supervisor/engineer.mjs | 4 ++--",
    headSha: "abc123",
    branch: "main",
  });
  assert.equal(baseline.preExistingDirtyCount, 1);
  assert.equal(baseline.preExistingUntrackedCount, 1);
  assert.deepEqual(baseline.preExistingDirtyFiles, ["tools/neven-supervisor/engineer.mjs"]);
});

test("engineer evidence classifies dirty worktree changes against baseline", () => {
  const baseline = buildEngineerBaseline({
    gitStatus: " M tools/neven-supervisor/engineer.mjs\n?? scripts/preexisting.mjs\n",
  });
  const classified = classifyEvidenceFiles({
    baseline,
    currentGitStatus: " M tools/neven-supervisor/engineer.mjs\n M tools/neven-supervisor/validation-core.mjs\n?? scripts/preexisting.mjs\n?? scripts/new-evidence.mjs\n?? .ai-supervisor/evidence/task/manifest.json\n",
    generatedEvidencePaths: [".ai-supervisor/evidence/task"],
  });
  const byPath = new Map(classified.map((item) => [item.path, item.classification]));
  assert.equal(byPath.get("tools/neven-supervisor/engineer.mjs"), "already_dirty_before_task_and_further_modified");
  assert.equal(byPath.get("tools/neven-supervisor/validation-core.mjs"), "newly_modified_by_task");
  assert.equal(byPath.get("scripts/preexisting.mjs"), "pre_existing_untracked");
  assert.equal(byPath.get("scripts/new-evidence.mjs"), "newly_created_by_task");
  assert.equal(byPath.get(".ai-supervisor/evidence/task/manifest.json"), "generated_evidence");
});

test("engineer evidence selects scoped targeted diff files and excludes unrelated assets", () => {
  const files = selectEvidenceDiffFiles({
    task: "Implement engineering bridge evidence",
    classifiedFiles: [
      { path: "tools/neven-supervisor/engineer.mjs", classification: "newly_modified_by_task" },
      { path: "scripts/engineer-sanitization-smoke.mjs", classification: "newly_modified_by_task" },
      { path: "src/app/page.tsx", classification: "newly_modified_by_task" },
      { path: "screenshot/debug.png", classification: "newly_created_by_task" },
    ],
  });
  assert.deepEqual(files, ["tools/neven-supervisor/engineer.mjs", "scripts/engineer-sanitization-smoke.mjs"]);
});

test("engineer evidence extracts named tests and maps acceptance signals", () => {
  const tests = extractNamedTestEvidence([
    {
      command: "npm run test",
      output: "✔ user A dashboard cannot include user B facts (5.5ms)\n✔ scenario state survives restart (9.1ms)\n✔ duplicate idempotent requests return the first result (1.2ms)",
    },
  ]);
  assert.equal(tests.length, 3);
  assert.equal(tests[0].crossUser, true);
  assert.equal(tests[1].restartDurability, true);
  assert.equal(tests[2].idempotency, true);
});

function bridgeValidationFixture(command = "node --test __tests__/lib/nevenValidation.test.ts", ok = true) {
  return [
    {
      command,
      ok,
      output: [
        "✔ engineer evidence package is complete for bridge review (1.1ms)",
        "✔ evidence completeness maps targeted diff and review evidence (1.2ms)",
        "✔ remediation retry resumes without duplicate work (1.3ms)",
        "✔ stale lock handling prevents duplicate-run execution (1.4ms)",
        "✔ redaction sanitizes canary secrets in bridge reports (1.5ms)",
        "✔ reviewer remediation prompt handles review-only tasks (1.6ms)",
        "✔ endpoint smoke evidence is machine-readable and bounded (1.7ms)",
      ].join("\n"),
    },
  ];
}

test("engineering bridge test evidence is canonical and satisfies targeted bridge requirements", () => {
  const validationResults = bridgeValidationFixture();
  const tests = extractNamedTestEvidence(validationResults);
  const bridgeEvidence = buildBridgeTestEvidence({
    tests,
    commandEvidence: validationResults.map((item) => ({
      command: item.command,
      pass: item.ok,
      exitCode: 0,
      durationMs: 100,
    })),
    taskScopes: ["engineering_bridge"],
  });
  assert.equal(bridgeEvidence.requirements.targeted_bridge_tests.satisfied, true);
  assert.equal(bridgeEvidence.counts.executed, 7);
  assert.equal(bridgeEvidence.counts.failed, 0);
  assert.deepEqual(bridgeEvidence.requirements.targeted_bridge_tests.missingSuites, []);
  assert.ok((bridgeEvidence.suites as { acceptanceCriteriaSatisfied: string[] }[]).every((suite) => suite.acceptanceCriteriaSatisfied.includes("targeted_bridge_tests") || suite.acceptanceCriteriaSatisfied.includes("cli_endpoint_smoke")));
});

test("engineering bridge completeness uses canonical bridge evidence", () => {
  const validationResults = bridgeValidationFixture();
  const tests = extractNamedTestEvidence(validationResults);
  const bridgeTestEvidence = buildBridgeTestEvidence({
    tests,
    commandEvidence: validationResults.map((item) => ({ command: item.command, pass: item.ok, exitCode: 0 })),
    taskScopes: ["engineering_bridge"],
  });
  const result = validateEngineerEvidencePackage({
    manifest: { taskId: "bridge-task", taskObjective: "Fix engineering bridge evidence population" },
    baseline: {},
    changedFiles: [],
    targetedDiffs: [{ path: "tools/neven-supervisor/validation-core.mjs" }],
    validationCommands: [{ command: "node --test __tests__/lib/nevenValidation.test.ts" }],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: false },
    tests,
    bridgeTestEvidence,
  });
  assert.equal(result.ok, true);
  assert.ok(!result.missing.includes("TARGETED_BRIDGE_TEST_EVIDENCE_MISSING"));
});

test("engineering bridge completeness fails when a required bridge suite is missing", () => {
  const validationResults = [
    {
      command: "node --test __tests__/lib/nevenValidation.test.ts",
      ok: true,
      output: "✔ engineer evidence package is complete for bridge review (1.1ms)",
    },
  ];
  const tests = extractNamedTestEvidence(validationResults);
  const bridgeTestEvidence = buildBridgeTestEvidence({
    tests,
    commandEvidence: [{ command: validationResults[0].command, pass: true, exitCode: 0 }],
    taskScopes: ["engineering_bridge"],
  });
  const result = validateEngineerEvidencePackage({
    manifest: { taskId: "bridge-task", taskObjective: "Fix engineering bridge evidence population" },
    baseline: {},
    changedFiles: [],
    targetedDiffs: [{ path: "tools/neven-supervisor/validation-core.mjs" }],
    validationCommands: [{ command: "node --test __tests__/lib/nevenValidation.test.ts" }],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: false },
    tests,
    bridgeTestEvidence,
  });
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("TARGETED_BRIDGE_TEST_EVIDENCE_MISSING"));
});

test("engineering bridge completeness fails when a required bridge suite failed", () => {
  const validationResults = bridgeValidationFixture("node --test __tests__/lib/nevenValidation.test.ts", false);
  const tests = extractNamedTestEvidence(validationResults);
  const bridgeTestEvidence = buildBridgeTestEvidence({
    tests,
    commandEvidence: [{ command: validationResults[0].command, pass: false, exitCode: 1 }],
    taskScopes: ["engineering_bridge"],
  });
  const result = validateEngineerEvidencePackage({
    manifest: { taskId: "bridge-task", taskObjective: "Fix engineering bridge evidence population" },
    baseline: {},
    changedFiles: [],
    targetedDiffs: [{ path: "tools/neven-supervisor/validation-core.mjs" }],
    validationCommands: [{ command: "node --test __tests__/lib/nevenValidation.test.ts" }],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: false },
    tests,
    bridgeTestEvidence,
  });
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("TARGETED_BRIDGE_TEST_EVIDENCE_FAILED"));
});

test("engineer evidence builds persistence integrity secret migration and stage gate evidence", () => {
  const classifiedFiles = [
    { path: "src/server/services/coreDecisioningPostgresService.ts", classification: "newly_modified_by_task" },
    { path: "migrations/0005_example.sql", classification: "newly_created_by_task" },
    { path: "__tests__/lib/productionDataIntegrity.test.ts", classification: "newly_modified_by_task" },
  ];
  const validationResults = [{ command: "npm run test", ok: true, output: "✔ cross-user read denial (1ms)\n" }];
  const persistence = buildPersistenceAuditEvidence({ task: "PostgreSQL Phase 2 persistence", classifiedFiles, validationResults });
  const integrity = buildProductionIntegrityEvidence({ classifiedFiles, validationResults });
  const secrets = buildSecretScanEvidence({
    files: ["migrations/0005_example.sql"],
    readFile: () => "CREATE ROLE app PASSWORD '<secret>'; postgres://user:<secret>@example/db",
  });
  const migrations = buildMigrationEvidence({
    classifiedFiles,
    readFile: () => "alter table public.decisions add column example text;",
  });
  const stages = buildStageGateEvidence({
    task: "PostgreSQL Phase 2",
    validation: { ok: true },
    tests: extractNamedTestEvidence(validationResults),
    migrationEvidence: migrations,
  });
  assert.equal(persistence.command, "npm run test");
  assert.equal(integrity.finalStatus, "PASS");
  assert.equal(secrets.pass, true);
  assert.equal(migrations.schemaChanged, true);
  assert.ok(stages.some((stage) => stage.stageName === "Digital Twin"));
});

test("engineer evidence completeness blocks predictable missing review evidence", () => {
  const incomplete = validateEngineerEvidencePackage({
    manifest: { taskId: "task-1", taskObjective: "PostgreSQL Phase 2 user-scoped persistence with trusted identity" },
    baseline: {},
    changedFiles: [],
    targetedDiffs: [],
    validationCommands: [],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: {},
    tests: [],
  });
  assert.equal(incomplete.ok, false);
  assert.ok(incomplete.missing.includes("CROSS_USER_TEST_EVIDENCE_MISSING"));
  assert.ok(incomplete.missing.includes("RESTART_DURABILITY_EVIDENCE_MISSING"));

  const complete = validateEngineerEvidencePackage({
    manifest: { taskId: "task-1", taskObjective: "Bridge evidence task" },
    baseline: {},
    changedFiles: [],
    targetedDiffs: [],
    validationCommands: [],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: {},
    tests: [{ testFile: "__tests__/lib/nevenValidation.test.ts", testName: "bridge evidence task", suiteName: "neven bridge" }],
    bridgeTestEvidence: buildBridgeTestEvidence({
      tests: extractNamedTestEvidence(bridgeValidationFixture()),
      commandEvidence: [{ command: "node --test __tests__/lib/nevenValidation.test.ts", pass: true, exitCode: 0 }],
      taskScopes: ["engineering_bridge"],
    }),
  });
  assert.equal(complete.ok, true);

  const migrationMissingOps = validateEngineerEvidencePackage({
    manifest: { taskId: "task-2", taskObjective: "Add migration" },
    baseline: {},
    changedFiles: [],
    targetedDiffs: [],
    validationCommands: [{ command: "npm run test" }],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: true },
    tests: [],
  });
  assert.equal(migrationMissingOps.ok, false);
  assert.ok(migrationMissingOps.missing.includes("MIGRATION_BOOTSTRAP_EVIDENCE_MISSING"));
  assert.ok(migrationMissingOps.missing.includes("MIGRATION_ROLLBACK_EVIDENCE_MISSING"));
});

test("task-scoped evidence classifies bridge-only work without persistence gates", () => {
  const scopes = classifyTaskScopes({
    task: "Fix task-scoped evidence completeness in the Neven engineering bridge. Do not resume PostgreSQL Phase 2.",
    files: ["tools/neven-supervisor/validation-core.mjs", "__tests__/lib/nevenValidation.test.ts"],
  });
  assert.ok(scopes.includes("engineering_bridge"));
  assert.ok(!scopes.includes("user_scoped_persistence"));
  assert.ok(!scopes.includes("migration"));

  const result = validateEngineerEvidencePackage({
    manifest: { taskId: "bridge-task", taskObjective: "Fix task-scoped evidence completeness in the Neven engineering bridge. Do not resume PostgreSQL Phase 2." },
    baseline: {},
    changedFiles: [],
    targetedDiffs: [{ path: "tools/neven-supervisor/validation-core.mjs" }],
    validationCommands: [],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: false },
    tests: [{ testFile: "__tests__/lib/nevenValidation.test.ts", testName: "bridge evidence completeness", suiteName: "neven bridge" }],
    bridgeTestEvidence: buildBridgeTestEvidence({
      tests: extractNamedTestEvidence(bridgeValidationFixture()),
      commandEvidence: [{ command: "node --test __tests__/lib/nevenValidation.test.ts", pass: true, exitCode: 0 }],
      taskScopes: ["engineering_bridge"],
    }),
  });
  assert.equal(result.ok, true);
  assert.ok(!result.missing.includes("CROSS_USER_TEST_EVIDENCE_MISSING"));
  assert.ok(!result.missing.includes("RESTART_DURABILITY_EVIDENCE_MISSING"));
  const notApplicable = (result.evidenceRequirements.notApplicable as { id: string }[]).map((item) => item.id);
  assert.ok(notApplicable.includes("cross_user_tests"));
  assert.ok(notApplicable.includes("restart_durability_tests"));
});

test("task-scoped evidence requires cross-user and restart only for user-scoped persistence", () => {
  const result = validateEngineerEvidencePackage({
    manifest: { taskId: "persist-task", taskObjective: "Convert Financial Vault PostgreSQL persistence with trusted identity and restart durability" },
    baseline: {},
    changedFiles: [],
    targetedDiffs: [{ path: "src/server/services/financialVaultPostgresService.ts" }],
    validationCommands: [],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: false },
    tests: [],
  });
  assert.equal(result.ok, false);
  assert.ok(result.taskScopes.includes("user_scoped_persistence"));
  assert.ok(result.missing.includes("CROSS_USER_TEST_EVIDENCE_MISSING"));
  assert.ok(result.missing.includes("RESTART_DURABILITY_EVIDENCE_MISSING"));
});

test("task-scoped evidence migration requirements depend on migration scope", () => {
  const result = validateEngineerEvidencePackage({
    manifest: { taskId: "migration-task", taskObjective: "Add schema migration for goals persistence" },
    baseline: {},
    changedFiles: [],
    targetedDiffs: [{ path: "migrations/0006_goals.sql" }],
    validationCommands: [{ command: "npm run test" }],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: true },
    tests: [{ testFile: "__tests__/lib/coreDecisioningPersistenceMigration.test.ts", testName: "migration static test" }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("MIGRATION_BOOTSTRAP_EVIDENCE_MISSING"));
  assert.ok(result.missing.includes("MIGRATION_ROLLBACK_EVIDENCE_MISSING"));
});

test("review-only explicit migration evidence satisfies bootstrap and rollback gates", () => {
  const result = validateEngineerEvidencePackage({
    manifest: { taskId: "migration-review", taskObjective: "Review migration with bootstrap and rollback evidence" },
    baseline: {},
    changedFiles: [],
    targetedDiffs: [{ path: "migrations/0008_private_beta_access_rls_hardening.sql" }],
    validationCommands: [{ command: "npm run test" }],
    explicitReviewEvidenceSummary: {
      loadedCount: 1,
      rejectedCount: 0,
      files: [".ai-supervisor/evidence/private-beta-reviewer-package.json"],
      validationCommands: [
        { command: "npm run postgres:pilot:bootstrap", pass: true },
        { command: "npm run postgres:pilot:rollback-check", pass: true },
      ],
    },
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: true },
    tests: [{ testFile: "__tests__/lib/privateBetaAccessApproval.test.ts", testName: "migration static test" }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.missing.includes("MIGRATION_BOOTSTRAP_EVIDENCE_MISSING"), false);
  assert.equal(result.missing.includes("MIGRATION_ROLLBACK_EVIDENCE_MISSING"), false);
});

test("task-scoped evidence documentation-only work does not require persistence evidence", () => {
  const scopes = classifyTaskScopes({
    task: "Update documentation for the engineering supervisor",
    files: ["docs/ENGINEERING_SUPERVISOR.md", "README_AUTOMATION.md"],
  });
  assert.deepEqual(new Set(scopes), new Set(["documentation"]));
  const requirements = buildEvidenceRequirements({ scopes, task: "Update documentation for the engineering supervisor" });
  assert.ok((requirements.notApplicable as { id: string }[]).some((item) => item.id === "cross_user_tests"));
  assert.ok((requirements.notApplicable as { id: string }[]).some((item) => item.id === "restart_durability_tests"));
});

test("VIREON_SUPER_BIG_BANG is classified as a product program, not engineering bridge", () => {
  const scopes = classifyTaskScopes({
    task: [
      "VIREON_SUPER_BIG_BANG: Complete Vireon product persistence.",
      "The Neven Engineering Bridge must own evidence, review, AGENTS.md policy and supervisor reporting.",
    ].join("\n"),
    stage: "Current-state audit and completion matrix",
    files: ["docs/PERSISTENCE_AUDIT.md", "src/server/services/applicationPersistenceAudit.ts"],
  });
  assert.ok(scopes.includes("product_completion"));
  assert.ok(!scopes.includes("engineering_bridge"));
});

test("bridge policy text inside product program does not trigger engineering bridge scope", () => {
  const scopes = classifyTaskScopes({
    task: [
      "Vireon Super Big Bang Completion Program",
      "Use the existing reviewer, evidence generation, AGENTS.md and supervisor policy gates.",
    ].join("\n"),
    stage: "Digital Twin persistence",
    files: ["src/app/api/digital-twin/route.ts", "src/app/components/DigitalTwinClient.tsx"],
  });
  assert.ok(scopes.includes("product_completion"));
  assert.ok(scopes.includes("user_scoped_persistence"));
  assert.ok(scopes.includes("API"));
  assert.ok(scopes.includes("UI"));
  assert.ok(!scopes.includes("engineering_bridge"));
});

test("product-mode final review wording does not trigger engineering bridge scope", () => {
  const scopes = classifyTaskScopes({
    task: [
      "Review the completed Vireon product-mode Stage 1-10 work from the current repository state.",
      "Evaluate validation, PostgreSQL pilot bootstrap and rollback, route authorization audit, secret scan, private-beta gates, and the six-domain PostgreSQL core persistence status.",
    ].join("\n"),
    files: ["tools/neven-supervisor/engineer.mjs", "tools/neven-supervisor/validation-core.mjs"],
  });
  assert.ok(scopes.includes("product_completion"));
  assert.ok(!scopes.includes("engineering_bridge"));
});

test("VIREON_POLISH_PROGRAM review evidence wording does not trigger engineering bridge scope", () => {
  const scopes = classifyTaskScopes({
    task: [
      "Review VIREON_POLISH_PROGRAM P9 Full Consistency Audit only.",
      "Evaluate the provided bounded P9 evidence for terminology, formatting, browser smoke, validation, task-scoped secret scan, and dirty-worktree provenance.",
      "Return PASS, REMEDIATION_REQUIRED, BLOCKED, or PASS_REQUIRES_HUMAN_APPROVAL.",
    ].join("\n"),
    files: ["src/app/components/OverviewV3.tsx", "src/app/page.tsx", "__tests__/lib/rcUxFailureStates.test.ts"],
  });
  assert.ok(scopes.includes("product_completion"));
  assert.ok(scopes.includes("UI"));
  assert.ok(scopes.includes("security"));
  assert.ok(!scopes.includes("engineering_bridge"));
  assert.ok(!scopes.includes("user_scoped_persistence"));
});

test("release-candidate Stage 1 baseline review is a product audit gate, not bridge work", () => {
  const task = [
    "Review VIREON_RELEASE_CANDIDATE_AND_PRIVATE_BETA Stage 1 only.",
    "The completed Super Big Bang Stage 10 PASS confidence 0.84 is the frozen accepted baseline and must not be reopened.",
    "Evaluate the RC1 manifest, dirty-worktree provenance, frozen baseline evidence references, login/auth-cookie release-candidate classification, excluded scope, human approval gates, and Stage 1 no-code baseline capture.",
    "Do not require migration, cross-user, restart, UI, API, or product behavior validation for Stage 1 because no product behavior changed in this stage.",
  ].join("\n");
  const scopes = classifyTaskScopes({
    task,
    files: ["tools/neven-supervisor/validation-core.mjs", "src/app/login/page.tsx"],
  });
  assert.ok(scopes.includes("product_completion"));
  assert.ok(!scopes.includes("engineering_bridge"));

  const result = validateEngineerEvidencePackage({
    manifest: {
      taskId: "rc1-stage-1",
      taskObjective: task,
    },
    baseline: {},
    changedFiles: [],
    targetedDiffs: [],
    validationCommands: [{ command: "npm run typecheck" }],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: false },
    tests: [],
  });
  assert.ok(!result.missing.includes("TARGETED_BRIDGE_TEST_EVIDENCE_MISSING"));
  assert.ok(!result.missing.includes("CROSS_USER_TEST_EVIDENCE_MISSING"));
  assert.ok(!result.missing.includes("RESTART_DURABILITY_EVIDENCE_MISSING"));
  assert.ok(!result.missing.includes("MIGRATION_BOOTSTRAP_EVIDENCE_MISSING"));
  assert.ok(!result.missing.includes("MIGRATION_ROLLBACK_EVIDENCE_MISSING"));
});

test("private-beta activation hardening review is product-scoped, not engineering bridge", () => {
  const task = [
    "Review Vireon private-beta activation hardening evidence only.",
    "Use Neven reviewer evidence, AGENTS.md policy and bounded evidence package metadata.",
    "Evaluate security hardening, financial forecast route hardening, durable export/deletion lifecycle, migration 0009, PostgreSQL operator preflight, bootstrap and rollback evidence.",
  ].join("\n");
  const dirtyFiles = [
    { path: "tools/neven-supervisor/engineer.mjs", classification: "already_dirty_before_task_and_further_modified" },
    { path: "tools/neven-supervisor/validation-core.mjs", classification: "already_dirty_before_task_and_further_modified" },
    { path: "__tests__/lib/nevenValidation.test.ts", classification: "already_dirty_before_task_and_further_modified" },
    { path: ".ai-supervisor/evidence/vireon-private-beta-activation-hardening-summary.md", classification: "generated_evidence" },
    { path: "src/app/api/financial-forecast/route.ts", classification: "newly_modified_by_this_task" },
    { path: "src/app/api/private-beta/export/route.ts", classification: "newly_modified_by_this_task" },
    { path: "src/app/api/private-beta/account-deletion/route.ts", classification: "newly_modified_by_this_task" },
    { path: "migrations/0009_private_beta_activation_lifecycle.sql", classification: "newly_created_by_this_task" },
  ];

  const selected = selectEvidenceDiffFiles({ classifiedFiles: dirtyFiles, task, maxFiles: 20 });
  const selectedPaths = selected.filter((file): file is string => typeof file === "string");
  assert.ok(!selectedPaths.some((file) => file.startsWith("tools/neven-supervisor/")));
  assert.ok(!selectedPaths.some((file) => file.includes("nevenValidation")));
  assert.ok(selectedPaths.includes("src/app/api/financial-forecast/route.ts"));
  assert.ok(selectedPaths.includes("src/app/api/private-beta/export/route.ts"));
  assert.ok(selectedPaths.includes("migrations/0009_private_beta_activation_lifecycle.sql"));

  const scopes = classifyTaskScopes({ task, files: selectedPaths });
  assert.ok(scopes.includes("product_completion"));
  assert.ok(scopes.includes("persistence"));
  assert.ok(scopes.includes("user_scoped_persistence"));
  assert.ok(scopes.includes("migration"));
  assert.ok(scopes.includes("API"));
  assert.ok(scopes.includes("security"));
  assert.ok(scopes.includes("background_jobs"));
  assert.ok(scopes.includes("export_lifecycle"));
  assert.ok(scopes.includes("deletion_lifecycle"));
  assert.ok(scopes.includes("operations"));
  assert.ok(!scopes.includes("engineering_bridge"));

  const requirements = buildEvidenceRequirements({
    scopes,
    task,
    migrations: { schemaChanged: true },
  });
  const required = (requirements.required as { id: string }[]).map((item) => item.id);
  assert.ok(!required.includes("targeted_bridge_tests"));
});

test("private-beta activation hardening review-only package does not require bridge tests", () => {
  const task = "Review Vireon private-beta activation hardening evidence only. Implementation is already complete; review-only mode must evaluate product evidence.";
  const result = validateEngineerEvidencePackage({
    manifest: {
      taskId: "private-beta-activation-hardening-review",
      taskObjective: task,
      reviewOnly: true,
    },
    baseline: {},
    changedFiles: [
      { path: "tools/neven-supervisor/validation-core.mjs", classification: "already_dirty_before_task_and_further_modified" },
      { path: "src/app/api/private-beta/export/route.ts", classification: "newly_modified_by_this_task" },
    ],
    targetedDiffs: [
      { path: "src/app/api/private-beta/export/route.ts", diff: "bounded product diff", truncated: false },
      { path: "migrations/0009_private_beta_activation_lifecycle.sql", diff: "bounded migration diff", truncated: false },
    ],
    validationCommands: [
      { command: "npm run test" },
      { command: "npm run typecheck" },
      { command: "npm run postgres:pilot:bootstrap" },
      { command: "npm run postgres:pilot:rollback-check" },
    ],
    explicitReviewEvidenceSummary: {
      loadedCount: 1,
      rejectedCount: 0,
      files: [".ai-supervisor/evidence/vireon-private-beta-activation-hardening-summary.md"],
      validationCommands: [
        { command: "npm run postgres:pilot:bootstrap", pass: true },
        { command: "npm run postgres:pilot:rollback-check", pass: true },
      ],
    },
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: true },
    tests: [
      { testFile: "__tests__/lib/privateBetaLifecyclePostgresService.test.ts", testName: "cross-user access is denied", crossUser: true, passed: true },
      { testFile: "__tests__/lib/privateBetaLifecyclePostgresService.test.ts", testName: "state reloads after service restart", restartDurability: true, passed: true },
    ],
  });
  assert.ok(!result.taskScopes.includes("engineering_bridge"));
  assert.ok(!result.missing.includes("TARGETED_BRIDGE_TEST_EVIDENCE_MISSING"));
});

test("actual evidence classifier remediation still triggers engineering bridge scope", () => {
  const task = "Fix the Neven evidence classifier defect in tools/neven-supervisor/validation-core.mjs";
  const scopes = classifyTaskScopes({
    task,
    files: ["tools/neven-supervisor/validation-core.mjs", "__tests__/lib/nevenValidation.test.ts"],
  });
  assert.ok(scopes.includes("engineering_bridge"));
});

test("mixed product hardening plus explicit bridge fix combines scopes", () => {
  const task = "Private-beta activation hardening plus fix Neven evidence classifier defect.";
  const scopes = classifyTaskScopes({
    task,
    files: ["src/app/api/private-beta/export/route.ts", "tools/neven-supervisor/validation-core.mjs"],
  });
  assert.ok(scopes.includes("product_completion"));
  assert.ok(scopes.includes("engineering_bridge"));
  assert.ok(scopes.includes("API"));
});

test("actual supervisor implementation work triggers engineering bridge scope", () => {
  const scopes = classifyTaskScopes({
    task: "Fix Neven engineering bridge review evidence serialization",
    files: ["tools/neven-supervisor/validation-core.mjs", "__tests__/lib/nevenValidation.test.ts"],
  });
  assert.ok(scopes.includes("engineering_bridge"));
});

test("unrelated dirty bridge files do not expand Big Bang product task scope", () => {
  const scopes = classifyTaskScopes({
    task: "VIREON_SUPER_BIG_BANG: Restart the product completion program from the current repository state.",
    stage: "Current-state audit and completion matrix",
    files: ["tools/neven-supervisor/engineer.mjs", "tools/neven-supervisor/validation-core.mjs"],
  });
  assert.ok(scopes.includes("product_completion"));
  assert.ok(!scopes.includes("engineering_bridge"));
});

test("Big Bang evidence requirements use current stage scope only", () => {
  const stageOneScopes = classifyTaskScopes({
    task: "VIREON_SUPER_BIG_BANG: complete the full product program with PostgreSQL, APIs, UI, migrations and security gates.",
    stage: "Current-state audit and completion matrix",
    files: ["docs/PERSISTENCE_AUDIT.md", "docs/API_PERSISTENCE_MATRIX.md"],
  });
  assert.ok(stageOneScopes.includes("product_completion"));
  assert.ok(!stageOneScopes.includes("migration"));
  assert.ok(!stageOneScopes.includes("user_scoped_persistence"));
  const stageOneRequirements = buildEvidenceRequirements({ scopes: stageOneScopes, task: "VIREON_SUPER_BIG_BANG", migrations: { schemaChanged: false }, stage: "Current-state audit and completion matrix" });
  assert.ok((stageOneRequirements.notApplicable as { id: string }[]).some((item) => item.id === "migration_bootstrap"));
  assert.ok((stageOneRequirements.notApplicable as { id: string }[]).some((item) => item.id === "cross_user_tests"));

  const stageTwoScopes = classifyTaskScopes({
    task: "VIREON_SUPER_BIG_BANG: complete the full product program with PostgreSQL, APIs, UI, migrations and security gates.",
    stage: "PostgreSQL schema and migration completion",
    files: ["migrations/0006_core_domains.sql"],
  });
  assert.ok(stageTwoScopes.includes("product_completion"));
  assert.ok(stageTwoScopes.includes("migration"));
  const stageTwoRequirements = buildEvidenceRequirements({ scopes: stageTwoScopes, task: "VIREON_SUPER_BIG_BANG", migrations: { schemaChanged: true }, stage: "PostgreSQL schema and migration completion" });
  assert.ok((stageTwoRequirements.required as { id: string }[]).some((item) => item.id === "migration_bootstrap"));
  assert.ok((stageTwoRequirements.required as { id: string }[]).some((item) => item.id === "migration_rollback"));
});

test("Release Candidate Stage 3 UX-only rereview does not require persistence evidence", () => {
  const task =
    "Rereview VIREON_RELEASE_CANDIDATE_AND_PRIVATE_BETA Stage 3 UX and Failure-State Hardening after remediation only. Use attached bounded evidence. Action Workflows thrown fetch/JSON/network failure handling is included.";
  const files = [
    "src/app/components/PrivateBetaFoundationClient.tsx",
    "src/app/components/ActionWorkflowsClient.tsx",
    "src/app/components/AiCfoClient.tsx",
    "src/app/components/ForecastTimelineClient.tsx",
    "__tests__/lib/rcUxFailureStates.test.ts",
  ];
  const scopes = classifyTaskScopes({ task, files });
  assert.ok(scopes.includes("product_completion"));
  assert.ok(scopes.includes("UI"));
  assert.ok(!scopes.includes("persistence"));
  assert.ok(!scopes.includes("user_scoped_persistence"));
  assert.ok(!scopes.includes("engineering_bridge"));

  const result = validateEngineerEvidencePackage({
    manifest: {
      taskId: "rc-stage-3-rereview",
      taskObjective: task,
    },
    baseline: {},
    changedFiles: files,
    targetedDiffs: files.map((file) => ({ path: file, diff: "bounded excerpt", truncated: false })),
    validationCommands: [
      { command: "node --test __tests__/lib/rcUxFailureStates.test.ts" },
      { command: "npm run typecheck" },
      { command: "npx playwright test tests/private-beta-foundation.spec.ts tests/manual-financial-data.spec.ts tests/goals-planning.spec.ts tests/financial-forecasting.spec.ts --project=chromium" },
    ],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: false },
    tests: [
      { testName: "rc UX failure states", passed: true },
      { testName: "critical browser journeys", passed: true },
    ],
  });
  assert.ok(!result.missing.includes("CROSS_USER_TEST_EVIDENCE_MISSING"));
  assert.ok(!result.missing.includes("RESTART_DURABILITY_EVIDENCE_MISSING"));
  assert.ok(!result.missing.includes("MIGRATION_BOOTSTRAP_EVIDENCE_MISSING"));
  assert.ok(!result.missing.includes("MIGRATION_ROLLBACK_EVIDENCE_MISSING"));
  assert.equal(result.evidenceRequirements.stage, "UX and failure-state hardening");
  assert.equal(result.evidenceRequirements.stageKind, "ui");
});

test("Stage 1 audit completeness does not require bootstrap rollback cross-user or restart evidence", () => {
  const result = validateEngineerEvidencePackage({
    manifest: {
      taskId: "big-bang-stage-1",
      taskObjective: "VIREON_SUPER_BIG_BANG: current-state audit for a program that later includes migrations, APIs, UI and security.",
      currentStage: "Current-state audit and completion matrix",
    },
    taskScopes: ["product_completion", "user_scoped_persistence", "migration", "API", "UI", "security"],
    baseline: {},
    changedFiles: [],
    targetedDiffs: [],
    validationCommands: [{ command: "npm run typecheck" }],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: true },
    tests: [],
  });
  assert.ok(!result.missing.includes("MIGRATION_BOOTSTRAP_EVIDENCE_MISSING"));
  assert.ok(!result.missing.includes("MIGRATION_ROLLBACK_EVIDENCE_MISSING"));
  assert.ok(!result.missing.includes("CROSS_USER_TEST_EVIDENCE_MISSING"));
  assert.ok(!result.missing.includes("RESTART_DURABILITY_EVIDENCE_MISSING"));

  const explicitLaunch = validateEngineerEvidencePackage({
    manifest: {
      taskId: "big-bang-explicit-stage-1",
      taskObjective: "VIREON_SUPER_BIG_BANG: Restart from Stage 1 current-state audit and completion matrix. Do not perform schema changes in Stage 1.",
    },
    baseline: {},
    changedFiles: [],
    targetedDiffs: [],
    validationCommands: [{ command: "npm run typecheck" }],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: false },
    tests: [],
  });
  assert.ok(!explicitLaunch.taskScopes.includes("migration"));
  assert.ok(!explicitLaunch.missing.includes("MIGRATION_BOOTSTRAP_EVIDENCE_MISSING"));
  assert.ok(!explicitLaunch.missing.includes("MIGRATION_ROLLBACK_EVIDENCE_MISSING"));
  assert.ok(!explicitLaunch.missing.includes("CROSS_USER_TEST_EVIDENCE_MISSING"));
  assert.ok(!explicitLaunch.missing.includes("RESTART_DURABILITY_EVIDENCE_MISSING"));
});

test("Stage 2 migration completeness requires bootstrap and rollback only when schema changes", () => {
  const unchanged = validateEngineerEvidencePackage({
    manifest: { taskId: "big-bang-stage-2-unchanged", taskObjective: "VIREON_SUPER_BIG_BANG", currentStage: "PostgreSQL schema and migration completion" },
    taskScopes: ["product_completion", "migration"],
    baseline: {},
    changedFiles: [],
    targetedDiffs: [],
    validationCommands: [{ command: "npm run test" }],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: false },
    tests: [],
  });
  assert.ok(!unchanged.missing.includes("MIGRATION_BOOTSTRAP_EVIDENCE_MISSING"));
  assert.ok(!unchanged.missing.includes("MIGRATION_ROLLBACK_EVIDENCE_MISSING"));

  const changed = validateEngineerEvidencePackage({
    manifest: { taskId: "big-bang-stage-2-changed", taskObjective: "VIREON_SUPER_BIG_BANG", currentStage: "PostgreSQL schema and migration completion" },
    taskScopes: ["product_completion", "migration"],
    baseline: {},
    changedFiles: [],
    targetedDiffs: [],
    validationCommands: [{ command: "npm run test" }],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: true },
    tests: [],
  });
  assert.ok(changed.missing.includes("MIGRATION_BOOTSTRAP_EVIDENCE_MISSING"));
  assert.ok(changed.missing.includes("MIGRATION_ROLLBACK_EVIDENCE_MISSING"));
});

test("Persistence stage without schema changes does not require bootstrap but still requires isolation and restart evidence", () => {
  const result = validateEngineerEvidencePackage({
    manifest: { taskId: "big-bang-digital-twin", taskObjective: "VIREON_SUPER_BIG_BANG", currentStage: "Digital Twin persistence" },
    taskScopes: ["product_completion", "user_scoped_persistence"],
    baseline: {},
    changedFiles: [],
    targetedDiffs: [],
    validationCommands: [{ command: "npm run test" }],
    persistenceAudit: {},
    integrity: {},
    securityScan: {},
    migrations: { schemaChanged: false },
    tests: [],
  });
  assert.ok(!result.missing.includes("MIGRATION_BOOTSTRAP_EVIDENCE_MISSING"));
  assert.ok(!result.missing.includes("MIGRATION_ROLLBACK_EVIDENCE_MISSING"));
  assert.ok(result.missing.includes("CROSS_USER_TEST_EVIDENCE_MISSING"));
  assert.ok(result.missing.includes("RESTART_DURABILITY_EVIDENCE_MISSING"));
});

test("task-scoped evidence combines mixed explicit requirements", () => {
  const scopes = classifyTaskScopes({
    task: "Convert Goals API persistence and verify cross-user restart durability",
    files: ["src/app/api/goals/route.ts", "src/server/services/coreDecisioningPostgresService.ts"],
  });
  assert.ok(scopes.includes("API"));
  assert.ok(scopes.includes("user_scoped_persistence"));
  const requirements = buildEvidenceRequirements({
    scopes,
    task: "Convert Goals API persistence and verify cross-user restart durability",
  });
  const required = (requirements.required as { id: string }[]).map((item) => item.id);
  assert.ok(required.includes("api_smoke"));
  assert.ok(required.includes("cross_user_tests"));
  assert.ok(required.includes("restart_durability_tests"));
});

test("task-scoped evidence ignores unrelated dirty files for scope expansion", () => {
  const scopes = classifyTaskScopes({
    task: "Fix Neven bridge evidence validation",
    files: ["tools/neven-supervisor/validation-core.mjs"],
  });
  assert.ok(scopes.includes("engineering_bridge"));
  assert.ok(!scopes.includes("UI"));
  assert.ok(!scopes.includes("user_scoped_persistence"));
});

test("task-scoped evidence explicit acceptance criteria can add requirements", () => {
  const requirements = buildEvidenceRequirements({
    scopes: ["engineering_bridge"],
    task: "Bridge evidence update",
    acceptanceCriteria: ["Include cross-user evidence if this task says cross-user explicitly", "Show restart-durability proof"],
  });
  const required = (requirements.required as { id: string }[]).map((item) => item.id);
  assert.ok(required.includes("cross_user_tests"));
  assert.ok(required.includes("restart_durability_tests"));
});

test("endpoint smoke evidence is machine-readable and bounded", () => {
  const smoke = buildEndpointSmokeEvidence({
    classifiedFiles: [
      { path: "src/app/api/digital-twin/route.ts" },
      { path: "src/app/components/DigitalTwinClient.tsx" },
      { path: "tools/neven-supervisor/engineer.mjs" },
    ],
  });
  assert.equal(smoke.length, 2);
  assert.equal(smoke[0].noSecretLeak, true);
});

test("review-only evidence package can represent completed remediation evidence", () => {
  withTempRepo((repo) => {
    const evidencePath = path.join(repo, ".ai-supervisor", "evidence", "bridge-sanitization-remediation.json");
    fs.writeFileSync(
      evidencePath,
      JSON.stringify({
        fullValidation: { test: "PASS" },
        dirtyWorktreeProvenance: { remediationFiles: ["src/lib/runtimeControl.ts"] },
      }),
      "utf8"
    );
    const explicitReviewEvidence = collectReviewEvidenceFiles(repo, {
      explicitReferences: [".ai-supervisor/evidence/bridge-sanitization-remediation.json"],
    });
    const reviewOnly = {
      implementationSkipped: true,
      implementationAlreadyExists: explicitReviewEvidence.loadedCount > 0,
      evidenceFilesLoaded: explicitReviewEvidence.included.map((item) => item.path),
      evidenceFilesRejected: explicitReviewEvidence.rejected,
    };
    assert.equal(reviewOnly.implementationSkipped, true);
    assert.equal(reviewOnly.implementationAlreadyExists, true);
    assert.deepEqual(reviewOnly.evidenceFilesLoaded, [".ai-supervisor/evidence/bridge-sanitization-remediation.json"]);
    assert.equal(explicitReviewEvidence.accessManifest.artifacts[0]?.contentInlined, true);
    assert.equal(explicitReviewEvidence.accessManifest.repositoryCheckoutAccessRequired, false);
  });
});

test("reviewer prompt includes explicit evidence alongside automatic evidence", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "tools", "neven-supervisor", "engineer.mjs"), "utf8");
  assert.match(source, /subjectUnderReview: "explicitReviewEvidence"/);
  assert.match(source, /wrapperEvidenceContext/);
  assert.match(source, /Automatic evidence below describes this review-only wrapper invocation/);
  assert.match(source, /sizeBytes: item\.sizeBytes/);
  assert.match(source, /parseOk: item\.parseOk/);
  assert.match(source, /content: item\.content/);
  assert.equal(source.includes("redactSupervisorSecrets(evidence?.automaticEvidence?.reviewerInput ?? evidence)"), false);
});

test("remediation prompt is bounded and tells Codex not to redo passing work", () => {
  const prompt = buildRemediationPrompt({
    originalTask: "Convert a route",
    review: {
      verdict: "REMEDIATION_REQUIRED",
      acceptance_criteria_results: ["FAIL: route still uses local fallback"],
      required_remediation: ["Replace fallback with PostgreSQL error."],
    },
    validation: { ok: true },
  });
  assert.match(prompt, /Do not expand scope/);
  assert.match(prompt, /Do not redo passing work/);
  assert.match(prompt, /Replace fallback/);
});

test("reviewer remediation task uses structured findings and targeted validation", () => {
  const task = buildReviewerRemediationTask({
    originalTask: "Fix bridge review loop",
    review: {
      verdict: "REMEDIATION_REQUIRED",
      confidence: 0.91,
      acceptance_criteria_results: ["FAIL: review-only remediation is manual"],
      required_remediation: ["Launch Codex automatically after reviewer remediation."],
      missing_evidence: ["No targeted validation evidence."],
      architecture_findings: ["Bridge loop stops after review-only mode."],
      security_findings: ["Ensure destructive operations still require human approval."],
    },
    evidence: { changedFiles: ["tools/neven-supervisor/engineer.mjs"] },
    validation: { ok: true },
  });

  assert.equal(task.title, "Reviewer remediation");
  assert.deepEqual(task.targetedValidationCommands, ["npm run typecheck", "npm run test"]);
  assert.match(task.prompt, /Launch Codex automatically/);
  assert.match(task.prompt, /No targeted validation evidence/);
  assert.match(task.prompt, /Bridge loop stops/);
  assert.match(task.prompt, /destructive operations still require human approval/);
});

test("reviewer remediation task redacts secrets before persistence or prompts", () => {
  const task = buildReviewerRemediationTask({
    originalTask: "Fix secret leak canary-review-loop",
    review: {
      verdict: "REMEDIATION_REQUIRED",
      required_remediation: ["Do not leak postgres://user:secret-pass@example.test/db"],
      missing_evidence: ["PGPASSWORD=secret-pass appeared in report"],
      architecture_findings: ["Bearer abcdefghijklmnopqrstuvwxyz leaked"],
      security_findings: ["CREATE ROLE vireon_app PASSWORD 'secret-pass';"],
    },
  });
  const text = JSON.stringify(task);
  assert.doesNotMatch(text, /canary-review-loop/);
  assert.doesNotMatch(text, /secret-pass/);
  assert.doesNotMatch(text, /abcdefghijklmnopqrstuvwxyz/);
  assert.match(text, /<redacted>/);
});

test("secret-scan evidence preserves non-sensitive liveSecret booleans", () => {
  const redacted = redactSupervisorSecrets({
    findings: [
      { path: "src/example.ts", liveSecret: false, password: "secret-pass" },
      { path: "src/example2.ts", liveSecret: true, apiKey: "sk-test-secret-canary" },
    ],
  });

  assert.equal(redacted.findings[0].liveSecret, false);
  assert.equal(redacted.findings[1].liveSecret, true);
  assert.equal(redacted.findings[0].password, "<redacted>");
  assert.equal(redacted.findings[1].apiKey, "<redacted>");
});

test("remediation validation command selection remains allow-listed and scoped", () => {
  assert.deepEqual(
    selectRemediationValidationCommands({
      review: { validation_findings: ["Build artifact failed"] },
      changedFiles: ["package.json"],
    }),
    ["npm run typecheck", "npm run test", "npm run build"]
  );
  assert.deepEqual(
    selectRemediationValidationCommands({
      review: { required_remediation: ["Fix eslint error"] },
    }),
    ["npm run lint", "npm run typecheck", "npm run test"]
  );
});

test("review-only mode skips only the initial evidence review, not remediation", () => {
  assert.equal(shouldSkipInitialReviewOnlyImplementation({ reviewOnly: true }), true);
  assert.equal(
    shouldSkipInitialReviewOnlyImplementation({
      reviewOnly: true,
      activeRemediationTask: { title: "Reviewer remediation" },
    }),
    false
  );
  assert.equal(
    shouldSkipInitialReviewOnlyImplementation({
      reviewOnly: true,
      guidance: "Reviewer remediation brief",
    }),
    false
  );
  assert.equal(shouldSkipInitialReviewOnlyImplementation({ reviewOnly: false }), false);
});

test("validated memory is created only with evidence", () => {
  assert.equal(createMemoryEntry({ title: "Speculative", evidenceLevel: "observed" }), null);
  const entry = createMemoryEntry({
    title: "Rollback fix",
    problem: "restore failed",
    resolution: "preserve schema_migrations",
    confidence: 0.9,
    evidenceLevel: "validated",
    affectedFilesOrDomains: ["scripts/postgres-pilot-rollback-check.mjs"],
  });
  assert.equal(entry.status, "active");
  assert.equal(entry.confidence, 0.9);
});

test("memory retrieval excludes superseded rejected and low-confidence entries", () => {
  const entries = [
    createMemoryEntry({ id: "a", title: "Postgres rollback", resolution: "Use public schema", confidence: 0.9, evidenceLevel: "validated" }),
    { id: "b", status: "superseded", title: "Postgres rollback old", confidence: 1 },
    { id: "c", status: "active", title: "Postgres rollback weak", confidence: 0.1 },
  ].filter(Boolean);
  const found = retrieveRelevantMemories(entries, "postgres rollback", { minConfidence: 0.5 });
  assert.deepEqual(found.map((entry) => entry.id), ["a"]);
});

test("program manifest selects the next pending stage", () => {
  assert.equal(
    selectNextProgramTask({ stage_order: ["Digital Twin", "Decision Centre"], completed_stages: ["Digital Twin"] }),
    "Decision Centre"
  );
  assert.equal(selectNextProgramTask({ stage_order: ["A"], completed_stages: ["A"] }), null);
});

test("human review triggers for high-risk changes", () => {
  assert.equal(shouldRequireHumanReview({ task: "Change RLS policy" }), true);
  assert.equal(shouldRequireHumanReview({ task: "Rename dashboard label" }), false);
  assert.equal(shouldRequireHumanReview({ configured: true, task: "Rename dashboard label" }), true);
});

test("safety helpers reject path traversal and non-allowlisted commands", () => {
  assert.equal(validateSafeRelativePath("src/app/page.tsx"), "src/app/page.tsx");
  assert.throws(() => validateSafeRelativePath("../.env"), /Unsafe path/);
  assert.equal(assertAllowedEngineerCommand("npm run lint"), true);
  assert.throws(() => assertAllowedEngineerCommand("git push"), /not allow-listed/);
});
