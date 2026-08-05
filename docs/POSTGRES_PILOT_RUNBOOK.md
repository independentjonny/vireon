# PostgreSQL Persistence Pilot Runbook

Status: prepared, but not validated against real PostgreSQL infrastructure in the current environment.

Latest execution attempt, 2026-07-19: blocked at preflight. `npm run postgres:pilot:diagnose` reported no `VIREON_PILOT_DATABASE_URL`, no `VIREON_PILOT_RESTORE_DATABASE_URL`, `VIREON_PERSISTENCE_MODE=local`, and no local `psql`, `pg_dump`, `pg_restore` or Docker tooling. Real migration, RLS, backup, restore, outage and post-restore validation must not be marked complete until disposable PostgreSQL infrastructure and client tooling are available.

Provisioning handoff: use `docs/POSTGRES_PILOT_PROVISIONING.md` to configure the migration URL, restore URL and passwords, then run the canonical PostgreSQL pilot commands.

## Purpose

Prove Vireon's production data architecture in disposable non-production PostgreSQL infrastructure using synthetic pilot users only.

Pilot scope:

- Financial Vault facts and evidence
- Decisions and decision history
- Action Workflows and outcome verification
- Timeline events
- Calculation snapshots

Out of scope for this pilot:

- AI CFO history
- Daily Review persistence
- Digital Twin scenario persistence
- Housing, investments, goals and reports persistence
- Real customer financial data

## Required Environment

Set up a disposable database isolated from production and developer personal data.

Required:

- PostgreSQL with SSL where supported
- migration owner account
- least-privilege application account
- `VIREON_PILOT_DATABASE_URL` available only in local/private environment variables
- `VIREON_PILOT_RESTORE_DATABASE_URL` pointing at a separate restore target
- `VIREON_PILOT_MIGRATION_DATABASE_URL` using the migration-owner role
- `VIREON_PILOT_APPLICATION_ROLE_PASSWORD` set only in the operator shell while provisioning or rotating `vireon_app`
- `VIREON_PERSISTENCE_MODE=postgres-pilot` for pilot dual-run
- `VIREON_PERSISTENCE_MODE=postgres-required` for production-like validation
- `VIREON_SYNTHETIC_DATA_ONLY=true`

Never commit credentials.

Canonical operator sequence:

```bash
npm run postgres:operator:preflight
npm run postgres:pilot:validate-targets
npm run postgres:pilot:bootstrap
$env:VIREON_PILOT_EXECUTE_CONFIRM = "APPLY_MIGRATIONS_TO_PILOT"
npm run postgres:pilot:execute
```

`postgres:operator:preflight` is a redacted readiness check for private-beta activation operators. It loads the repository's Next.js environment configuration, preserves existing process-environment precedence, and falls back to the Windows User environment for the allow-listed PostgreSQL variables used by the runtime layer. It prints variable names, PRESENT/MISSING status, source classification, target fingerprints, primary/restore separation, SSL mode, restricted runtime role identity and psql resolution. It must never print passwords, complete URLs or service credentials.

If the shell process does not already contain the PostgreSQL variables, hydrate only the allow-listed values from the Windows User environment before running live pilot commands:

```powershell
$names = @(
  "VIREON_PILOT_MIGRATION_DATABASE_URL",
  "VIREON_PILOT_RESTORE_DATABASE_URL",
  "VIREON_PILOT_APPLICATION_DATABASE_URL",
  "VIREON_PILOT_APPLICATION_ROLE_PASSWORD",
  "VIREON_PERSISTENCE_MODE",
  "VIREON_SYNTHETIC_DATA_ONLY",
  "VIREON_PSQL_PATH",
  "PSQL_PATH"
)
foreach ($name in $names) {
  if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
    $value = [Environment]::GetEnvironmentVariable($name, "User")
    if ($value) { [Environment]::SetEnvironmentVariable($name, $value, "Process") }
  }
}
npm run postgres:operator:preflight
npm run postgres:pilot:bootstrap
```

