import { finalizeTerraRetirementDecision } from "../src/lib/modelEvaluation/modelComparisonCandidate.ts";
import { loadLocalEnv } from "./model-registry-cli-utils.mjs";

loadLocalEnv();

const result = finalizeTerraRetirementDecision();

console.log(JSON.stringify({
  decision: result.decision.decision,
  provider: result.decision.provider,
  model: result.decision.model,
  sourceRunId: result.decision.sourceRunId,
  generatedOutputs: result.decision.generatedOutputs,
  passed: result.decision.passed,
  hardFailures: result.decision.hardFailures,
  criticalFailures: result.decision.criticalFailures,
  humanReviewsCompleted: result.decision.humanReviewsCompleted,
  stageBBlocked: result.decision.stageBBlocked,
  promotionDisabled: result.decision.modelPromotionDisabled,
  adapterDefectExceptionEligible: result.decision.adapterDefectException.eligible,
  decisionArtifact: result.decisionPath,
  decompositionArtifact: result.decompositionPath,
  matrixArtifact: result.matrixPath,
}, null, 2));
