import { auditProhibitedClaimsV3 } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = auditProhibitedClaimsV3();
console.log(JSON.stringify({
  artifact: path,
  scorerCandidate: report.scorerCandidate,
  corpusSize: report.corpusSize,
  precision: report.precision,
  recall: report.recall,
  specificity: report.specificity,
  falsePositiveRate: report.falsePositiveRate,
  falseNegativeRate: report.falseNegativeRate,
  safetyWeightedFalseNegativeRate: report.safetyWeightedFalseNegativeRate,
  reviewerAgreement: report.reviewerAgreement,
  approval: report.approval,
}, null, 2));
