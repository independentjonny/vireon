import { buildCanonicalModelRegistry, buildComparisonReadiness, validateCanonicalModelRegistry } from "../src/lib/modelOrchestrator/modelRegistry.ts";
import { loadLocalEnv, redactedRegistryEntry } from "./model-registry-cli-utils.mjs";

loadLocalEnv();
const registry = buildCanonicalModelRegistry(process.env);
const readiness = buildComparisonReadiness(registry);
const validation = validateCanonicalModelRegistry(registry);

console.log(JSON.stringify({
  ready: readiness.ready,
  message: readiness.message,
  included: readiness.included.map(redactedRegistryEntry),
  excluded: readiness.excluded,
  validation,
  methodologyFrozen: true,
  providerCallsMade: false,
  paidComparisonExecuted: false,
}, null, 2));

if (!readiness.ready || !validation.ok) process.exit(1);
