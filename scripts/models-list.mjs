import { buildCanonicalModelRegistry } from "../src/lib/modelOrchestrator/modelRegistry.ts";
import { loadLocalEnv, redactedRegistryEntry } from "./model-registry-cli-utils.mjs";

loadLocalEnv();
const registry = buildCanonicalModelRegistry(process.env);

console.log(JSON.stringify({
  ok: true,
  modelCount: registry.length,
  models: registry.map(redactedRegistryEntry),
}, null, 2));