Rollback rehearsal requires a separate disposable restore project. Set `VIREON_PILOT_RESTORE_DISPOSABLE=true` only for a restore project that has been explicitly confirmed disposable, then clear that process variable after the rehearsal:

```powershell
$env:VIREON_PILOT_RESTORE_DISPOSABLE = "true"
npm run postgres:pilot:rollback-check
Remove-Item Env:\VIREON_PILOT_RESTORE_DISPOSABLE -ErrorAction SilentlyContinue
```

## Supabase Restore Target Setup

The primary pilot database and restore target must be separate Supabase projects. The restore target is used only to prove backup and restore capability before external beta activation.

Step 1: create a second Supabase project named something like:

```text
vireon-pilot-restore
```

Step 2: keep the restore project empty and disposable. Do not seed real users, production data or personal financial data.

Step 3: copy the restore project's Session Pooler connection string from Supabase.

Step 4: set the restore URL in the operator PowerShell session. This example is a placeholder only:

```powershell
$env:VIREON_PILOT_RESTORE_DATABASE_URL = '<restore-session-pooler-url>?sslmode=require'
```

Step 5: verify the primary and restore project references differ:

```powershell
npm run postgres:pilot:validate-targets
```

Step 6: run bootstrap:

```powershell
npm run postgres:pilot:bootstrap
```

PowerShell URL handling rules:

- Wrap PostgreSQL URLs in single quotes.
- URL-encode special password characters before placing them in a URL.
- Do not paste angle brackets from placeholder examples.
- Do not execute a PostgreSQL URL directly in PowerShell.
- Use the Supabase Session Pooler connection string.
- Include `sslmode=require` or `sslmode=verify-full`.
- Do not print, screenshot or commit connection strings or passwords.

`postgres:pilot:bootstrap` verifies tooling, repairs PATH for the default Windows PostgreSQL 18 client-tools location when possible, validates URLs, DNS, SSL, pooler/project references, restore separation, migration/restore connectivity and restore disposability, provisions `vireon_app`, verifies the role, runs preflight and prints a PostgreSQL Pilot Health Report.

Bootstrap is valid against an empty primary database. Its role verification phase checks only pre-migration requirements: application-role login, restricted role flags, SSL, schema usage and prohibited administrative operations. It does not query runtime tables such as `public.users` before migrations exist. On a fresh database the expected bootstrap migration status is `MIGRATIONS_PENDING`, with `postMigrationRuntimeVerification` reported as `NOT_RUN`.

`postgres:pilot:execute` requires successful bootstrap/preflight and typed operator confirmation before applying migrations sequentially. It stops on the first error, records real migration checksums in `schema_migrations` only after each migration completes, reconciles least-privilege runtime grants, runs `npm run postgres:pilot:verify-runtime-access`, and performs the backup/restore rehearsal through `npm run postgres:pilot:rollback-check`.

`postgres:pilot:rollback-check` validates backup and restore capability without rolling back the primary pilot database. When no backup file is supplied, it creates a temporary schema-only custom backup of the Vireon application schema only (`public`), blocks backups containing Supabase-managed schemas, restores the application schema into the separate restore project, restores the `schema_migrations` metadata rows needed to prove the migrated application state, verifies those rows against the manifest, and removes the temporary local backup artifact.

PowerShell password setup without printing the secret:

```powershell
$secure = Read-Host -AsSecureString "vireon_app password"
$env:VIREON_PILOT_APPLICATION_ROLE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringUni(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
)
```

Bootstrap and execute construct the Supabase session pooler application URL automatically when the migration URL uses the Supabase pooler. The URL is passwordless; restricted-role verification passes the application password only through child-scoped `PGPASSWORD`. For project `bppepkgndukvggggokzy`, the routed connection username is `vireon_app.bppepkgndukvggggokzy`.

