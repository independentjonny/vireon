import { buildLiveEvaluationPreflight } from "../src/lib/modelEvaluation/livePilot.ts";

const preflight = await buildLiveEvaluationPreflight(process.env);

console.log(`[model-evaluation-live-preflight] ${preflight.message}`);
console.log(JSON.stringify({
  provider: preflight.provider,
  model: preflight.model,
  fixtureCount: preflight.fixtureCount,
  benchmarkSuites: preflight.suites,
  estimatedMaximumCost: preflight.estimatedMaximumCost,
  expectedMaximumRequestCount: preflight.expectedMaximumRequestCount,
  sensitivityLevel: preflight.sensitivityLevel,
  outputStoragePolicy: preflight.outputStoragePolicy,
  checks: preflight.checks,
  blockers: preflight.blockers,
  environment: preflight.redactedEnvironment,
}, null, 2));

if (preflight.state !== "ready") process.exitCode = 1;
