import { buildTaskRestrictionsReport } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = buildTaskRestrictionsReport();
console.log(JSON.stringify({
  artifact: path,
  provider: report.provider,
  model: report.model,
  approvalEvidence: report.approvalEvidence,
  restrictions: report.restrictions.map((restriction) => ({
    taskType: restriction.taskType,
    state: restriction.state,
    reviewRequired: restriction.reviewRequired,
    supportingFixtures: restriction.supportingFixtures,
  })),
}, null, 2));
