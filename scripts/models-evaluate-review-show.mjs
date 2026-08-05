import { buildReviewWorkPackages, REVIEWED_LIVE_RUN_ID } from "../src/lib/modelEvaluation/liveReview.ts";

function arg(name, fallback = undefined) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

const runId = arg("run-id", REVIEWED_LIVE_RUN_ID);
const fixtureId = arg("fixture-id");
const packages = buildReviewWorkPackages(runId);
console.log(JSON.stringify(fixtureId ? packages.find((item) => item.fixtureId === fixtureId) ?? { error: "fixture not found" } : packages, null, 2));
