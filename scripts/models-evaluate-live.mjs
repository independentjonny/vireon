import { runLiveEvaluationPilot } from "../src/lib/modelEvaluation/livePilot.ts";
import { renderEvaluationReport } from "../src/lib/modelEvaluation/reporting.ts";

function arg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

const provider = arg("provider");
const model = arg("model");
const fixtureLimit = arg("fixture-limit");
const budgetConfirmed = arg("budget-confirmed");
const promptVersion = arg("prompt-version");
const scorerVersion = arg("scorer-version");
const sourceRunId = arg("source-run-id");

if (!provider || !model || !fixtureLimit || budgetConfirmed !== "true") {
  console.log("[model-evaluation-live] LIVE MODEL EVALUATION BLOCKED");
  console.log("Required explicit arguments: --provider=<provider> --model=<configured-model> --fixture-limit=12 --budget-confirmed=true");
  process.exit(1);
}

if (process.env.VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT && process.env.VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT !== fixtureLimit) {
  console.log("[model-evaluation-live] LIVE MODEL EVALUATION BLOCKED");
  console.log("The explicit fixture limit must match VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT.");
  process.exit(1);
}

process.env.VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT = fixtureLimit;
if (promptVersion) process.env.VIREON_LIVE_MODEL_PROMPT_VERSION = promptVersion;
if (scorerVersion) process.env.VIREON_LIVE_MODEL_SCORER_VERSION = scorerVersion;
if (sourceRunId) process.env.VIREON_LIVE_MODEL_SOURCE_RUN_ID = sourceRunId;
if (sourceRunId) process.env.VIREON_LIVE_MODEL_RERUN_GENERATION = "2";

const summary = await runLiveEvaluationPilot(process.env);

console.log(`[model-evaluation-live] ${summary.preflight.message}`);
console.log(JSON.stringify({
  provider: summary.preflight.provider,
  model: summary.preflight.model,
  fixtureCount: summary.preflight.fixtureCount,
  requestCount: summary.operationalMetrics.requestCount,
  actualCost: summary.run?.totalCost ?? 0,
  haltReason: summary.haltReason,
  humanReviewItems: summary.humanReviewQueue.length,
  humanReviewRequired: summary.humanReviewQueue.filter((item) => item.required).length,
  calibrationSampleSize: summary.calibrationSampleSize,
  expandedRunEligible: summary.expandedRunEligible,
  automaticPromotionEnabled: summary.automaticPromotionEnabled,
  partialFixtureSet: summary.partialFixtureSet,
  blockers: summary.preflight.blockers,
}, null, 2));

if (summary.run) console.log(renderEvaluationReport(summary.run, "text"));

if (summary.preflight.state !== "ready" || summary.haltReason !== "none" || summary.run?.status === "failed") {
  process.exitCode = 1;
}
