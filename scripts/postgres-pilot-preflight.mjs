import {
  collectEnv,
  collectTooling,
  evaluatePreflight,
  probeDatabase,
} from "./postgres-pilot-checks.mjs";

const env = collectEnv();
const tooling = collectTooling();
const probes = [
  probeDatabase("primary", process.env.VIREON_PILOT_DATABASE_URL, tooling),
  probeDatabase("restore", process.env.VIREON_PILOT_RESTORE_DATABASE_URL, tooling),
  probeDatabase("migration-role-primary", process.env.VIREON_PILOT_MIGRATION_DATABASE_URL, tooling),
];
const result = evaluatePreflight({ env, tooling, probes });
const databaseProcessTimeline = probes.flatMap((probe) => probe.psqlAttempts || []);

console.log(result.status);
console.log(JSON.stringify({
  ready: result.ready,
  environment: env,
  diagnostics: result.diagnostics,
  tooling,
  databases: probes,
  databaseProcessTimeline,
  blockedRequirements: result.blocked,
  warnings: result.warnings,
  next: result.ready
    ? "Run: Execute PostgreSQL Persistence Pilot v1"
    : "Provision disposable PostgreSQL databases, roles, SSL/synthetic mode and required client tooling before rerunning this preflight.",
}, null, 2));

process.exit(result.ready ? 0 : 1);
