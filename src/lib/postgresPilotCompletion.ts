import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";

export const POSTGRES_PILOT_EXECUTE_CONFIRMATION = "APPLY_MIGRATIONS_TO_PILOT";

export const POSTGRES_PILOT_MIGRATIONS = [
  "migrations/0001_production_data_integrity.sql",
  "migrations/0002_private_beta_foundation.sql",
  "migrations/0003_supabase_private_beta_security.sql",
  "migrations/0004_core_decisioning_persistence.sql",
  "migrations/0005_daily_review_append_only_history.sql",
  "migrations/0006_transactions_subscriptions_persistence.sql",
  "migrations/0007_private_beta_invitations.sql",
  "migrations/0008_private_beta_access_rls_hardening.sql",
  "migrations/0009_private_beta_activation_lifecycle.sql",
  "migrations/0010_rls_security_findings.sql",
] as const;

export type MigrationManifestItem = {
  id: string;
  path: string;
  checksum: string;
  canRunInTransaction: boolean;
  transactionNotes: string[];
};

export type RecordedMigration = {
  id: string;
  checksum: string;
  success: boolean;
};

export type CompletionEnv = Record<string, string | undefined>;

export type PilotHealthSection =
  | "PASS"
  | "FAIL"
  | "WARNING"
  | "NOT_RUN";

export type PilotHealthReport = {
  title: "PostgreSQL Pilot Health Report";
  status: "PASS" | "FAIL";
  tooling: PilotHealthSection;
  environment: PilotHealthSection;
  primaryDb: PilotHealthSection;
  restoreDb: PilotHealthSection;
  migrationRole: PilotHealthSection;
  applicationRole: PilotHealthSection;
  ssl: PilotHealthSection;
  rls: PilotHealthSection;
  schema: PilotHealthSection;
  storage: PilotHealthSection;
  migrationStatus: PilotHealthSection;
  warnings: string[];
  remainingRisks: string[];
  recommendedNextStep: string;
};

export function createPilotHealthReport(input: {
  passed: boolean;
  warnings?: string[];
  remainingRisks?: string[];
  migrationStatus?: PilotHealthSection;
  recommendedNextStep?: string;
}): PilotHealthReport {
  return {
    title: "PostgreSQL Pilot Health Report",
    status: input.passed ? "PASS" : "FAIL",
    tooling: input.passed ? "PASS" : "FAIL",
    environment: input.passed ? "PASS" : "FAIL",
    primaryDb: input.passed ? "PASS" : "FAIL",
    restoreDb: input.passed ? "PASS" : "FAIL",
    migrationRole: input.passed ? "PASS" : "FAIL",
    applicationRole: input.passed ? "PASS" : "FAIL",
    ssl: input.passed ? "PASS" : "FAIL",
    rls: input.passed ? "PASS" : "FAIL",
    schema: input.passed ? "PASS" : "FAIL",
    storage: "WARNING",
    migrationStatus: input.migrationStatus ?? (input.passed ? "PASS" : "FAIL"),
    warnings: input.warnings ?? [],
    remainingRisks: input.remainingRisks ?? ["Storage policies are verified by migration/static checks, not by postgres:pilot:execute."],
    recommendedNextStep: input.recommendedNextStep ?? (input.passed ? "Run rollback capability check before pilot execution evidence is accepted." : "Resolve failed checks and rerun bootstrap."),
  };
}

export function createMigrationExecutionPlan(env: CompletionEnv): { ok: boolean; blocked: string[]; migrations: readonly string[] } {
  const blocked: string[] = [];
  if (!env.VIREON_PILOT_MIGRATION_DATABASE_URL) blocked.push("missing VIREON_PILOT_MIGRATION_DATABASE_URL");
  if (!env.VIREON_PILOT_RESTORE_DATABASE_URL) blocked.push("missing VIREON_PILOT_RESTORE_DATABASE_URL");
  if (!env.VIREON_PILOT_APPLICATION_ROLE_PASSWORD) blocked.push("missing VIREON_PILOT_APPLICATION_ROLE_PASSWORD");
  if (env.VIREON_PILOT_EXECUTE_CONFIRM !== POSTGRES_PILOT_EXECUTE_CONFIRMATION) {
    blocked.push(`operator confirmation required: set VIREON_PILOT_EXECUTE_CONFIRM=${POSTGRES_PILOT_EXECUTE_CONFIRMATION}`);
  }
  for (const migration of POSTGRES_PILOT_MIGRATIONS) {
    if (!existsSync(migration)) blocked.push(`missing migration file: ${migration}`);
  }
  return { ok: blocked.length === 0, blocked, migrations: POSTGRES_PILOT_MIGRATIONS };
}

