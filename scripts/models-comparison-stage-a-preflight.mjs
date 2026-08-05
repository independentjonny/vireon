import {
  buildCandidateStageAPreflight,
} from "../src/lib/modelEvaluation/modelComparisonCandidate.ts";
import { loadLocalEnv } from "./model-registry-cli-utils.mjs";

function arg(name, fallback = undefined) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function boolArg(name) {
  return arg(name) === "true" || process.argv.includes(`--${name}`);
}

loadLocalEnv();

const candidate = arg("candidate", "openai/gpt-5.6-terra");
const [provider, model] = candidate.split("/");

if (provider !== "openai" || !model) {
  console.error("CANDIDATE STAGE-A BLOCKED");
  console.error("Only an explicit openai/<model> candidate is accepted for this milestone.");
  process.exit(1);
}

const report = await buildCandidateStageAPreflight({
  provider,
  model,
  runCompatibilityCheck: boolArg("compatibility-check"),
  budgetApproved: boolArg("budget-approved"),
  env: process.env,
});

const { env: _env, ...safeReport } = report;
console.log(JSON.stringify(safeReport, null, 2));

if (report.status !== "ready") {
  process.exit(1);
}
