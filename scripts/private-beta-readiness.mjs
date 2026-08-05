import { PrivateBetaFoundation } from "../src/lib/privateBetaFoundation.ts";

const report = PrivateBetaFoundation.buildPrivateBetaReadinessReport(PrivateBetaFoundation.configFromEnv());
console.log(JSON.stringify(report, null, 2));

if (report.deploymentBlocked) {
  console.error("PRIVATE_BETA_READINESS_BLOCKED");
  process.exitCode = 1;
} else {
  console.log("PRIVATE_BETA_READY");
}
