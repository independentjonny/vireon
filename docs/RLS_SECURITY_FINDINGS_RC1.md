# RLS Security Findings Remediation

Status: `MIGRATION_READY_REQUIRES_OPERATOR_APPLICATION`

Date: 2026-08-05

Input: Supabase report listing public tables where `rowsecurity = false`.

## Findings

| Table | RLS Finding | Decision | Reason |
| --- | --- | --- | --- |
| `public.users` | RLS disabled | Enable RLS and force RLS | User-owned identity mirror used by Vireon repositories. Reads/writes must be scoped to the authenticated server user. |
| `public.schema_migrations` | RLS disabled | Enable RLS with restricted read-only runtime policy | Operational migration metadata used by health/readiness tooling. Not user financial data, but should not be open to broad roles. Runtime writes are intentionally blocked. |
| `public.private_beta_migration_status` | RLS disabled | Enable RLS with restricted read-only runtime policy | Private-beta operational migration metadata. Runtime may inspect status, but writes should remain migration/operator-owned. |

All other reported tables already had RLS enabled.

## Policy Design

`public.users`:

- `SELECT`: restricted runtime role may read only `users.id = app.current_user_id`.
- `INSERT`: restricted runtime role may insert only its own authenticated user id.
- `UPDATE`: restricted runtime role may update only its own row.
- `DELETE`: no runtime policy.

`public.schema_migrations`:

- `SELECT`: restricted runtime role may read non-user operational metadata.
- `INSERT`, `UPDATE`, `DELETE`: no runtime policy.
- No `anon` or browser-authenticated policy.

`public.private_beta_migration_status`:

- `SELECT`: restricted runtime role may read non-user operational metadata.
- `INSERT`, `UPDATE`, `DELETE`: no runtime policy.
- No `anon` or browser-authenticated policy.

## Intentional `USING (true)` Use

`USING (true)` appears only on two metadata read policies and only for role `vireon_app`.

This is intentional because the rows are global operational migration metadata, not user-owned records. The policy is not public, not granted to `anon`, and not granted to direct browser clients. Runtime writes remain blocked.

## Application Behaviour

No authentication flow, API behavior or PostgreSQL repository code changed.

Existing server runtime code already sets `app.current_user_id` transaction-locally before inserting or reading `users`, so the `users` RLS policies preserve expected behavior while preventing cross-user access.

## Migration

Added:

- `migrations/0010_rls_security_findings.sql`

The migration is additive:

- no table drops
- no column drops
- no truncation
- no data rewrite beyond recording migration status
- no broad public policies

## Operator Notes

Apply after `0009_private_beta_activation_lifecycle.sql` if `0009` has not yet been applied.

After applying, verify:

1. Supabase RLS report no longer lists `users`, `schema_migrations` or `private_beta_migration_status`.
2. Login still succeeds.
3. Authenticated application access still succeeds.
4. Restricted runtime role can read migration metadata.
5. Restricted runtime role cannot write migration metadata.
6. Service-role/admin migration operations still work through the approved server-side path.
7. `npm run validate` passes.
