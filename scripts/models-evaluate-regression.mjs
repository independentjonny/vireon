import { runEvaluation } from "../src/lib/modelEvaluation/runner.ts";
import { evaluationRepository } from "../src/lib/modelEvaluation/store.ts";
import { renderEvaluationReport } from "../src/lib/modelEvaluation/reporting.ts";

const baselineRun = await runEvaluation({ executionMode: "offline-mock", maximumFixtures: 12, now: "2026-07-21T09:00:00.000Z" });
evaluationRepository.saveBaseline(baselineRun, `${baselineRun.provider}/${baselineRun.model}/${baselineRun.promptVersion}`);

const candidateRun = await runEvaluation({ executionMode: "regression", maximumFixtures: 12, now: "2026-07-21T09:05:00.000Z" });
console.log(renderEvaluationReport(candidateRun, "text"));
console.log(`Regression status: ${candidateRun.regressionSummary.status}`);

if (candidateRun.status === "blocked" || candidateRun.regressionSummary.status === "regression-detected") {
  process.exitCode = 1;
}
