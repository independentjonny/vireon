import { ExternalPrivateBetaDeployment } from "../src/lib/externalPrivateBetaDeployment.ts";

const urlArg = process.argv.find((arg) => arg.startsWith("--url="));
const baseUrl = (urlArg?.slice("--url=".length) || process.env.VIREON_REMOTE_BETA_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

if (!baseUrl) {
  const report = {
    status: "BLOCKED",
    blocked: true,
    reason: "VIREON_REMOTE_BETA_URL or --url is required. Local development readiness is not external PRIVATE_BETA evidence.",
  };
  console.log(JSON.stringify(report, null, 2));
  console.error("REMOTE_PRIVATE_BETA_VERIFICATION_BLOCKED");
  process.exit(1);
}

if (!baseUrl.startsWith("https://")) {
  const report = {
    status: "BLOCKED",
    blocked: true,
    reason: "Remote PRIVATE_BETA verification requires an HTTPS URL.",
    url: baseUrl,
  };
  console.log(JSON.stringify(report, null, 2));
  console.error("REMOTE_PRIVATE_BETA_VERIFICATION_BLOCKED");
  process.exit(1);
}

try {
  const response = await fetch(`${baseUrl}/api/production-readiness`, {
    headers: { accept: "application/json" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  const payload = response.ok ? await response.json() : { ok: false, status: response.status };
  const report = ExternalPrivateBetaDeployment.buildRemoteReadinessFromPayload({
    url: baseUrl,
    payload,
    httpsOk: response.url.startsWith("https://"),
    available: response.ok,
  });
  console.log(JSON.stringify({ status: report.passed ? "READY" : "BLOCKED", blocked: report.blocked, report }, null, 2));
  if (report.blocked) {
    console.error("REMOTE_PRIVATE_BETA_VERIFICATION_BLOCKED");
    process.exit(1);
  }
  console.log("REMOTE_PRIVATE_BETA_VERIFICATION_READY");
} catch (error) {
  console.log(JSON.stringify({
    status: "BLOCKED",
    blocked: true,
    reason: error instanceof Error ? error.message : "REMOTE_FETCH_FAILED",
    url: baseUrl,
  }, null, 2));
  console.error("REMOTE_PRIVATE_BETA_VERIFICATION_BLOCKED");
  process.exit(1);
}
