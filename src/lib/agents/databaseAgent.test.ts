import {
  databaseAgent,
  DatabaseAgentReport,
  DatabaseCheckResult,
  probeSupabaseConnection,
  SupabaseProbeResult,
} from "./databaseAgent";

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(label: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
      failed++;
    }
  }

  console.log("databaseAgent tests");

  const report: DatabaseAgentReport = await databaseAgent("self-test");

  assert("agent field is database-agent", report.agent === "database-agent");
  assert("status is complete or degraded", report.status === "complete" || report.status === "degraded");
  assert("task echoed back", report.task === "self-test");
  assert("storageMode is a string", typeof report.storageMode === "string");
  assert("schemaVersion present", typeof report.schemaVersion === "string" && report.schemaVersion.length > 0);
  assert("tables is a non-empty array", Array.isArray(report.tables) && report.tables.length > 0);
  assert("checks is an array", Array.isArray(report.checks));
  assert("recordCounts is an object", typeof report.recordCounts === "object" && report.recordCounts !== null);
  assert("generatedAt is ISO string", !isNaN(Date.parse(report.generatedAt)));

  const checkNames = report.checks.map((c: DatabaseCheckResult) => c.name);
  assert("Schema tables check present", checkNames.some((n) => n.includes("Schema tables")));
  assert("Transaction store check present", checkNames.some((n) => n.includes("Transaction store")));
  assert("Live database connectivity check present", checkNames.some((n) => n.includes("Live database")));
  assert("Supabase connection probe check present", checkNames.some((n) => n.includes("Supabase connection probe")));

  report.checks.forEach((c: DatabaseCheckResult) => {
    assert(
      `Check '${c.name}' has valid status`,
      c.status === "pass" || c.status === "warn" || c.status === "fail"
    );
  });

  // supabaseProbe field tests
  assert("supabaseProbe field present", typeof report.supabaseProbe === "object" && report.supabaseProbe !== null);
  assert("supabaseProbe.configured is boolean", typeof report.supabaseProbe.configured === "boolean");
  assert(
    "supabaseProbe.reachable is boolean or null",
    report.supabaseProbe.reachable === null || typeof report.supabaseProbe.reachable === "boolean"
  );
  assert(
    "supabaseProbe.latencyMs is number or null",
    report.supabaseProbe.latencyMs === null || typeof report.supabaseProbe.latencyMs === "number"
  );

  // probeSupabaseConnection direct tests
  console.log("\nprobeSupabaseConnection tests (unconfigured)");
  const probe: SupabaseProbeResult = await probeSupabaseConnection();
  assert("probe returns an object", typeof probe === "object" && probe !== null);
  assert("probe.configured is boolean", typeof probe.configured === "boolean");
  if (!probe.configured) {
    assert("unconfigured probe: reachable is null", probe.reachable === null);
    assert("unconfigured probe: latencyMs is null", probe.latencyMs === null);
    assert("unconfigured probe: error is null", probe.error === null);
  } else {
    assert("configured probe: reachable is boolean", typeof probe.reachable === "boolean");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
