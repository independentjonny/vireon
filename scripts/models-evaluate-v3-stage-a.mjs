import { buildStageACandidateManifest } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = buildStageACandidateManifest();
console.log(JSON.stringify({
  artifact: path,
  candidateId: report.candidateId,
  status: report.status,
  readinessState: report.readinessState,
  fixtureIds: report.fixtureIds,
  requestCap: report.requestCap,
  paidExecutionAuthorised: report.paidExecutionAuthorised,
}, null, 2));
