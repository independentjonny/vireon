import { runEvaluation } from "../src/lib/modelEvaluation/runner.ts";
import { buildCalibrationReport } from "../src/lib/modelEvaluation/calibration.ts";

const run = await runEvaluation({ executionMode: "offline-mock" });
const report = buildCalibrationReport(run);

console.log(`Calibration report: ${report.reportId}`);
console.log(`Run: ${report.runId}`);
console.log(`Brier score: ${report.brierScore}`);
console.log(`Expected calibration error: ${report.expectedCalibrationError}`);
console.log(`Overconfidence rate: ${report.overconfidenceRate}`);
console.log(`Underconfidence rate: ${report.underconfidenceRate}`);
for (const bucket of report.buckets) {
  console.log(`${bucket.minConfidence}-${bucket.maxConfidence}: count=${bucket.count} accuracy=${bucket.accuracy} averageConfidence=${bucket.averageConfidence}`);
}

if (run.status === "blocked") {
  process.exitCode = 1;
}
