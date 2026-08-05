import { resolveV3RerunFailures } from "../src/lib/modelEvaluation/liveFailureDecomposition.ts";

const { path, report } = resolveV3RerunFailures();
console.log(JSON.stringify({
  artifact: path,
  failureCount: report.failureCount,
  unresolvedPendingLiveTestCount: report.unresolvedPendingLiveTestCount,
  statuses: report.rows.reduce((acc, row) => {
    acc[row.finalOfflineStatus] = (acc[row.finalOfflineStatus] ?? 0) + 1;
    return acc;
  }, {}),
  historicalArtifactsMutated: report.historicalArtifactsMutated,
}, null, 2));
