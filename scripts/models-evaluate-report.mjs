import { runEvaluation } from "../src/lib/modelEvaluation/runner.ts";
import { buildCalibrationReport } from "../src/lib/modelEvaluation/calibration.ts";
import { renderEvaluationReport } from "../src/lib/modelEvaluation/reporting.ts";

const run = await runEvaluation({ executionMode: "offline-mock", maximumFixtures: 16 });
const calibration = buildCalibrationReport(run);

console.log(renderEvaluationReport(run, "text"));
console.log(`Calibration: Brier ${calibration.brierScore}; ECE ${calibration.expectedCalibrationError}; overconfidence ${calibration.overconfidenceRate}; underconfidence ${calibration.underconfidenceRate}`);

if (run.status === "blocked") {
  process.exitCode = 1;
}