Only continue when bootstrap reports `PASS` with no blocked requirements. On an empty pilot database this is expected to include `migrationStatus=MIGRATIONS_PENDING` and `postMigrationRuntimeVerification=NOT_RUN`.

## Pilot Users

Use synthetic users only:

- `pilot-user-a`
- `pilot-user-b`
- `system-test-user`

The pilot repository layer rejects non-synthetic identities during pilot-only operations.

## Migration

Apply through the gated execution command only:

```powershell
npm run postgres:pilot:execute:preflight
$env:VIREON_PILOT_EXECUTE_CONFIRM = "APPLY_MIGRATIONS_TO_PILOT"
npm run postgres:pilot:execute
```

Execution must be run in this order:

```powershell
npm run postgres:pilot:validate-targets
npm run postgres:pilot:bootstrap
npm run postgres:pilot:execute:preflight
$env:VIREON_PILOT_EXECUTE_CONFIRM = "APPLY_MIGRATIONS_TO_PILOT"
npm run postgres:pilot:execute
```

`postgres:pilot:execute` applies, in order:

1. `migrations/0001_production_data_integrity.sql`
2. `migrations/0002_private_beta_foundation.sql`
3. `migrations/0003_supabase_private_beta_security.sql`

`0001` creates `schema_migrations`. The execution command, not the SQL files, records:

- migration ID
- checksum
- applied time
- duration
- executor
- success/failure
- error details
- correlation ID

Modified already-applied migrations must be refused by checksum verification. Add a new migration instead.

`0003_supabase_private_beta_security.sql` completes the private-beta security boundary before `vireon-pilot` is used for external beta verification. It enables and forces RLS on `private_beta_onboarding`, `private_beta_feedback`, `private_beta_deletion_requests`, `private_beta_audit_events` and `private_beta_feature_flags`.

The selected application-table identity model remains the existing PostgreSQL session setting:

```sql
current_setting('app.current_user_id', true)
```

The PostgreSQL pilot repository sets that value before queries. Do not replace these application-table policies with `auth.uid()` unless those tables are later queried directly through a Supabase browser client.

Private-beta audit events are append-only. Ordinary scoped users may insert their own audit event records and read their own records, but there are no ordinary update or delete policies. Feature flags are readable to scoped application sessions but have no ordinary insert, update or delete policies.

Financial-document storage is server-only for this pilot. `0003` creates or hardens a private Supabase Storage bucket named `financial-documents` when the Supabase `storage.buckets` table exists, but it intentionally creates no browser-facing `storage.objects` policies. Server object paths must be user scoped:

```text
users/{userId}/financial-documents/{unpredictableObjectId}/{safeFileName}
```

Anonymous storage access and cross-user storage access must be proven by remote rehearsal before first-user approval.

## Reset

Disposable reset only:

1. Export pilot diagnostics and gate status.
2. Drop the disposable pilot database or schema.
3. Recreate with the migration owner.
4. Reapply migrations.
5. Seed only synthetic pilot users.

Do not reset any shared or production database.

## Migration Tool Flow

1. Discover supported local records.
2. Validate schema.
3. Produce preview with records to create, conflicts, skipped records and unsupported fields.
4. Require explicit execution.
5. Import using idempotency keys.
6. Verify counts and hashes.
7. Generate migration report.
8. Retain rollback manifest.

Guardrails:

- Do not overwrite higher-confidence verified facts.
- Do not duplicate decisions or timeline events.
- Do not modify legacy source files.
- Do not report success when verification differs.

## Backup

Create a real non-production application-schema backup:

```bash
pg_dump --format=custom --schema-only --schema=public --no-owner --no-privileges --file pilot-backup.dump "$VIREON_PILOT_DATABASE_URL"
```

Record:

- backup timestamp
- schema version
- database size
- checksum
- encryption status
- storage location
- retention period
- responsible process

