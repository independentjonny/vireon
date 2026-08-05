#!/usr/bin/env node
import { createHash } from "node:crypto";
import { loadRepositoryNextEnv, formatEnvDiagnostics, assertNoSecretValuesInDiagnostics } from "./load-next-env.mjs";
import {
  createRuntimeDatabaseConfigFromEnv,
  resolveRuntimeEnvValue,
  resolvePsqlExecutable,
  validateRuntimeDatabaseConfig,
} from "../src/server/db/postgresRuntime.ts";
import {
  comparePostgresTargets,
  parsePostgresTarget,
} from "../src/lib/postgresPilotBootstrap.ts";

const REQUIRED_NAMES = [
  "VIREON_PILOT_MIGRATION_DATABASE_URL",
  "VIREON_PILOT_RESTORE_DATABASE_URL",
  "VIREON_PILOT_APPLICATION_DATABASE_URL",
  "VIREON_PILOT_APPLICATION_ROLE_PASSWORD",
  "VIREON_PERSISTENCE_MODE",
  "VIREON_SYNTHETIC_DATA_ONLY",
  "VIREON_PSQL_PATH",
  "PSQL_PATH",
];

function fingerprint(value) {
  return value ? createHash("sha256").update(String(value)).digest("hex").slice(0, 12) : null;
}

function resolvedValue(name) {
  return resolveRuntimeEnvValue(name, process.env);
}

function resolvedSource(name) {
  if (typeof process.env[name] === "string" && process.env[name].trim().length > 0) return "process-or-repository-env";
  return resolvedValue(name) ? "windows-user-env" : "missing";
}

function presence(name) {
  const value = resolvedValue(name);
  return {
    name,
    status: typeof value === "string" && value.trim().length > 0 ? "PRESENT" : "MISSING",
    source: resolvedSource(name),
    fingerprint: fingerprint(value),
    valueLogged: false,
  };
}

const envReport = loadRepositoryNextEnv({ variableNames: REQUIRED_NAMES });
const runtimeConfig = createRuntimeDatabaseConfigFromEnv(process.env);
const runtimeValidation = validateRuntimeDatabaseConfig(runtimeConfig);
const primaryUrl = resolvedValue("VIREON_PILOT_MIGRATION_DATABASE_URL");
const restoreUrl = resolvedValue("VIREON_PILOT_RESTORE_DATABASE_URL");
const primary = parsePostgresTarget(primaryUrl, "VIREON_PILOT_MIGRATION_DATABASE_URL");
const restore = parsePostgresTarget(restoreUrl, "VIREON_PILOT_RESTORE_DATABASE_URL");
const comparison = comparePostgresTargets({ primaryUrl, restoreUrl });
const psqlExecutable = resolvePsqlExecutable({ env: process.env });

const report = {
  ok: runtimeValidation.ok && primary.ok && restore.ok && !comparison.sameProject && !comparison.sameLogicalDatabase,
  repositoryRoot: envReport.repoRoot,
  envLocalPath: envReport.envLocalPath,
  environmentSource: envReport.sourceLoaded,
  variables: REQUIRED_NAMES.map(presence),
  psqlExecutable,
  targets: {
    primary: {
      ok: primary.ok,
      host: primary.hostname,
      database: primary.database,
      projectRef: primary.projectRef,
      sslMode: primary.sslmode,
      fingerprint: fingerprint(`${primary.hostname}:${primary.database}:${primary.projectRef}`),
    },
    restore: {
      ok: restore.ok,
      host: restore.hostname,
      database: restore.database,
      projectRef: restore.projectRef,
      sslMode: restore.sslmode,
      fingerprint: fingerprint(`${restore.hostname}:${restore.database}:${restore.projectRef}`),
    },
    sameProject: comparison.sameProject,
    sameLogicalDatabase: comparison.sameLogicalDatabase,
  },
  runtime: {
    ok: runtimeValidation.ok,
    blocked: runtimeValidation.blocked,
    username: runtimeValidation.username,
    projectRef: runtimeValidation.projectRef,
    credentialTransport: runtimeValidation.credentialTransport,
    passwordInUrl: runtimeValidation.passwordInUrl,
  },
};

const text = [
  "PostgreSQL operator preflight",
  formatEnvDiagnostics(envReport),
  JSON.stringify(report, null, 2),
].join("\n");

assertNoSecretValuesInDiagnostics(text, process.env);
console.log(text);
process.exit(report.ok ? 0 : 1);
