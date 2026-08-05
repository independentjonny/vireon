import { auditProhibitedClaims } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = auditProhibitedClaims();
console.log(JSON.stringify({
  artifact: path,
  corpusSize: report.corpusSize,
  truePositives: report.truePositives,
  trueNegatives: report.trueNegatives,
  falsePositives: report.falsePositives,
  falseNegatives: report.falseNegatives,
  precision: report.precision,
  recall: report.recall,
  specificity: report.specificity,
  safetyWeightedFalseNegativeRate: report.safetyWeightedFalseNegativeRate,
  approval: report.approval,
}, null, 2));
