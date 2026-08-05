import { buildPromptAblationMatrix } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = buildPromptAblationMatrix();
console.log(JSON.stringify({
  artifact: path,
  fixtureCount: report.fixtureCount,
  variants: report.variants,
  selectedPrinciples: report.selectedPrinciples,
  paidCallsMade: report.paidCallsMade,
}, null, 2));
