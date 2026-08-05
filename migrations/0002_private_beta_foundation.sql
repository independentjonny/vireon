-- Vireon Private Beta Foundation v1
-- Apply after 0001_production_data_integrity.sql.
-- Rollback: drop tables in reverse dependency order during a maintenance window.

create table if not exists private_beta_migration_status (
  version text primary key,
  applied_at timestamptz not null default now(),
  status text not null check (status in ('applied', 'rolled_back', 'failed')),
  checksum text not null
);

create table if not exists private_beta_onboarding (
  id text primary key,
  user_id text not null,
  household_id text not null,
  version text not null,
  steps jsonb not null,
  current_step text not null,
  consent jsonb not null,
  missing_information jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists private_beta_onboarding_owner_idx on private_beta_onboarding (user_id, household_id);

create table if not exists private_beta_feedback (
  id text primary key,
  user_id text not null,
  household_id text not null,
  type text not null,
  page text not null,
  feature text not null,
  description text not null,
  screenshot_attached boolean not null default false,
  diagnostic_reference text not null,
  application_version text not null,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists private_beta_feedback_owner_idx on private_beta_feedback (user_id, household_id, created_at desc);

create table if not exists private_beta_deletion_requests (
  id text primary key,
  user_id text not null,
  household_id text not null,
  requested_at timestamptz not null,
  status text not null check (status in ('requested', 'completed')),
  scheduled_deletion_after timestamptz not null,
  deleted_content_retained text not null
);

create index if not exists private_beta_deletion_owner_idx on private_beta_deletion_requests (user_id, household_id, requested_at desc);

create table if not exists private_beta_audit_events (
  id text primary key,
  user_id text not null,
  household_id text not null,
  event_type text not null,
  actor text not null,
  timestamp timestamptz not null,
  affected_resource text not null,
  outcome text not null,
  reference_id text not null,
  safe_metadata jsonb not null default '{}'::jsonb
);

create index if not exists private_beta_audit_owner_idx on private_beta_audit_events (user_id, household_id, timestamp desc);

create table if not exists private_beta_feature_flags (
  key text primary key,
  enabled boolean not null,
  server_enforced boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into private_beta_feature_flags (key, enabled, server_enforced) values
  ('csvImports', true, true),
  ('manualFinancialProfile', true, true),
  ('financialHealth', true, true),
  ('forecasting', true, true),
  ('goals', true, true),
  ('deterministicBriefing', true, true),
  ('aiCfoUi', true, true),
  ('liveAi', false, true),
  ('openBanking', false, true)
on conflict (key) do update set enabled = excluded.enabled, server_enforced = true, updated_at = now();

insert into private_beta_migration_status (version, status, checksum)
values ('private-beta-foundation-v1', 'applied', 'manual-apply-checksum-recorded-by-deployment')
on conflict (version) do update set status = excluded.status, applied_at = now();
