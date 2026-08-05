import { listReviewArtifacts, REVIEWED_LIVE_RUN_ID } from "../src/lib/modelEvaluation/liveReview.ts";

function arg(name, fallback = undefined) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

const runId = arg("run-id", REVIEWED_LIVE_RUN_ID);
console.log(JSON.stringify({ runId, artifacts: listReviewArtifacts(runId) }, null, 2));
