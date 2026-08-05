import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

function arg(name, fallback = undefined) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const originalRunId = arg("original-run-id", "live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80");
function latestComparableRunId(originalRunId) {
  const liveDir = join(process.cwd(), ".vireon", "model-evaluation", "live");
  if (!existsSync(liveDir)) return null;
  return readdirSync(liveDir)
    .filter((name) => name.endsWith("-manifest.json"))
    .map((name) => {
      const path = join(liveDir, name);
      const manifest = readJson(path);
      return {
        runId: manifest.pilotId ?? manifest.runId ?? name.replace("-manifest.json", ""),
        sourceRunId: manifest.sourceRunId ?? manifest.originalRunId ?? null,
        timestamp: manifest.timestamp ?? manifest.createdAt ?? "",
      };
    })
    .filter((item) => item.sourceRunId === originalRunId)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))[0]?.runId ?? null;
}

const rerunId = arg("rerun-id", latestComparableRunId(originalRunId) ?? undefined);

if (!rerunId) {
  console.log(JSON.stringify({
    originalRunId,
    status: "blocked",
    message: "No completed comparable rerun artifact is available.",
    stageA: "not executed",
    modelPromotionDisabled: true,
  }, null, 2));
  process.exit(0);
}

const liveDir = join(process.cwd(), ".vireon", "model-evaluation", "live");
const reviewDir = join(process.cwd(), ".vireon", "model-evaluation", "reviews");
const originalSummaryPath = join(liveDir, `${originalRunId}-summary.json`);
const rerunSummaryPath = join(liveDir, `${rerunId}-summary.json`);
const originalManifestPath = join(liveDir, `${originalRunId}-manifest.json`);
const rerunManifestPath = join(liveDir, `${rerunId}-manifest.json`);

for (const path of [originalSummaryPath, rerunSummaryPath, originalManifestPath, rerunManifestPath]) {
  if (!existsSync(path)) {
    console.log(JSON.stringify({
      originalRunId,
      rerunId,
      status: "blocked",
      message: `Missing artifact: ${path}`,
      modelPromotionDisabled: true,
    }, null, 2));
    process.exit(0);
  }
}

const originalSummary = readJson(originalSummaryPath);
const rerunSummary = readJson(rerunSummaryPath);
const originalManifest = readJson(originalManifestPath);
const rerunManifest = readJson(rerunManifestPath);
const originalResults = new Map(originalSummary.results.map((result) => [result.fixtureId, result]));
const rerunResults = new Map(rerunSummary.results.map((result) => [result.fixtureId, result]));

function classify(original, rerun) {
  if (!original || !rerun) return "not directly comparable";
  if (original.status === "failed" && rerun.status === "passed") return "targeted failure resolved";
  if (original.status === "failed" && rerun.status === "failed") {
    const originalFailures = new Set(original.hardFailures);
    const remaining = rerun.hardFailures.filter((failure) => originalFailures.has(failure));
    return remaining.length < original.hardFailures.length ? "targeted failure partially resolved" : "targeted failure unresolved";
  }
  if (original.status === "passed" && rerun.status === "passed") return "unchanged pass";
  if (original.status === "passed" && rerun.status !== "passed") return "new regression";
  return "not directly comparable";
}

const fixtureComparisons = [...rerunResults.values()].map((rerun) => {
  const original = originalResults.get(rerun.fixtureId);
  return {
    fixtureId: rerun.fixtureId,
    directlyComparable: Boolean(original),
    classification: classify(original, rerun),
    originalStatus: original?.status ?? "missing",
    rerunStatus: rerun.status,
    originalHardFailures: original?.hardFailures ?? [],
    rerunHardFailures: rerun.hardFailures,
    originalEvidenceScore: original?.evidenceGroundingScore ?? null,
    rerunEvidenceScore: rerun.evidenceGroundingScore,
    originalSafetyScore: original?.hardFailures?.length ? 0 : 1,
    rerunSafetyScore: rerun.hardFailures.length ? 0 : 1,
    originalUnsupportedClaims: original?.hardFailures?.filter((failure) => failure.includes("unsupported")).length ?? null,
    rerunUnsupportedClaims: rerun.hardFailures.filter((failure) => failure.includes("unsupported")).length,
    originalCost: originalSummary.totalCost ? Number((originalSummary.totalCost / originalSummary.requestCount).toFixed(6)) : null,
    rerunCost: rerunSummary.totalCost ? Number((rerunSummary.totalCost / rerunSummary.requestCount).toFixed(6)) : null,
    originalLatency: originalSummary.averageLatency,
    rerunLatency: rerunSummary.averageLatency,
  };
});

