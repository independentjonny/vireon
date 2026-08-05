# PostgreSQL Pilot v1

Status: COMPLETE AND FROZEN

PostgreSQL Pilot v1 is Vireon's migration safety platform for Supabase PostgreSQL. It is treated as stable infrastructure for migration execution, restricted runtime-role verification and rollback rehearsal.

Future work is limited to bug fixes, PostgreSQL version upgrades, Supabase compatibility fixes and security fixes. Architectural redesign is frozen unless a production issue proves the current design is unsafe or unworkable.

## Architecture

The pilot uses two separate Supabase PostgreSQL projects:

- Primary pilot database: the migration target.
- Restore pilot database: an empty, disposable restore rehearsal target.

Both targets use Supabase Session Pooler connection strings with SSL required. The application-owned database surface is the `public` schema. Supabase-managed schemas are not application-owned and are excluded from backup and restore rehearsal.

The migration runner applies SQL files from `migrations/` in deterministic filename order. Applied migrations are tracked in `public.schema_migrations` with migration ID, checksum, execution metadata and success state.

## Security Model

The migration/admin connection is used only for schema changes, grant reconciliation, backup and restore rehearsal. Runtime application access uses the restricted login role `vireon_app`.

`vireon_app` must have:

- `LOGIN`
- `NOSUPERUSER`
- `NOCREATEDB`
- `NOCREATEROLE`
- `NOBYPASSRLS`
- no schema creation privilege
- only the table and sequence privileges required by Vireon runtime paths

Application row ownership is enforced through the repository identity model using `current_setting('app.current_user_id', true)` on application tables. Supabase Auth `auth.uid()` is not used for application-table policies unless a future direct-browser Supabase access path is explicitly implemented and reviewed.

For Supabase Session Pooler connections, the database role and routed username are distinct:

- database role: `vireon_app`
- pooler routed username: `vireon_app.<project-ref>`

Passwords are transported to PostgreSQL client processes through child-scoped `PGPASSWORD`; password-bearing application URLs are not passed to `psql` verification commands.

## Provisioning Flow

`npm run postgres:pilot:bootstrap` provisions or updates `vireon_app` idempotently:

1. Verifies PostgreSQL client tooling.
2. Validates environment, URL parsing, SSL and target separation.
3. Confirms primary and restore connectivity.
4. Confirms the restore target is empty or disposable.
5. Creates `vireon_app` when missing, or rotates its password when an existing role is already safe.
6. Refuses to repair an existing unsafe role with managed Supabase credentials.
7. Grants only runtime privileges.
8. Configures future default privileges for migration-created tables and sequences.
9. Runs pre-migration role verification.
10. Runs preflight and reports migration state.

An empty primary database is a valid bootstrap target. A fresh database should report `MIGRATIONS_PENDING` and `postMigrationRuntimeVerification: NOT_RUN`.

## Migration Flow

Migration execution is guarded by:

```powershell
$env:VIREON_PILOT_EXECUTE_CONFIRM = "APPLY_MIGRATIONS_TO_PILOT"
npm run postgres:pilot:execute
```

The execute command:

- requires a successful bootstrap/preflight state
- requires explicit operator confirmation
- applies pending migrations sequentially
- stops on the first SQL error
- records a migration as successful only after it fully completes
- blocks checksum mismatches, unexpected migration rows and partial migration state
- reconciles runtime grants
- runs post-migration runtime-role verification
- runs backup and restore rehearsal

The runtime role is never used to create or alter schema objects.

## Rollback and Restore Flow

Rollback capability is verified with:

```powershell
npm run postgres:pilot:rollback-check
```

The command does not perform production rollback. It verifies rollback readiness by creating a public-schema-only backup from the migrated primary pilot database and restoring it into the separate disposable restore project.

The restore rehearsal validates:

- primary and restore projects are different logical targets
- restore target remains disposable
- backup contains only Vireon-owned application schema content
- Supabase-managed schemas are excluded
- backup table-of-contents inspection passes
- `schema_migrations` history is preserved
- restored runtime grants are reconciled
- restored `vireon_app` can authenticate through the restore project's routed username
- required runtime tables, sequences, grants, RLS policies and append-only protections hold after restore

## Authentication Propagation Handling

Supabase Session Pooler authentication can briefly lag immediately after `CREATE ROLE` or `ALTER ROLE ... PASSWORD`. The pilot handles this as a bounded transient condition only for the first application-role login after provisioning or restore-role provisioning.

Retry policy:

- maximum attempts: 5
- delays: 0s, 1s, 2s, 3s, 4s
- maximum bounded wait: less than 15 seconds

Retries are limited to transient authentication/connectivity classifications such as immediate password-authentication propagation delay, connection reset, timeout, temporary pooler failure and temporary tenant-routing failure.

The pilot does not retry role-flag failures, permission failures after login, wrong identity, wrong project routing, missing runtime objects, incorrect grants, RLS failures, immutable-table enforcement failures or unexpected query output.

If a later attempt succeeds, the report includes a secret-safe warning such as `TRANSIENT_APPLICATION_ROLE_AUTHENTICATION_RECOVERED`.

## Grant Reconciliation

Grant reconciliation is performed by the migration/admin connection. It aligns existing and future runtime grants for `vireon_app` without granting ownership, schema creation, database creation, role administration or RLS bypass.

Runtime verification checks that the restricted role can perform intended application operations and cannot perform administrative operations or protected schema mutations.

## Managed-Schema Protections

Backups are restricted to application-owned `public` schema content. Restore rehearsal refuses backup table-of-contents entries that would attempt to replace Supabase-managed infrastructure such as auth, storage, realtime, extensions or platform-owned metadata.

The `financial-documents` Supabase Storage boundary remains private. Application document access is server-mediated, with no anonymous object access and no public application-directory storage.

## Operational Runbook

Normal operator sequence:

```powershell
npm run postgres:pilot:validate-targets
npm run postgres:pilot:bootstrap
npm run postgres:pilot:execute:preflight
$env:VIREON_PILOT_EXECUTE_CONFIRM = "APPLY_MIGRATIONS_TO_PILOT"
npm run postgres:pilot:execute
npm run postgres:pilot:rollback-check
npm run postgres:pilot:bootstrap
```

Use the final bootstrap rerun to confirm the migrated state reports `MIGRATIONS_APPLIED` and post-migration runtime verification passes.

Never run these commands with production targets, local fallback enabled, Open Banking enabled, live AI enabled or real customer seed data.

## Troubleshooting

- Same primary and restore project: create a separate empty Supabase restore project and rerun `npm run postgres:pilot:validate-targets`.
- Missing SSL: add `sslmode=require` or `sslmode=verify-full` to the relevant PostgreSQL URL.
- Role authentication fails immediately after provisioning: rerun the command after the bounded propagation window. Persistent failure requires password, routed username and project-ref review.
- Checksum mismatch: stop and investigate migration history before modifying migration files.
- Managed schema appears in backup TOC: stop and correct the backup filter before restore rehearsal.
- Missing `schema_migrations` after restore: stop and inspect the backup manifest and restore target before trusting rollback capability.

## Maintenance Guidance

- Keep migration files append-only after they have been applied to pilot.
- Any new migration must pass bootstrap, execute preflight, execution, post-migration runtime verification and rollback rehearsal.
- Do not broaden `vireon_app` privileges to make tests pass.
- Do not add Supabase-managed schemas to Vireon backups.
- Keep all reports and process timelines secret-safe.
- Treat golden migration checksums as release evidence.
- Use `docs/POSTGRES_PHASE2_ROADMAP.md` for application persistence rollout planning.
