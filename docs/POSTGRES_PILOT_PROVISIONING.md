# PostgreSQL Pilot Provisioning

Status: PostgreSQL persistence pilot blocked pending real non-production infrastructure and PostgreSQL client tooling.

This pack prepares a developer to provision the missing disposable PostgreSQL infrastructure and then resume the real pilot with synthetic data only. It does not validate the database and does not pass any readiness gate by itself.

## 1. Choose Infrastructure Path

Preferred: managed PostgreSQL.

Use a managed non-production PostgreSQL service for the real pilot. Create separate primary and restore databases, enable SSL, use synthetic data only, and keep the environment isolated from production and personal developer data.

Alternative: local PostgreSQL on Windows.

Install PostgreSQL for Windows with Command Line Tools enabled. Confirm `psql`, `pg_dump` and `pg_restore` are on `PATH`. Create isolated pilot databases that are separate from any personal development databases.

Optional: Docker PostgreSQL.

Use Docker only when Docker Desktop is already installed and available. Use separate primary and restore containers or separate databases inside one disposable instance. Do not use Docker as a substitute for the final managed-pilot path if managed infrastructure is required by the team.

## 2. Required Environment Variables

Set these in a private local shell, CI secret store or managed development environment. Never commit credentials.

```bash
VIREON_PILOT_DATABASE_URL="postgresql://vireon_app:<password>@<host>:5432/vireon_pilot?sslmode=require"
VIREON_PILOT_RESTORE_DATABASE_URL="postgresql://vireon_restore:<password>@<host>:5432/vireon_pilot_restore?sslmode=require"
VIREON_PILOT_MIGRATION_DATABASE_URL="postgresql://vireon_migration:<password>@<host>:5432/vireon_pilot?sslmode=require"
VIREON_PILOT_APPLICATION_DATABASE_URL="postgresql://vireon_app:<password>@<host>:5432/vireon_pilot?sslmode=require"
VIREON_PERSISTENCE_MODE="postgres-required"
VIREON_ENVIRONMENT="postgres-pilot-non-production"
VIREON_SYNTHETIC_DATA_ONLY="true"
VIREON_REQUIRE_SSL="true"
```

Placeholder examples only. Do not paste real passwords, hostnames or connection strings into documentation, source files, screenshots or issue comments.

## 3. Required Roles

Migration owner:

- may create and alter schema
- may manage migrations and RLS policies
- may grant application permissions
- is not used by the application at runtime

Application role:

- may use approved application tables
- cannot alter schema
- cannot bypass RLS
- cannot manage migrations
- is the role used by normal application execution
- must be named `vireon_app`

Restore role:

- limited to the restore target where practical
- used for restore drills and post-restore verification only

The application role is provisioned by the repository command below. Do not paste role passwords into SQL files, documentation, screenshots or shell history.

PowerShell secure password setup:

```powershell
$secure = Read-Host -AsSecureString "vireon_app password"
$env:VIREON_PILOT_APPLICATION_ROLE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringUni(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
)
```

Provision or rotate the restricted application role:

```powershell
npm run postgres:pilot:provision-roles
```

The command requires:

- `VIREON_PILOT_MIGRATION_DATABASE_URL`
- `VIREON_PILOT_APPLICATION_ROLE_PASSWORD`

It creates `vireon_app` only when absent, otherwise rotates its password, and enforces `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`. It grants:

- `CONNECT` on the pilot database
- `USAGE` on schema `public`
- runtime table privileges for Vireon objects only
- `USAGE, SELECT` on sequences
- default table and sequence privileges for future migration-created objects

It does not grant schema creation, role administration, database creation, ownership or RLS bypass.

Construct `VIREON_PILOT_APPLICATION_DATABASE_URL` without printing the password. For a direct PostgreSQL connection:

