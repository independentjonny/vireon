import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  RESTORE_TARGET_NEXT_ACTION,
  buildApplicationDatabaseUrl,
  classifyPilotEnvironment,
  comparePostgresTargets,
  createPostgresPilotBootstrapPlan,
  createSafeUrlDiagnostic,
  deriveSupabasePoolerHost,
  deriveSupabaseProjectRef,
  evaluateRestoreDisposable,
  redactConnectionString,
  validatePilotDatabaseUrl,
  validatePilotTargets,
  validateRestoreTarget,
} from "../../src/lib/postgresPilotBootstrap.ts";

const liveShapedPrimaryUrl = "postgresql://postgres.bppepkgndukvggggokzy:primary-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
const liveShapedRestoreUrl = "postgresql://postgres.bhnwokrddsacmgbpgzze:restore-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";

test("PostgreSQL pilot bootstrap derives Supabase project ref from pooler username", () => {
  const migrationUrl = "postgresql://postgres.projectref:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require";
  assert.equal(deriveSupabaseProjectRef(migrationUrl), "projectref");
  assert.equal(deriveSupabasePoolerHost(migrationUrl), "aws-0-ap-southeast-2.pooler.supabase.com");
});

test("PostgreSQL pilot bootstrap derives Supabase project ref from direct database host", () => {
  const migrationUrl = "postgresql://postgres:secret@db.projectref.supabase.co:5432/postgres?sslmode=require";
  assert.equal(deriveSupabaseProjectRef(migrationUrl), "projectref");
  assert.equal(deriveSupabasePoolerHost(migrationUrl), null);
});

test("PostgreSQL pilot bootstrap constructs a passwordless application routing string", () => {
  const url = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres.projectref:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    applicationRolePassword: "pa ss:word/@!",
  });
  const parsed = new URL(url);
  assert.equal(decodeURIComponent(parsed.username), "vireon_app.projectref");
  assert.equal(parsed.password, "");
  assert.equal(parsed.hostname, "aws-0-ap-southeast-2.pooler.supabase.com");
  assert.equal(parsed.searchParams.get("sslmode"), "require");
  assert.equal(url.includes("pa%20ss"), false);
});

test("PostgreSQL pilot bootstrap uses direct vireon_app user when migration URL is not a Supabase pooler", () => {
  const url = buildApplicationDatabaseUrl({
    migrationDatabaseUrl: "postgresql://postgres:secret@db.projectref.supabase.co:5432/postgres?sslmode=require",
    applicationRolePassword: "secret",
  });
  assert.equal(decodeURIComponent(new URL(url).username), "vireon_app");
});

test("PostgreSQL pilot bootstrap blocks missing restore database configuration clearly", () => {
  const plan = createPostgresPilotBootstrapPlan({
    VIREON_PILOT_MIGRATION_DATABASE_URL: "postgresql://postgres.projectref:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "secret",
  });
  assert.equal(plan.ok, false);
  assert.ok(plan.blocked.some((item) => item.includes("missing VIREON_PILOT_RESTORE_DATABASE_URL")));
});

test("PostgreSQL pilot bootstrap validates URL format SSL and pooler hostname", () => {
  assert.equal(validatePilotDatabaseUrl("http://example.com/postgres", "primary").ok, false);
  assert.equal(validatePilotDatabaseUrl("postgresql://u:p@host/postgres", "primary").ok, false);
  const malformedPooler = validatePilotDatabaseUrl("postgresql://u.project:p@not-a-real-pooler.example.com/postgres?sslmode=require", "primary");
  assert.equal(malformedPooler.ok, false);
  const validPooler = validatePilotDatabaseUrl("postgresql://postgres.projectref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require", "primary");
  assert.equal(validPooler.ok, true);
  assert.equal(validPooler.pooler, true);
});

test("PostgreSQL pilot URL parser accepts postgresql scheme with additional query parameters", () => {
  const result = validatePilotDatabaseUrl(
    "postgresql://postgres.projectref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?application_name=vireon&sslmode=require&connect_timeout=10",
    "primary"
  );
  assert.equal(result.ok, true);
  assert.equal(result.protocol, "postgresql");
  assert.equal(result.sslmode, "require");
  assert.equal(result.hasQuery, true);
  assert.deepEqual(result.parsedQueryKeys, ["application_name", "sslmode", "connect_timeout"]);
});

