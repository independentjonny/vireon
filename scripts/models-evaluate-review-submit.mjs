import { buildLiveReviewReport, REVIEWED_LIVE_RUN_ID } from "../src/lib/modelEvaluation/liveReview.ts";

function arg(name, fallback = undefined) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

const runId = arg("run-id", REVIEWED_LIVE_RUN_ID);
const reviewer = arg("reviewer", "codex-reviewer");
const report = buildLiveReviewReport(runId);
console.log(JSON.stringify({
  runId,
  reviewer,
  reviewCount: report.reviewCount,
  reviewCompleteCount: report.reviewCompleteCount,
  hardFailureCount: report.hardFailureCount,
  outcome: report.outcome,
  expansionStatus: report.expansionStatus,
  promotionStatus: report.promotionStatus,
}, null, 2));