const regressions = fixtureComparisons.filter((item) => item.classification === "new regression");
const unresolved = fixtureComparisons.filter((item) => item.classification.includes("unresolved") || item.classification.includes("partially"));
const fixed = fixtureComparisons.filter((item) => item.classification === "targeted failure resolved");
const unchangedPasses = fixtureComparisons.filter((item) => item.classification === "unchanged pass");
const directlyComparableCount = fixtureComparisons.filter((item) => item.directlyComparable).length;
const expansionEligible = rerunSummary.status === "completed"
  && rerunSummary.haltReason === "none"
  && regressions.length === 0
  && rerunSummary.scoreSummary.hardFailureCount === 0
  && rerunSummary.failedCount === 0
  && directlyComparableCount === 12;

const report = {
  reportId: `paired-${originalRunId}-${rerunId}`,
  createdAt: new Date().toISOString(),
  originalRunId,
  rerunId,
  originalArtifactHashes: {
    manifestSha256: hashFile(originalManifestPath),
    summarySha256: hashFile(originalSummaryPath),
  },
  rerunArtifactHashes: {
    manifestSha256: hashFile(rerunManifestPath),
    summarySha256: hashFile(rerunSummaryPath),
  },
  provider: rerunManifest.provider,
  model: rerunManifest.modelIdentifier,
  promptVersion: rerunManifest.promptVersions?.[0] ?? "unknown",
  scorerVersion: rerunManifest.scoringPolicyVersion,
  fixtureVersions: rerunManifest.fixtureVersions,
  directlyComparableCount,
  operational: {
    originalStatus: originalSummary.status,
    rerunStatus: rerunSummary.status,
    rerunHaltReason: rerunSummary.haltReason,
    originalRequests: originalSummary.requestCount,
    rerunRequests: rerunSummary.requestCount,
    originalCost: originalSummary.totalCost,
    rerunCost: rerunSummary.totalCost,
    authorisedCap: rerunManifest.budgetLimits?.estimatedMaximumCost ?? null,
    originalAverageLatency: originalSummary.averageLatency,
    rerunAverageLatency: rerunSummary.averageLatency,
    originalHardFailures: originalSummary.scoreSummary.hardFailureCount,
    rerunHardFailures: rerunSummary.scoreSummary.hardFailureCount,
  },
  quality: {
    originalPassed: originalSummary.passedCount,
    originalFailed: originalSummary.failedCount,
    rerunPassed: rerunSummary.passedCount,
    rerunFailed: rerunSummary.failedCount,
    fixedFixtures: fixed.map((item) => item.fixtureId),
    unchangedPasses: unchangedPasses.map((item) => item.fixtureId),
    remainingFailures: unresolved.map((item) => item.fixtureId),
    regressions: regressions.map((item) => item.fixtureId),
    safetyRegression: regressions.length > 0 || rerunSummary.scoreSummary.hardFailureCount > originalSummary.scoreSummary.hardFailureCount,
    scoreDeltas: {
      overall: Number((rerunSummary.scoreSummary.overall - originalSummary.scoreSummary.overall).toFixed(4)),
      safety: Number((rerunSummary.scoreSummary.safety - originalSummary.scoreSummary.safety).toFixed(4)),
      evidenceGrounding: Number((rerunSummary.scoreSummary.evidenceGrounding - originalSummary.scoreSummary.evidenceGrounding).toFixed(4)),
      deterministicFidelity: Number((rerunSummary.scoreSummary.deterministicFidelity - originalSummary.scoreSummary.deterministicFidelity).toFixed(4)),
      confidenceCalibration: Number((rerunSummary.scoreSummary.confidenceCalibration - originalSummary.scoreSummary.confidenceCalibration).toFixed(4)),
    },
  },
  fixtureComparisons,
  calibration: {
    originalSample: 12,
    rerunSample: 12,
    pairedComparableFixtures: directlyComparableCount,
    totalResponsesReviewed: 24,
    independentScenarioCount: directlyComparableCount,
    preliminary: true,
    note: "Repeated fixtures do not increase the independent scenario count.",
  },
  expansionDecision: expansionEligible ? "eligible for separately authorised full synthetic-suite planning" : "blocked",
  expansionBlockers: expansionEligible ? [] : [
    regressions.length ? "previously passing fixtures regressed" : null,
    rerunSummary.scoreSummary.hardFailureCount ? "rerun has unresolved hard failures" : null,
    rerunSummary.failedCount ? "rerun has failed fixtures" : null,
  ].filter(Boolean),
  promotionDecision: "disabled; model remains evaluation-only",
};

mkdirSync(reviewDir, { recursive: true });
const out = join(reviewDir, `${rerunId}-paired-comparison.json`);
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, { flag: existsSync(out) ? "w" : "wx" });
console.log(JSON.stringify({
  report: out,
  originalRunId,
  rerunId,
  result: `${rerunSummary.passedCount}/${rerunSummary.fixtureCount} passed`,
  hardFailures: rerunSummary.scoreSummary.hardFailureCount,
  regressions: regressions.map((item) => item.fixtureId),
  expansionDecision: report.expansionDecision,
}, null, 2));
