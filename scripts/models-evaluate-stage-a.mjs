import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  LIVE_EVALUATION_PROMPT_STAGE_A_V3,
  LIVE_EVALUATION_SCORER_V3,
  buildLiveEvaluationPreflight,
  runLiveEvaluationPilot,
} from "../src/lib/modelEvaluation/livePilot.ts";
import { ORIGINAL_LIVE_RUN_ID, buildStageACandidateManifest } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

function arg(name, fallback = undefined) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function boolArg(name) {
  return arg(name) === "true";
}

function loadLocalEnv() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key]) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
}

function writeBlocked(summary) {
  const outDir = join(process.cwd(), ".vireon", "model-evaluation", "stage-a");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `stage-a-blocked-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(out, `${JSON.stringify({
    createdAt: new Date().toISOString(),
    status: "blocked-before-paid-execution",
    message: summary.preflight.message,
    blockers: summary.preflight.blockers,
    provider: summary.preflight.provider,
    model: summary.preflight.model,
    fixtureCount: summary.preflight.fixtureCount,
    expectedMaximumRequestCount: summary.preflight.expectedMaximumRequestCount,
    estimatedMaximumCost: summary.preflight.estimatedMaximumCost,
    redactedEnvironment: summary.preflight.redactedEnvironment,
    providerCallsMade: false,
    modelPromotionDisabled: true,
  }, null, 2)}\n`, { flag: "wx" });
  return out;
}

const candidate = buildStageACandidateManifest().report;
loadLocalEnv();
if (!process.env.VIREON_OPENAI_API_KEY && process.env.OPENAI_API_KEY) {
  process.env.VIREON_OPENAI_API_KEY = process.env.OPENAI_API_KEY;
}
const provider = arg("provider", "openai");
const model = arg("model", candidate.exactModel);

if (provider !== "openai") {
  console.error("STAGE A LIVE VALIDATION BLOCKED");
  console.error("Stage A is approved only for OpenAI in this milestone.");
  process.exit(1);
}

if (model !== candidate.exactModel) {
  console.error("STAGE A LIVE VALIDATION BLOCKED");
  console.error(`Configured model must match candidate manifest: ${candidate.exactModel}`);
  process.exit(1);
}

process.env.VIREON_STAGE_A_LIVE_VALIDATION = "true";
process.env.VIREON_LIVE_MODEL_STAGE = "stage-a";
process.env.VIREON_LIVE_MODEL_SOURCE_RUN_ID = arg("source-run-id", ORIGINAL_LIVE_RUN_ID);
process.env.VIREON_LIVE_MODEL_PROMPT_VERSION = LIVE_EVALUATION_PROMPT_STAGE_A_V3;
process.env.VIREON_LIVE_MODEL_SCORER_VERSION = LIVE_EVALUATION_SCORER_V3;
process.env.VIREON_LIVE_MODEL_FIXTURE_IDS = candidate.fixtureIds.join(",");
process.env.VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT = arg("fixture-limit", "6");
process.env.VIREON_LIVE_MODEL_RERUN_GENERATION = "stage-a";
process.env.VIREON_OPENAI_DEFAULT_MODEL = model;
process.env.VIREON_OPENAI_ENABLED = process.env.VIREON_OPENAI_ENABLED ?? "true";
process.env.VIREON_MODEL_ORCHESTRATOR_MODE = process.env.VIREON_MODEL_ORCHESTRATOR_MODE ?? "live-evaluation";
process.env.VIREON_LIVE_MODEL_EVALUATION = process.env.VIREON_LIVE_MODEL_EVALUATION ?? "true";
process.env.VIREON_SYNTHETIC_DATA_ONLY = process.env.VIREON_SYNTHETIC_DATA_ONLY ?? "true";
process.env.VIREON_MODEL_EVALUATION_ENVIRONMENT = process.env.VIREON_MODEL_EVALUATION_ENVIRONMENT ?? "local-pilot";
process.env.VIREON_MODEL_LOG_PROMPTS = "false";
process.env.VIREON_MODEL_STORE_RAW_RESPONSES = "false";
process.env.VIREON_MODEL_ALLOW_CROSS_PROVIDER_FALLBACK = "false";
process.env.VIREON_ANTHROPIC_ENABLED = "false";
process.env.VIREON_GEMINI_ENABLED = "false";
process.env.VIREON_OPENAI_APPROVED_SENSITIVITY_LEVELS = process.env.VIREON_OPENAI_APPROVED_SENSITIVITY_LEVELS ?? "public,internal,personal,financial-sensitive";
process.env.VIREON_LIVE_MODEL_DAILY_BUDGET = arg("daily-budget", process.env.VIREON_LIVE_MODEL_DAILY_BUDGET ?? "1.8");
process.env.VIREON_LIVE_MODEL_MAX_RUN_COST = arg("max-run-cost", process.env.VIREON_LIVE_MODEL_MAX_RUN_COST ?? "1.8");
process.env.VIREON_LIVE_MODEL_MAX_TASK_COST = arg("max-task-cost", process.env.VIREON_LIVE_MODEL_MAX_TASK_COST ?? "0.3");
process.env.VIREON_LIVE_MODEL_MAX_RETRIES = arg("max-retries", process.env.VIREON_LIVE_MODEL_MAX_RETRIES ?? "0");
process.env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS = arg("max-output-tokens", process.env.VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS ?? "800");
process.env.VIREON_MODEL_DAILY_BUDGET = process.env.VIREON_LIVE_MODEL_DAILY_BUDGET;
process.env.VIREON_MODEL_MAX_TASK_COST = process.env.VIREON_LIVE_MODEL_MAX_TASK_COST;
process.env.VIREON_DATA_SOURCE = "synthetic";
process.env.VIREON_STAGE_A_BUDGET_APPROVED = String(boolArg("budget-approved") || process.env.VIREON_STAGE_A_BUDGET_APPROVED === "true");

if (boolArg("preflight-only")) {
  const preflight = await buildLiveEvaluationPreflight(process.env);
  console.log(JSON.stringify({
    status: preflight.state,
    message: preflight.message,
    provider: preflight.provider,
    model: preflight.model,
    fixtureCount: preflight.fixtureCount,
    expectedMaximumRequestCount: preflight.expectedMaximumRequestCount,
    estimatedMaximumCost: preflight.estimatedMaximumCost,
    budgetConfigurationHash: preflight.budgetConfigurationHash,
    budgetReservation: preflight.budgetReservation,
    sensitivityLevel: preflight.sensitivityLevel,
    blockers: preflight.blockers,
    redactedEnvironment: preflight.redactedEnvironment,
  }, null, 2));
  if (preflight.message !== "READY FOR PAID STAGE-A EXECUTION") process.exit(1);
} else {
  const summary = await runLiveEvaluationPilot(process.env);

  console.log(JSON.stringify({
    status: summary.run?.status ?? "blocked",
    message: summary.preflight.message,
    runId: summary.run?.runId ?? null,
    provider: summary.preflight.provider,
    model: summary.preflight.model,
    promptVersion: process.env.VIREON_LIVE_MODEL_PROMPT_VERSION,
    scorerVersion: process.env.VIREON_LIVE_MODEL_SCORER_VERSION,
    fixtureCount: summary.run?.fixtureCount ?? summary.preflight.fixtureCount,
    requestCount: summary.operationalMetrics.requestCount,
    cost: summary.run?.totalCost ?? 0,
    authorisedCap: summary.preflight.estimatedMaximumCost,
    budgetConfigurationHash: summary.preflight.budgetConfigurationHash,
    haltReason: summary.haltReason,
    humanReviewRequired: summary.humanReviewQueue.length,
    humanReviewCompleted: summary.humanReviewQueue.filter((item) => item.status === "completed").length,
    decision: summary.run?.status === "completed" ? "Stage-A completed; review required before Stage-B decision" : "Stage-A blocked before paid execution",
    modelPromotionDisabled: true,
  }, null, 2));

  if (!summary.run) {
    console.log(`Blocked artifact: ${writeBlocked(summary)}`);
    process.exit(1);
  }

  if (summary.run.status !== "completed" || summary.haltReason !== "none" || summary.operationalMetrics.requestCount !== 6) {
    process.exitCode = 1;
  }
}
