import { buildCanonicalModelRegistry, validateCanonicalModelRegistry } from "../src/lib/modelOrchestrator/modelRegistry.ts";
import { loadLocalEnv } from "./model-registry-cli-utils.mjs";

loadLocalEnv();
const registry = buildCanonicalModelRegistry(process.env);
const validation = validateCanonicalModelRegistry(registry);

console.log(JSON.stringify({
  ...validation,
  status: validation.ok ? "REGISTRY VALID" : "REGISTRY INVALID",
}, null, 2));

if (!validation.ok) process.exit(1);
