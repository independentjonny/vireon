import { runEvaluation } from "../src/lib/modelEvaluation/runner.ts";
import { createPromotionDecision } from "../src/lib/modelEvaluation/promotion.ts";

const run = await runEvaluation({ executionMode: "candidate-promotion", maximumFixtures: 16 });
const decision = createPromotionDecision(run);

console.log(`Promotion candidate: ${decision.candidate}`);
console.log(`Proposed state: ${decision.proposedState}`);
console.log(`Status: ${decision.status}`);
console.log(`Human review required: ${decision.gateOutcomes.humanReviewComplete === false}`);
console.log(`Automatic promotion: ${decision.approvedAutomatically}`);
console.log(`Failed gates: ${Object.entries(decision.gateOutcomes).filter(([, passed]) => !passed).map(([name]) => name).join(", ") || "none"}`);

if (run.status === "blocked") {
  process.exitCode = 1;
}