test("PostgreSQL pilot URL parser accepts postgres scheme and verify-full SSL", () => {
  const result = validatePilotDatabaseUrl(
    "postgres://postgres.projectref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=verify-full",
    "primary"
  );
  assert.equal(result.ok, true);
  assert.equal(result.protocol, "postgres");
  assert.equal(result.sslmode, "verify-full");
});

test("PostgreSQL pilot URL parser handles mixed-case SSLMode query keys", () => {
  const result = validatePilotDatabaseUrl(
    "postgresql://postgres.projectref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?SSLMode=require",
    "primary"
  );
  assert.equal(result.ok, true);
  assert.equal(result.sslmode, "require");
  assert.equal(result.sslModeDetected, "require");
  assert.deepEqual(result.parsedQueryKeys, ["sslmode"]);
});

test("PostgreSQL pilot URL parser trims URLs and preserves URL-encoded passwords", () => {
  const result = validatePilotDatabaseUrl(
    "  postgresql://postgres.projectref:pa%20ss%3Aword%2F%40%21@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require  ",
    "primary"
  );
  assert.equal(result.ok, true);
  assert.equal(result.projectRef, "projectref");
  assert.equal(result.sslmode, "require");
});

test("PostgreSQL pilot environment classifier blocks only explicit production values", () => {
  assert.deepEqual(classifyPilotEnvironment("production").environmentClassification, "PRODUCTION");
  assert.equal(classifyPilotEnvironment("production").ok, false);
  assert.deepEqual(classifyPilotEnvironment("prod").environmentClassification, "PRODUCTION");
  assert.equal(classifyPilotEnvironment("prod").ok, false);
  assert.equal(classifyPilotEnvironment("postgres-pilot-non-production").ok, true);
  assert.equal(classifyPilotEnvironment("postgres-pilot-non-production").environmentClassification, "POSTGRES_PILOT_NON_PRODUCTION");
  assert.equal(classifyPilotEnvironment("non-production").ok, true);
  assert.equal(classifyPilotEnvironment("non-production").environmentClassification, "NON_PRODUCTION");
  assert.equal(classifyPilotEnvironment("not-production-but-unknown").ok, false);
  assert.equal(classifyPilotEnvironment(undefined).ok, false);
});

test("PostgreSQL pilot safe URL diagnostics contain no secrets or URL text", () => {
  const validation = validatePilotDatabaseUrl(
    "postgresql://postgres.projectref:secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?SSLMode=verify-full&connect_timeout=10",
    "primary"
  );
  const diagnostic = createSafeUrlDiagnostic(validation);
  assert.deepEqual(diagnostic, {
    protocol: "postgresql",
    host: true,
    projectRef: "projectref",
    hasQuery: true,
    parsedQueryKeys: ["sslmode", "connect_timeout"],
    sslModeDetected: "verify-full",
  });
  const output = JSON.stringify(diagnostic);
  assert.equal(output.includes("secret"), false);
  assert.equal(output.includes("postgresql://"), false);
  assert.equal(output.includes("postgres.projectref"), false);
});

test("PostgreSQL pilot bootstrap validates restore target separation", () => {
  const same = validateRestoreTarget({
    primaryUrl: "postgresql://postgres.projectref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    restoreUrl: "postgresql://postgres.projectref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
  });
  assert.equal(same.ok, false);
  assert.ok(same.blocked.some((item) => item.includes("same hostname and database")));
  assert.ok(same.blocked.some((item) => item.includes("same Supabase project reference")));

  const separate = validateRestoreTarget({
    primaryUrl: "postgresql://postgres.primaryref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    restoreUrl: "postgresql://postgres.restoreref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres_restore?sslmode=require",
  });
  assert.equal(separate.ok, true);
});

