# RC1 PostgreSQL Migration Checkpoint

Generated: 2026-08-05T07:23:32+10:00

## Result

`RC1_MIGRATIONS_APPLIED_AND_VERIFIED_REQUIRES_DEPLOYMENT_APPROVAL`

The ordered RC1 migrations were applied to the approved non-production Vireon pilot database and verified. No deployment, private-beta activation, invitations, live AI, Open Banking activation, real account deletion, commit, reset, clean, or publication action was performed.

## Approved Targets

- Primary pilot project reference: `bppepkgndukvggggokzy`
- Restore project reference: `bhnwokrddsacmgbpgzze`
- Primary and restore targets: different
- Restore target: explicitly approved as disposable
- Environment classification: `postgres-pilot-non-production`
- Synthetic data only: `true`
- SSL required: `true`
- Persistence mode: `postgres-required`

No credential values were printed or stored in this checkpoint.

## Applied Migrations

| Order | Migration ID | Checksum | Status |
| --- | --- | --- | --- |
| 9 | `0009_private_beta_activation_lifecycle` | `fdfeb8c51e76d664b6854322002790b7aa14c341b1431d935c3dee9e6e9e74d6` | Applied and recorded |
| 10 | `0010_rls_security_findings` | `29aeac32bfdc68ea06cf0db9465bcd909b5d49bd4740beaca825819dfff8c9ac` | Applied and recorded |

The normal ordered pilot execution command was used with `VIREON_PILOT_EXECUTE_CONFIRM=APPLY_MIGRATIONS_TO_PILOT`. Migrations were not manually marked as applied.

## Pre-Migration State

`schema_migrations` contained applied migrations `0001` through `0008`; migrations `0009` and `0010` were absent.

RLS status before application:

| Table | RLS enabled | FORCE RLS |
| --- | --- | --- |
| `public.users` | false | false |
| `public.schema_migrations` | false | false |
| `public.private_beta_migration_status` | false | false |

Relevant object counts before application:

| Object | Count |
| --- | ---: |
| `public.users` | 5 |
| `public.schema_migrations` | 8 |
| `public.private_beta_migration_status` | 7 |
| `public.background_jobs` | 0 |
| `public.data_exports` | 0 |
| `public.account_deletion_requests` | 0 |

Rollback readiness was checked before execution by the pilot tooling and later verified again by the rollback rehearsal.

## Post-Migration RLS State

| Table | RLS enabled | FORCE RLS |
| --- | --- | --- |
| `public.users` | true | true |
| `public.schema_migrations` | true | false |
| `public.private_beta_migration_status` | true | false |

Expected policies were present:

- `users_select_own_runtime`
- `users_insert_own_runtime`
- `users_update_own_runtime`
- `schema_migrations_runtime_read`
- `private_beta_migration_status_runtime_read`

No inappropriate unrestricted `USING (true)` policy was found on user-owned data.

## Grant Verification

The restricted runtime role `vireon_app` was verified as the active restricted role for runtime checks.

Expected access:

- `public.schema_migrations`: restricted `SELECT` only
- `public.private_beta_migration_status`: restricted `SELECT` only
- `public.users`: table grants remain available, but row access is constrained by forced RLS and transaction-local `app.current_user_id`
- lifecycle objects from migration `0009`: expected restricted runtime grants present

Forbidden access verified:

- `vireon_app` write to `schema_migrations`: blocked
- `vireon_app` write to `private_beta_migration_status`: blocked
- missing `app.current_user_id` user read: returns zero rows
- User A reading User B through `public.users`: returns zero rows
- User A updating User B through `public.users`: updates zero rows
- public/browser unrestricted policy exposure: none found

## Migration 0009 Verification

Activation lifecycle support was present for:

- `background_jobs`
- `data_exports`
- `account_deletion_requests`

Expected lifecycle columns were found, including application/user/workspace ownership, idempotency, timestamps, redacted error state, heartbeat/lock state where applicable, expiry/schedule state where applicable, and manifest/payload metadata.

No destructive export, deletion, or lifecycle action was executed.

## Migration 0010 Verification

Verified:

- `public.users` RLS enabled
- `public.users` FORCE ROW LEVEL SECURITY enabled
- transaction-local `app.current_user_id` scopes runtime reads
- missing user scope exposes no user rows
- User A cannot read or modify User B
- operational metadata tables permit restricted reads only
- operational metadata tables reject restricted-role writes
- no table became publicly accessible
- no inappropriate blanket policy was introduced on user-owned data

## Validation Results

| Check | Result | Notes |
| --- | --- | --- |
| focused migration/RLS tests | PASS | 29/29 for migration manifest and RLS/private-beta migration tests |
| focused runtime/security tests | PASS | 96/96 including role provisioning and PostgreSQL runtime security tests |
| auth/private-beta/security/integrity tests | PASS | 95/95 |
| live restricted-role verification | PASS | Required explicit `VIREON_PILOT_PSQL_COMMAND` because `psql` was not on PATH |
| `npm run typecheck` | PASS | Completed successfully |
| `npm run lint` | PASS | 29 pre-existing warnings, 0 errors |
| `npm run test` | PASS | 867/867 after rerun; one prior Windows `EBUSY` transient passed on targeted rerun |
| `npm run build` | PASS | Completed successfully |
| `npm run validate` | PASS | Completed successfully |
| `npm run postgres:pilot:bootstrap` | PASS | Completed successfully after migrations |
| `npm run postgres:pilot:rollback-check` | PASS | Completed successfully after migrations |
| task-scoped secret scan | PASS | 6 files scanned, 0 findings |

## Known Warnings

- `npm run lint` still reports 29 pre-existing warnings and 0 errors.
- Node emitted expected experimental/typeless module loader warnings during targeted tests.
- Pilot tooling reports storage policies are verified by migration/static checks rather than by the generic pilot executor.
- The first full test run hit a transient Windows file-lock `EBUSY` on `.tmp-financial-digital-twin-test.json`; the targeted test rerun passed 9/9 and the subsequent full test run passed 867/867.

## Tooling Note

The first pilot execution attempt passed but did not apply `0009` or `0010` because the canonical pilot migration manifest still ended at `0008`. A minimal manifest/test update was made so the approved normal ordered migration command could discover and apply the approved migrations. No authentication flow, RBAC logic, application persistence behavior, or product code was changed for this correction.

## Deployment Status

Deployment approval is still required. Private beta remains inactive.
