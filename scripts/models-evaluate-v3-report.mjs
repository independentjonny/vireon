import {
  auditDeterministicConfidencePolicyV3,
  auditProhibitedClaimsV3,
  buildRegressionCausalTraces,
  buildStageACandidateManifest,
  buildStageAPreflight,
  resolveV3RerunFailures,
} from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const failures = resolveV3RerunFailures();
const regressions = buildRegressionCausalTraces();
const claims = auditProhibitedClaimsV3();
const confidence = auditDeterministicConfidencePolicyV3();
const manifest = buildStageACandidateManifest();
const preflight = buildStageAPreflight();

console.log(JSON.stringify({
  report: "v3-offline-resolution-summary",
  failures: failures.report.failureCount,
  unresolvedPendingLiveTest: failures.report.unresolvedPendingLiveTestCount,
  regressions: regressions.report.rows.length,
  scorerApproval: claims.report.approval,
  confidencePolicyPassed: confidence.report.passed,
  stageAFixtures: manifest.report.fixtureIds,
  stageAState: preflight.report.state,
  paidExecutionAuthorised: false,
  modelPromotion: "disabled",
}, null, 2));