test("PostgreSQL pilot bootstrap accepts shared Supabase pooler host with different project references", () => {
  const result = validateRestoreTarget({
    primaryUrl: liveShapedPrimaryUrl,
    restoreUrl: liveShapedRestoreUrl,
  });
  assert.equal(result.ok, true);
  assert.equal(result.sameProject, false);
  assert.equal(result.sameLogicalDatabase, false);
  assert.equal(result.comparisonBasis, "Supabase pooler routed username project references");
});

test("PostgreSQL pilot target comparison handles pooler direct schemes encoded usernames and trimming", () => {
  const poolerDifferent = comparePostgresTargets({
    primaryUrl: liveShapedPrimaryUrl,
    restoreUrl: liveShapedRestoreUrl,
  });
  assert.equal(poolerDifferent.sameProject, false);
  assert.equal(poolerDifferent.sameLogicalDatabase, false);
  assert.equal(poolerDifferent.primary.connectionMode, "SUPABASE_POOLER");

  const poolerSame = comparePostgresTargets({
    primaryUrl: "postgres://postgres.projectref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?SSLMode=require",
    restoreUrl: " postgresql://postgres.projectref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require ",
  });
  assert.equal(poolerSame.sameProject, true);
  assert.equal(poolerSame.sameLogicalDatabase, true);

  const encodedUser = comparePostgresTargets({
    primaryUrl: "postgresql://postgres%2Eprimaryref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    restoreUrl: "postgresql://postgres%2Erestoreref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
  });
  assert.equal(encodedUser.sameProject, false);
  assert.equal(encodedUser.sameLogicalDatabase, false);

  const appRolePooler = comparePostgresTargets({
    primaryUrl: "postgresql://vireon_app.primaryref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    restoreUrl: "postgresql://vireon_app.restoreref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
  });
  assert.equal(appRolePooler.sameProject, false);
  assert.equal(appRolePooler.sameLogicalDatabase, false);

  const directDifferent = comparePostgresTargets({
    primaryUrl: "postgresql://postgres:p@db.primaryref.supabase.co:5432/postgres?sslmode=require",
    restoreUrl: "postgresql://postgres:p@db.restoreref.supabase.co:5432/postgres?sslmode=require",
  });
  assert.equal(directDifferent.sameProject, false);
  assert.equal(directDifferent.sameLogicalDatabase, false);
  assert.equal(directDifferent.comparisonBasis, "Supabase direct database endpoint project references");
});

test("PostgreSQL pilot target validation passes live-shaped synthetic pooler configuration", () => {
  const result = validatePilotTargets({
    primaryUrl: liveShapedPrimaryUrl,
    restoreUrl: liveShapedRestoreUrl,
    environment: "postgres-pilot-non-production",
    syntheticDataOnly: "true",
    requireSsl: "true",
    persistenceMode: "postgres-required",
  });
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.environmentClassification, "POSTGRES_PILOT_NON_PRODUCTION");
  assert.equal(result.diagnostics.sameProject, false);
  assert.equal(result.diagnostics.sameLogicalDatabase, false);
  assert.equal(JSON.stringify(result.diagnostics).includes("primary-secret"), false);
  assert.equal(JSON.stringify(result.diagnostics).includes("restore-secret"), false);
});

test("PostgreSQL pilot bootstrap reports same-project restore guidance without weakening the block", () => {
  const result = validateRestoreTarget({
    primaryUrl: "postgresql://postgres.projectref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    restoreUrl: "postgresql://postgres.projectref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres_restore?sslmode=require",
  });
  assert.equal(result.ok, false);
  assert.equal(result.sameProject, true);
  assert.equal(result.guidance?.primaryProjectRef, "projectref");
  assert.equal(result.guidance?.restoreProjectRef, "projectref");
  assert.equal(result.guidance?.nextAction, RESTORE_TARGET_NEXT_ACTION);
  assert.ok(result.blocked.some((item) => item.includes("same Supabase project reference")));
});

