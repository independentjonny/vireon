import { buildRerunCandidateManifest, buildLiveReviewReport, REVIEWED_LIVE_RUN_ID, REMEDIATED_PROMPT_VERSION, REMEDIATED_SCORER_VERSION } from "../src/lib/modelEvaluation/liveReview.ts";
import { buildLiveEvaluationPreflight } from "../src/lib/modelEvaluation/livePilot.ts";

function arg(name, fallback = undefined) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

const runId = arg("run-id", REVIEWED_LIVE_RUN_ID);
const report = buildLiveReviewReport(runId);
const candidate = buildRerunCandidateManifest(runId);
const offlineRegressionPassed = process.env.VIREON_OFFLINE_REGRESSION_PASSED === "true";
const rerunEnv = {
  ...process.env,
  VIREON_LIVE_MODEL_PROMPT_VERSION: process.env.VIREON_LIVE_MODEL_PROMPT_VERSION ?? REMEDIATED_PROMPT_VERSION,
  VIREON_LIVE_MODEL_SCORER_VERSION: process.env.VIREON_LIVE_MODEL_SCORER_VERSION ?? REMEDIATED_SCORER_VERSION,
  VIREON_LIVE_MODEL_SOURCE_RUN_ID: runId,
  VIREON_LIVE_MODEL_RERUN_GENERATION: "2",
};
const livePreflight = await buildLiveEvaluationPreflight(rerunEnv);
const promptReady = rerunEnv.VIREON_LIVE_MODEL_PROMPT_VERSION === REMEDIATED_PROMPT_VERSION;
const scorerReady = rerunEnv.VIREON_LIVE_MODEL_SCORER_VERSION === REMEDIATED_SCORER_VERSION;
const fixtureReady = livePreflight.fixtureCount === 12;
const ready = offlineRegressionPassed
  && report.reviewCompleteCount === 12
  && report.hardFailureCount === 6
  && promptReady
  && scorerReady
  && fixtureReady
  && livePreflight.state === "ready";
const blockers = [
  offlineRegressionPassed ? null : "set VIREON_OFFLINE_REGRESSION_PASSED=true after offline regression commands pass",
  promptReady ? null : `set VIREON_LIVE_MODEL_PROMPT_VERSION=${REMEDIATED_PROMPT_VERSION}`,
  scorerReady ? null : `set VIREON_LIVE_MODEL_SCORER_VERSION=${REMEDIATED_SCORER_VERSION}`,
  fixtureReady ? null : "same 12-fixture subset must be selected",
  ...livePreflight.blockers.map((blocker) => `live preflight: ${blocker}`),
].filter(Boolean);
console.log(JSON.stringify({
  runId,
  state: ready ? "READY FOR PAID 12-FIXTURE RERUN" : "RERUN BLOCKED",
  blockers: ready ? [] : blockers,
  livePreflight: {
    provider: livePreflight.provider,
    model: livePreflight.model,
    fixtureCount: livePreflight.fixtureCount,
    expectedMaximumRequestCount: livePreflight.expectedMaximumRequestCount,
    estimatedMaximumCost: livePreflight.estimatedMaximumCost,
    outputStoragePolicy: livePreflight.outputStoragePolicy,
    redactedEnvironment: livePreflight.redactedEnvironment,
  },
  candidate,
}, null, 2));
if (!ready) process.exitCode = 1;
