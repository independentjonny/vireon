# ADR-0001: PostgreSQL Pilot v1

Date: 2026-07-31

Status: Accepted and frozen

## Context

Vireon needs a repeatable way to apply Supabase PostgreSQL migrations, verify least-privilege runtime access, and prove that database state can be backed up and restored without replacing Supabase-managed infrastructure.

Previous pilot work established bootstrap, role provisioning, migration execution, post-migration verification, public-schema-only backup, disposable restore rehearsal and bounded authentication propagation retry.

## Decision

Adopt PostgreSQL Pilot v1 as the standard migration safety platform for Vireon.

PostgreSQL Pilot v1 is frozen as production infrastructure. Future changes are limited to bug fixes, PostgreSQL version upgrades, Supabase compatibility fixes and security fixes unless a production issue requires architectural redesign.

## Consequences

- Every migration must pass bootstrap.
- Every migration must pass rollback rehearsal.
- Schema changes must preserve rollback capability.
- Runtime role verification remains mandatory.
- Managed Supabase schemas remain excluded.
- The public schema remains the only application-owned schema.
- The restricted runtime role `vireon_app` must not receive superuser, database creation, role creation, schema creation or RLS bypass privileges.
- Migration history must remain preserved through `schema_migrations`.
- Application persistence work moves to Phase 2 and must build on the pilot rather than redesign it.

## Notes

The pilot uses separate primary and disposable restore Supabase projects, Session Pooler routing, SSL-required connections, secret-safe process diagnostics and child-scoped `PGPASSWORD` transport for PostgreSQL client authentication.