```powershell
$appHost = "<host>"
$appDatabase = "vireon_pilot"
$appUser = "vireon_app"
$appPasswordEscaped = [System.Uri]::EscapeDataString($env:VIREON_PILOT_APPLICATION_ROLE_PASSWORD)
$env:VIREON_PILOT_APPLICATION_DATABASE_URL = "postgresql://${appUser}:${appPasswordEscaped}@${appHost}:5432/${appDatabase}?sslmode=require"
Remove-Variable appPasswordEscaped
```

For the Supabase session pooler, use the pooler username format `vireon_app.<project-ref>`:

```powershell
$projectRef = "<project-ref>"
$poolerHost = "<region>.pooler.supabase.com"
$appUser = "vireon_app.$projectRef"
$appPasswordEscaped = [System.Uri]::EscapeDataString($env:VIREON_PILOT_APPLICATION_ROLE_PASSWORD)
$env:VIREON_PILOT_APPLICATION_DATABASE_URL = "postgresql://${appUser}:${appPasswordEscaped}@${poolerHost}:5432/postgres?sslmode=require"
Remove-Variable appPasswordEscaped
```

Verify the restricted role:

```powershell
npm run postgres:pilot:verify-role
```

Do not use a superuser for normal application execution. Managed providers may require a bootstrap administrator to create roles, but the application URL must use the least-privilege application role.

## 4. Required Databases

Create:

- `vireon_pilot`
- `vireon_pilot_restore`

Requirements:

- non-production
- synthetic data only
- separate from production and personal development databases
- explicit owner
- documented PostgreSQL version
- reset procedure recorded in the runbook

## 5. Client Tool Verification

Run:

```bash
npm run postgres:pilot:tooling
```

It reports:

- `psql` path and version
- `pg_dump` path and version
- `pg_restore` path and version
- actionable installation guidance when missing

It returns non-zero when required tooling is absent.

## 5A. Canonical Pilot Commands

After the operator has configured the migration and restore database URLs, the normal setup path is:

```powershell
npm run postgres:pilot:validate-targets
npm run postgres:pilot:bootstrap
npm run postgres:pilot:execute
npm run postgres:pilot:rollback-check
```

`postgres:pilot:validate-targets` checks `VIREON_PILOT_MIGRATION_DATABASE_URL` and `VIREON_PILOT_RESTORE_DATABASE_URL` before bootstrap. It validates URL parsing, SSL mode, Supabase project-reference separation, target reachability and restore-target disposability. Output is redacted metadata only; it does not print full URLs, usernames or passwords.

For Supabase, the restore URL must come from a second empty project such as `vireon-pilot-restore`. Use that project's Session Pooler connection string and add `sslmode=require` or `sslmode=verify-full`. The primary and restore URLs may share the Supabase pooler hostname, but their derived project references must differ.

The bootstrap command:

1. reads `VIREON_PILOT_APPLICATION_ROLE_PASSWORD` from the environment or prompts with `Read-Host -AsSecureString` in an interactive PowerShell session
2. provisions or rotates `vireon_app`
3. derives the Supabase project reference from `VIREON_PILOT_MIGRATION_DATABASE_URL`
4. derives the pooler host from `VIREON_PILOT_MIGRATION_DATABASE_URL` when the migration URL already uses the Supabase pooler
5. constructs `VIREON_PILOT_APPLICATION_DATABASE_URL` in memory with a URL-encoded password
6. verifies the restricted role
7. runs preflight
8. prints a final PASS/FAIL PostgreSQL Pilot Health Report without printing passwords

Required before running bootstrap:

- `VIREON_PILOT_MIGRATION_DATABASE_URL`
- `VIREON_PILOT_RESTORE_DATABASE_URL`

If `VIREON_PILOT_RESTORE_DATABASE_URL` is missing, bootstrap fails before provisioning and reports that a separate restore database must be configured. It does not write passwords to disk and does not persist the generated application connection string outside the child process environment.

If bootstrap reports that the restore target uses the same Supabase project reference as the primary target, create a second empty Supabase restore project, set `VIREON_PILOT_RESTORE_DATABASE_URL`, then run:

