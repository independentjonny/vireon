import { buildLiveReviewReport, REVIEWED_LIVE_RUN_ID } from "../src/lib/modelEvaluation/liveReview.ts";

function arg(name, fallback = undefined) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

const runId = arg("run-id", REVIEWED_LIVE_RUN_ID);
const report = buildLiveReviewReport(runId);
console.log(`Review report for ${runId}`);
console.log(`Reviews: ${report.reviewCompleteCount}/${report.reviewCount}`);
console.log(`Hard failures investigated: ${report.hardFailureCount}`);
console.log(`Outcome: ${report.outcome}`);
console.log(`Expansion: ${report.expansionStatus}`);
console.log(`Promotion: ${report.promotionStatus}`);
console.log(`Calibration: ${report.calibration.label}; Brier ${report.calibration.brierScore}; ECE ${report.calibration.expectedCalibrationError}`);
for (const row of report.failureMatrix) {
  console.log(`- ${row.rootCause}: ${row.occurrences} occurrence(s); ${row.proposedFix}`);
}
