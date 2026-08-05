import { executeCandidateStageA } from "../src/lib/modelEvaluation/modelComparisonCandidate.ts";
import { loadLocalEnv } from "./model-registry-cli-utils.mjs";

function arg(name, fallback = undefined) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

loadLocalEnv();

const candidate = arg("candidate", "openai/gpt-5.6-terra");
const [provider, model] = candidate.split("/");

if (provider !== "openai" || !model) {
  console.error("CANDIDATE STAGE-A BLOCKED");
  console.error("Only an explicit openai/<model> candidate is accepted for this milestone.");
  process.exit(1);
}

const result = await executeCandidateStageA({ provider, model, env: process.env });
const { env: _env, ...safePreflight } = result.preflight;

console.log(JSON.stringify({
  preflight: safePreflight,
  run: result.summary?.run ? {
    runId: result.summary.run.runId,
    status: result.summary.run.status,
    fixtureCount: result.summary.run.fixtureCount,
    passedCount: result.summary.run.passedCount,
    failedCount: result.summary.run.failedCount,
    blockedCount: result.summary.run.blockedCount,
    cost: result.summary.run.totalCost,
    haltReason: result.summary.haltReason,
    requestCount: result.summary.operationalMetrics.requestCount,
  } : null,
  report: result.report ?? null,
}, null, 2));

if (!result.summary?.run || result.summary.run.status !== "completed" || result.summary.operationalMetrics.requestCount !== 6) {
  process.exit(1);
}
