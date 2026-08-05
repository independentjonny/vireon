import { buildFailureDecomposition } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = buildFailureDecomposition();
console.log(JSON.stringify({
  artifact: path,
  original: report.sourceRuns.original,
  rerun: report.sourceRuns.rerun,
  haltedOperationalEvent: report.haltedOperationalEvent.runId,
  transitionCounts: report.transitionCounts,
  conclusion: report.conclusion,
}, null, 2));
