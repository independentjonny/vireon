import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { buildLiveReviewReport, REVIEWED_LIVE_RUN_ID } from "../src/lib/modelEvaluation/liveReview.ts";

function arg(name, fallback = undefined) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function latestStageARunId() {
  const dir = join(process.cwd(), ".vireon", "model-evaluation", "stage-a");
  if (!existsSync(dir)) return null;
  const reports = readdirSync(dir)
    .filter((name) => name.endsWith("-stage-a-report.json"))
    .map((name) => {
      const path = join(dir, name);
      const report = JSON.parse(readFileSync(path, "utf8"));
      return { runId: report.runId, createdAt: report.createdAt };
    })
    .filter((report) => {
      const path = join(dir, `${report.runId}-stage-a-report.json`);
      const full = JSON.parse(readFileSync(path, "utf8"));
      return Number(full.cost ?? 0) > 0;
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return reports[0]?.runId ?? null;
}

const runId = arg("run-id", latestStageARunId() ?? REVIEWED_LIVE_RUN_ID);
const report = buildLiveReviewReport(runId);

console.log(JSON.stringify({
  runId,
  reviews: `${report.reviewCompleteCount}/${report.reviewCount}`,
  hardFailureCount: report.hardFailureCount,
  outcome: report.outcome,
  expansionStatus: report.expansionStatus,
  promotionStatus: report.promotionStatus,
}, null, 2));