test("PostgreSQL pilot bootstrap rejects malformed restore URLs and missing SSL", () => {
  const malformed = validateRestoreTarget({
    primaryUrl: "postgresql://postgres.primaryref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    restoreUrl: "not a url",
  });
  assert.equal(malformed.ok, false);
  assert.ok(malformed.blocked.some((item) => item.includes("malformed")));

  const missingSsl = validateRestoreTarget({
    primaryUrl: "postgresql://postgres.primaryref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    restoreUrl: "postgresql://postgres.restoreref:p@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres",
  });
  assert.equal(missingSsl.ok, false);
  assert.ok(missingSsl.blocked.some((item) => item.includes("sslmode=require")));
});

test("PostgreSQL pilot restore disposable check fails closed for non-empty unapproved targets", () => {
  const blocked = evaluateRestoreDisposable({ tableCount: 2, explicitlyDisposable: false });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.restoreDisposable, false);
  assert.ok(blocked.blocked.some((item) => item.includes("restore database is not empty")));

  const approved = evaluateRestoreDisposable({ tableCount: 2, explicitlyDisposable: true });
  assert.equal(approved.ok, true);
  assert.equal(approved.restoreDisposable, true);
  assert.ok(approved.warnings.some((item) => item.includes("explicitly marked disposable")));
});

test("PostgreSQL pilot validate-targets exits non-zero and redacts secrets on same-project failure", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--experimental-loader",
      "./scripts/ts-paths-loader.mjs",
      "scripts/postgres-pilot-validate-targets.mjs",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        VIREON_PILOT_MIGRATION_DATABASE_URL: "postgresql://postgres.projectref:primary-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
        VIREON_PILOT_RESTORE_DATABASE_URL: "postgresql://postgres.projectref:restore-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres_restore?sslmode=require",
      },
      timeout: 20_000,
    }
  );
  assert.notEqual(result.status, 0);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.ok(output.includes("\"status\": \"FAIL\""));
  assert.ok(output.includes("\"sameProject\": true"));
  assert.ok(output.includes(RESTORE_TARGET_NEXT_ACTION));
  assert.equal(output.includes("primary-secret"), false);
  assert.equal(output.includes("restore-secret"), false);
  assert.equal(output.includes("postgresql://"), false);
  assert.equal(output.includes("postgres.projectref"), false);
});

test("PostgreSQL pilot validate-targets prints safe URL diagnostics only in debug mode", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--experimental-loader",
      "./scripts/ts-paths-loader.mjs",
      "scripts/postgres-pilot-validate-targets.mjs",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        VIREON_DEBUG: "true",
        VIREON_PILOT_MIGRATION_DATABASE_URL: "postgresql://postgres.projectref:primary-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?SSLMode=require",
        VIREON_PILOT_RESTORE_DATABASE_URL: "postgresql://postgres.projectref:restore-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres_restore?sslmode=require",
      },
      timeout: 20_000,
    }
  );
  assert.notEqual(result.status, 0);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.ok(output.includes("\"diagnostics\""));
  assert.ok(output.includes("\"parsedQueryKeys\""));
  assert.ok(output.includes("\"sslModeDetected\": \"require\""));
  assert.equal(output.includes("primary-secret"), false);
  assert.equal(output.includes("restore-secret"), false);
  assert.equal(output.includes("postgresql://"), false);
});

test("PostgreSQL pilot bootstrap produces child env without writing or printing secrets", () => {
  const plan = createPostgresPilotBootstrapPlan({
    VIREON_PILOT_MIGRATION_DATABASE_URL: "postgresql://postgres.projectref:migration-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require",
    VIREON_PILOT_RESTORE_DATABASE_URL: "postgresql://postgres.restoreref:restore-secret@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres_restore?sslmode=require",
    VIREON_PILOT_APPLICATION_ROLE_PASSWORD: "application-secret",
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.childEnv.VIREON_PERSISTENCE_MODE, "postgres-required");
  assert.equal(plan.childEnv.VIREON_SYNTHETIC_DATA_ONLY, "true");
  assert.equal(plan.childEnv.VIREON_REQUIRE_SSL, "true");
  assert.equal(redactConnectionString(plan.childEnv.VIREON_PILOT_APPLICATION_DATABASE_URL)?.includes("application-secret"), false);
});
