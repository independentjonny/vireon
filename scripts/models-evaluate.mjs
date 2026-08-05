import { runEvaluation, runFixtureValidation } from "../src/lib/modelEvaluation/runner.ts";
import { renderEvaluationReport } from "../src/lib/modelEvaluation/reporting.ts";

function readArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const maximumFixtures = readArg("maximum-fixtures");
const suiteId = readArg("suite");
const executionMode = readArg("mode") ?? "offline-mock";
const provider = readArg("provider");
const model = readArg("model");

const validation = runFixtureValidation();
const run = await runEvaluation({
  suiteId,
  executionMode,
  provider,
  model,
  maximumFixtures: maximumFixtures ? Number(maximumFixtures) : undefined,
  liveProviderOptIn: process.env.VIREON_LIVE_MODEL_EVALUATION === "true",
});

console.log(renderEvaluationReport(run, "text"));
console.log(`Fixtures: ${validation.fixtureCount}; suites: ${validation.suiteCount}; live provider enabled: ${process.env.VIREON_LIVE_MODEL_EVALUATION === "true"}`);

if (run.status === "blocked" || run.status === "failed") {
  process.exitCode = 1;
}
