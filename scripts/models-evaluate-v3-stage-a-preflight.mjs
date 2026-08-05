import { buildStageAPreflight } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = buildStageAPreflight();
console.log(JSON.stringify({
  artifact: path,
  preflightId: report.preflightId,
  state: report.state,
  readinessState: report.readinessState,
  paidExecutionAuthorised: report.paidExecutionAuthorised,
  budgetApproved: report.budgetApproved,
  providerCallsMade: report.providerCallsMade,
  blockers: report.blockers,
}, null, 2));

if (report.state !== "READY FOR BUDGET APPROVAL") process.exit(1);
