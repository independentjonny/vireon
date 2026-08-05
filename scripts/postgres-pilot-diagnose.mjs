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
  probeDatabase("application-role-primary", process.env.VIREON_PILOT_APPLICATION_DATABASE_URL, tooling),
];
const preflight = evaluatePreflight({ env, tooling, probes });

console.log(JSON.stringify({
  ok: true,
  readyForRealPilot: preflight.ready,
  env,
  tooling,
  databases: probes,
  blockedGates: preflight.ready ? [] : ["schema", "isolation", "migration-apply", "backup", "restore"],
  blockedRequirements: preflight.blocked,
  warnings: preflight.warnings,
  note: preflight.ready
    ? "Disposable PostgreSQL pilot preflight appears ready. Proceed with real synthetic-data pilot validation."
    : "Real PostgreSQL pilot gates remain blocked until all required infrastructure, roles, tooling and safety settings are available.",
}, null, 2));

process.exit(0);
