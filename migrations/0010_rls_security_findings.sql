-- Vireon RLS security findings remediation.
-- Purpose: resolve Supabase public-table RLS warnings without changing application behavior.
-- Rollback/recovery: disable private-beta activation, review policies, then drop the
-- policies below or restore from the last verified schema backup if runtime access is
-- unexpectedly affected. This migration is additive and does not drop data or columns.

-- users is user-owned application state. Runtime access is limited to the
-- authenticated user id set transaction-locally by the server runtime.
drop policy if exists users_select_own_runtime on public.users;
drop policy if exists users_insert_own_runtime on public.users;
drop policy if exists users_update_own_runtime on public.users;

create policy users_select_own_runtime on public.users
  for select
  to vireon_app
  using (id = nullif(current_setting('app.current_user_id', true), '')::uuid);

create policy users_insert_own_runtime on public.users
  for insert
  to vireon_app
  with check (id = nullif(current_setting('app.current_user_id', true), '')::uuid);

create policy users_update_own_runtime on public.users
  for update
  to vireon_app
  using (id = nullif(current_setting('app.current_user_id', true), '')::uuid)
  with check (id = nullif(current_setting('app.current_user_id', true), '')::uuid);

alter table public.users enable row level security;
alter table public.users force row level security;

-- schema_migrations is operational metadata. It contains migration ids,
-- checksums and redacted failure details, not user financial records.
-- Runtime reads are permitted only for the restricted application role so
-- health/readiness checks can verify schema state. Runtime writes remain
-- blocked because no insert/update/delete policy is defined.
drop policy if exists schema_migrations_runtime_read on public.schema_migrations;

create policy schema_migrations_runtime_read on public.schema_migrations
  for select
  to vireon_app
  using (true);

comment on policy schema_migrations_runtime_read on public.schema_migrations is
  'Restricted vireon_app read-only access to non-user migration metadata for health/readiness checks. No runtime write policy exists.';

alter table public.schema_migrations enable row level security;

-- private_beta_migration_status is private-beta operational metadata.
-- Runtime reads are permitted only for the restricted application role.
-- Runtime writes remain blocked because no insert/update/delete policy is defined.
drop policy if exists private_beta_migration_status_runtime_read on public.private_beta_migration_status;

create policy private_beta_migration_status_runtime_read on public.private_beta_migration_status
  for select
  to vireon_app
  using (true);

comment on policy private_beta_migration_status_runtime_read on public.private_beta_migration_status is
  'Restricted vireon_app read-only access to non-user private-beta migration metadata. No runtime write policy exists.';

alter table public.private_beta_migration_status enable row level security;

insert into public.private_beta_migration_status (version, status, checksum)
values ('0010_rls_security_findings', 'applied', 'rls-security-findings-v1')
on conflict (version) do update set status = excluded.status, checksum = excluded.checksum, applied_at = now();