```powershell
npm run postgres:pilot:validate-targets
```

`postgres:pilot:execute` applies migrations sequentially only after bootstrap/preflight pass and the operator sets the typed confirmation value:

```powershell
$env:VIREON_PILOT_EXECUTE_CONFIRM = "APPLY_MIGRATIONS_TO_PILOT"
npm run postgres:pilot:execute
```

`postgres:pilot:rollback-check` verifies backup and restore capability without performing a rollback. Provide either a local backup file marker or managed-provider confirmation:

```powershell
$env:VIREON_PILOT_BACKUP_FILE = "<path-to-non-production-backup.dump>"
# or
$env:VIREON_PILOT_MANAGED_BACKUP_CONFIRMED = "true"
npm run postgres:pilot:rollback-check
```

## 6. Environment Verification

Run:

```bash
npm run postgres:pilot:diagnose
```

It reports, without printing passwords or full connection strings:

- required URL presence
- persistence mode
- primary reachability
- restore reachability
- SSL status
- application-role privileges
- migration-role privileges
- schema version
- synthetic-data mode
- client-tool status

This command is non-mutating and safe for troubleshooting. It may exit 0 while still reporting blocked requirements.

## 7. Provisioning Checklist

1. Choose infrastructure path. Managed PostgreSQL is preferred.
2. Create the primary pilot database and a separate restore database/project.
3. Set `VIREON_PILOT_MIGRATION_DATABASE_URL`.
4. Set `VIREON_PILOT_RESTORE_DATABASE_URL`.
5. Set `VIREON_PILOT_APPLICATION_ROLE_PASSWORD`, or let bootstrap prompt in an interactive PowerShell session.
6. Run `npm run postgres:pilot:bootstrap`.
7. Set `VIREON_PILOT_EXECUTE_CONFIRM=APPLY_MIGRATIONS_TO_PILOT`.
8. Run `npm run postgres:pilot:execute`.
9. Provide backup evidence through `VIREON_PILOT_BACKUP_FILE` or `VIREON_PILOT_MANAGED_BACKUP_CONFIRMED=true`.
10. Run `npm run postgres:pilot:rollback-check`.

## 8. Handoff Preflight

Run:

```bash
npm run postgres:pilot:bootstrap
```

Bootstrap includes the preflight and verifies that `VIREON_PILOT_APPLICATION_DATABASE_URL` uses the restricted `vireon_app` role. For the Supabase session pooler, the expected username is `vireon_app.<project-ref>`, not `postgres.<project-ref>`.

The command runs tooling verification, environment validation, database connectivity checks, role validation, restore-target validation and safety checks.

It ends with one of:

```text
READY TO EXECUTE REAL POSTGRESQL PILOT
```

or:

```text
POSTGRESQL PILOT BLOCKED
```

Preflight fails when:

- URLs are missing
- primary and restore URLs point to the same database
- environment appears to be production
- synthetic-data mode is not enabled
- application role can bypass RLS
- application role can alter schema
- required tooling is missing
- SSL is required but unavailable
- persistence mode is not `postgres-required`

## 9. Resume Instructions

After preflight prints `READY TO EXECUTE REAL POSTGRESQL PILOT`, resume with:

```text
Execute PostgreSQL Persistence Pilot v1
```

Validation sequence:

1. `npm run postgres:pilot:diagnose`
2. migration dry run
3. migration apply
4. migration rerun
5. PostgreSQL repository contract suite
6. application isolation suite
7. RLS suite
8. rollback injection suite
9. idempotency suite
10. concurrency suite
11. migration pilot
12. dual-run comparison
13. export test
14. deletion test
15. backup creation
16. restore drill
17. post-restore repository suite
18. outage tests
19. `npm run validate`
20. `npx playwright test`
21. desktop and mobile Production Readiness smoke

Do not mark any readiness gate as passed until the corresponding check runs successfully against real non-production PostgreSQL infrastructure.
