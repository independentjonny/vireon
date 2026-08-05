import { buildCanonicalModelRegistry, buildProviderHealthReports } from "../src/lib/modelOrchestrator/modelRegistry.ts";
import { loadLocalEnv, redactedRegistryEntry } from "./model-registry-cli-utils.mjs";

loadLocalEnv();
const providers = await buildProviderHealthReports(process.env);
const models = buildCanonicalModelRegistry(process.env).map(redactedRegistryEntry);

console.log(JSON.stringify({
  ok: providers.every((provider) => provider.provider === "anthropic" || provider.provider === "gemini" || provider.healthy || !provider.configured),
  providers,
  models,
}, null, 2));
