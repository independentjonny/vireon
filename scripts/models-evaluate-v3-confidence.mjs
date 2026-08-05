import { auditDeterministicConfidencePolicyV3 } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = auditDeterministicConfidencePolicyV3();
console.log(JSON.stringify({
  artifact: path,
  policyVersion: report.policyVersion,
  taskPolicyCount: report.taskPolicies.length,
  invariantCount: report.invariants.length,
  passed: report.passed,
  modelGeneratedConfidenceDisabledFor: report.taskPolicies.filter((policy) => !policy.modelMayProvideConfidence).map((policy) => policy.taskType),
}, null, 2));
