import { counterfactualRescoring } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = counterfactualRescoring();
console.log(JSON.stringify({
  artifact: path,
  scorerV3Candidate: report.scorerV3Candidate,
  fixtureCount: report.rows.length,
  historicalScoresMutated: report.historicalScoresMutated,
  wouldStillFail: report.rows.filter((row) => row.scorerV3Candidate.status === "would-still-fail").map((row) => row.fixtureId),
}, null, 2));
