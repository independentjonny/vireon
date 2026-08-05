import { existsSync, readFileSync } from "fs";

export function loadLocalEnv() {
  const path = ".env.local";
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key]) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, "");
  }
  if (!process.env.VIREON_OPENAI_API_KEY && process.env.OPENAI_API_KEY) {
    process.env.VIREON_OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  }
}

export function redactedRegistryEntry(entry) {
  return {
    provider: entry.provider,
    exactModelId: entry.exactModelId,
    displayName: entry.displayName,
    status: entry.status,
    capabilities: entry.capabilities,
    contextWindow: entry.contextWindow,
    structuredOutputSupport: entry.structuredOutputSupport,
    availability: entry.availability,
    evaluationEligibility: entry.evaluationEligibility,
    productionEligibility: entry.productionEligibility,
    retirementStatus: entry.retirementStatus,
    pricingMetadata: entry.pricingMetadata,
    healthStatus: entry.healthStatus,
    configured: entry.configured,
    authenticated: entry.authenticated,
    reachable: entry.reachable,
    supportedModels: entry.supportedModels,
    lastCheck: entry.lastCheck,
    failureReason: entry.failureReason,
    configurationSource: entry.configurationSource,
  };
}
