import { buildV3OfflineReview } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = buildV3OfflineReview();
console.log(JSON.stringify({
  artifact: path,
  reviewId: report.reviewId,
  reviewer: report.reviewer,
  decision: report.decision,
  decisions: report.decisions,
  authorCannotSoleApprovePaidRun: report.authorCannotSoleApprovePaidRun,
}, null, 2));