The schema-only backup intentionally does not contain table data. The rollback check restores only application schema objects from the backup, then restores the `schema_migrations` metadata rows from the primary pilot database so the restored target can prove the exact migrated application state without copying customer records. Backup is not proven until it is restored and verified. The execution command runs the repository rollback-check after post-migration verification; `npm run postgres:pilot:rollback-check` may also be rerun independently for evidence capture.

Do not use a full Supabase project dump for this pilot rollback rehearsal. Supabase-managed schemas such as `auth`, `storage`, `realtime`, `extensions`, `vault` and `supabase_migrations` are provider infrastructure. The pilot restore rehearsal must prove that Vireon's application schema and migration metadata can be restored into a clean Supabase project without replacing managed platform objects.

## Credential Rotation

Rotate the restricted application role password when pilot reports, terminal scrollback or operator evidence may have exposed credential material, or as part of normal pilot maintenance.

PowerShell sequence:

```powershell
$secure = Read-Host -AsSecureString "new vireon_app password"
$env:VIREON_PILOT_APPLICATION_ROLE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringUni(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
)
npm run postgres:pilot:bootstrap
npm run postgres:pilot:rollback-check
```

Rules:

- Do not print the password or paste it into documentation, tickets or screenshots.
- Do not store the password in source, fixtures, snapshots or generated artefacts.
- Confirm reports show only `VIREON_PILOT_APPLICATION_ROLE_PASSWORD`, `passwordSource=environment`, credential transport, and SHA-256 fingerprint prefixes.
- Confirm provisioning and verifier password fingerprints match before accepting runtime verification.
- Preserve the post-rotation bootstrap and rollback-check reports as pilot evidence.

## Restore Drill

Restore into a separate clean database:

```bash
pg_restore --clean --if-exists --schema=public --no-owner --no-privileges --dbname "$VIREON_PILOT_RESTORE_DATABASE_URL" pilot-backup.dump
```

Verify:

- schema version
- row counts
- user isolation
- fact history
- decision history
- workflow outcomes
- timeline integrity
- calculation snapshot hashes
- audit records

Run repository tests against the restored database.

## Corruption Recovery Drill

Synthetic data only:

1. Corrupt or remove one non-critical pilot record.
2. Detect inconsistency through hash/reference checks.
3. Recover from audit or restored backup where supported.
4. Verify references.
5. Record incident timeline and remediation.

## Outage Smoke

Simulate:

- connection refused
- connection timeout
- transaction timeout
- database restart
- partial network interruption
- read failure
- write failure

Expected behaviour:

- no fallback to demo data
- no false empty state
- no "No material changes" result
- safe user-facing error
- retry only where idempotent
- correlation ID present
- no duplicate writes after recovery

## Readiness Gates

Pilot Ready requires all gates to pass:

1. Schema: migration applied and checksum verified.
2. Repositories: contract tests pass.
3. Isolation: application and RLS tests pass.
4. Migration: dry run and import verification pass.
5. Transactions: rollback injection tests pass.
6. Backup: backup created and validated.
7. Recovery: restore drill passes.
8. Export and deletion: synthetic-user tests pass.
9. Outage behaviour: safe failure tests pass.
10. Dual-run consistency: no unresolved material differences.

## Troubleshooting

- Missing `psql` or `pg_dump`: install PostgreSQL client tools or use managed provider tooling.
- `postgres-required` fails: expected if `VIREON_PILOT_DATABASE_URL` is absent; this mode must not fall back.
- RLS failures: verify `app.current_user_id` is set per connection and that application role cannot bypass RLS.
- Migration checksum conflict: do not edit an applied migration; create a new one.
- Backup passes but restore fails: gate 7 remains failed and the pilot is not ready.

## Current Environment Note

At the time this runbook was added, the local Codex environment had no `psql`, no `pg_dump`, no Docker, and no `VIREON_PILOT_DATABASE_URL`. Real migration, backup and restore gates therefore remain blocked until disposable PostgreSQL infrastructure is provided.
