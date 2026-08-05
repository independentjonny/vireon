import { buildV3CandidatePreflight } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = buildV3CandidatePreflight();
console.log(JSON.stringify({
  artifact: path,
  candidateId: report.candidateId,
  status: report.status,
  scorerCandidate: report.scorerCandidate,
  confidencePolicy: report.confidencePolicy,
  paidRerunAuthorised: report.paidRerunAuthorised,
  blockers: report.blockers,
  stagedNextEvaluation: report.stagedNextEvaluation,
}, null, 2));
if (report.status !== "ready-for-review") process.exitCode = 1;