export function migrationIdFromPath(path: string): string {
  return basename(path).replace(/\.sql$/i, "");
}

export function createMigrationManifest(migrations: readonly string[] = POSTGRES_PILOT_MIGRATIONS): MigrationManifestItem[] {
  return migrations.map((path) => {
    const sql = readFileSync(path, "utf8");
    const nonTransactionalPatterns = [
      /create\s+database/i,
      /drop\s+database/i,
      /create\s+index\s+concurrently/i,
      /reindex\s+/i,
      /vacuum\s+/i,
    ];
    const transactionNotes = nonTransactionalPatterns
      .filter((pattern) => pattern.test(sql))
      .map((pattern) => `contains non-transactional pattern ${pattern}`);
    return {
      id: migrationIdFromPath(path),
      path,
      checksum: createHash("sha256").update(sql, "utf8").digest("hex"),
      canRunInTransaction: transactionNotes.length === 0,
      transactionNotes,
    };
  });
}

export function evaluateRecordedMigrations(input: {
  manifest: readonly MigrationManifestItem[];
  recorded: readonly RecordedMigration[];
}): {
  ok: boolean;
  blocked: string[];
  applied: MigrationManifestItem[];
  pending: MigrationManifestItem[];
  skipped: MigrationManifestItem[];
  unexpected: RecordedMigration[];
} {
  const blocked: string[] = [];
  const manifestById = new Map(input.manifest.map((item) => [item.id, item]));
  const recordedById = new Map(input.recorded.map((item) => [item.id, item]));
  const unexpected = input.recorded.filter((item) => !manifestById.has(item.id));
  if (unexpected.length > 0) blocked.push(`unexpected schema_migrations rows: ${unexpected.map((item) => item.id).join(", ")}`);

  for (const row of input.recorded) {
    if (!row.success) blocked.push(`previous migration failure recorded for ${row.id}`);
    const expected = manifestById.get(row.id);
    if (expected && expected.checksum !== row.checksum) {
      blocked.push(`checksum mismatch for previously recorded migration ${row.id}`);
    }
  }

  const applied: MigrationManifestItem[] = [];
  const pending: MigrationManifestItem[] = [];
  let seenPending = false;
  for (const item of input.manifest) {
    const row = recordedById.get(item.id);
    if (row?.success) {
      if (seenPending) blocked.push(`migration ordering problem: ${item.id} is applied after a pending earlier migration`);
      applied.push(item);
    } else {
      seenPending = true;
      pending.push(item);
    }
  }

  return {
    ok: blocked.length === 0,
    blocked,
    applied,
    pending,
    skipped: applied,
    unexpected,
  };
}

export function createRollbackCapabilityPlan(env: CompletionEnv): { ok: boolean; blocked: string[]; warnings: string[]; backupEvidence: "file" | "managed-provider" | null } {
  const blocked: string[] = [];
  const warnings: string[] = [];
  const backupFile = env.VIREON_PILOT_BACKUP_FILE;
  const managedBackup = env.VIREON_PILOT_MANAGED_BACKUP_CONFIRMED === "true";

  if (!env.VIREON_PILOT_DATABASE_URL && !env.VIREON_PILOT_MIGRATION_DATABASE_URL) blocked.push("missing primary database URL for pg_dump capability check");
  if (!env.VIREON_PILOT_RESTORE_DATABASE_URL) blocked.push("missing VIREON_PILOT_RESTORE_DATABASE_URL");
  if (!backupFile && !managedBackup) blocked.push("missing backup evidence: set VIREON_PILOT_BACKUP_FILE or VIREON_PILOT_MANAGED_BACKUP_CONFIRMED=true");
  if (backupFile && !existsSync(backupFile)) blocked.push("VIREON_PILOT_BACKUP_FILE does not exist");
  if (backupFile && managedBackup) warnings.push("Both backup file and managed-provider confirmation are set; backup file will be used for pg_restore --list.");

  return {
    ok: blocked.length === 0,
    blocked,
    warnings,
    backupEvidence: backupFile ? "file" : managedBackup ? "managed-provider" : null,
  };
}
