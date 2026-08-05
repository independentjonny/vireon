import { buildConfigurationReceipt, validateExecutionEnvelope } from "../src/lib/modelEvaluation/modelComparisonCandidate.ts";

const validation = validateExecutionEnvelope(process.env);
if (!validation.ok) {
  console.error(JSON.stringify({
    status: "blocked",
    reason: validation.reason,
    configurationHash: validation.configurationHash,
  }));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "valid",
  message: "CANDIDATE ENVIRONMENT PROPAGATION VALID",
  ...buildConfigurationReceipt("child-process-startup", process.env, {
    modelHealthSource: "runtime registry and adapter health preflight",
    providerCallsMade: false,
  }),
}));
