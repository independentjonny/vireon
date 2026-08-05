import { auditConfidencePolicy } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = auditConfidencePolicy();
console.log(JSON.stringify({
  artifact: path,
  policyVersion: report.policyVersion,
  fixtureCount: report.rows.length,
  conclusion: report.conclusion,
  lowCeilingFixtures: report.rows.filter((row) => row.deterministicCeiling <= 0.65).map((row) => row.fixtureId),
}, null, 2));
