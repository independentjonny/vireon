-- Vireon Production Data Integrity v1
-- PostgreSQL target schema for persistent, user-isolated financial data.

create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  id text primary key,
  checksum text not null,
  applied_at timestamptz not null default now(),
  duration_ms integer not null,
  executor text not null,
  success boolean not null,
  error_details text,
  correlation_id text not null
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null default 'server',
  correlation_id text
);

create table if not exists financial_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  state text,
  relationship_status text,
  profile_confidence numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists financial_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  fact_type text not null,
  fact_value jsonb not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  verified boolean not null default false,
  sensitivity text not null default 'asset-debt',
  source_document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists fact_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  fact_id uuid not null references financial_facts(id) on delete cascade,
  version integer not null,
  fact_value jsonb not null,
  confidence numeric not null,
  verified boolean not null,
  evidence_ids uuid[] not null default '{}',
  changed_reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null,
  correlation_id text,
  unique(fact_id, version)
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  document_type text not null,
  storage_ref text not null,
  content_hash text,
  status text not null,
  sensitivity text not null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists document_extractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  extraction_version text not null,
  proposed_facts jsonb not null default '[]'::jsonb,
  confidence numeric not null,
  citations jsonb not null default '[]'::jsonb,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  evidence_type text not null,
  source_ref text not null,
  document_id uuid references documents(id),
  fact_id uuid references financial_facts(id),
  verification_status text not null,
  confidence numeric not null,
  immutable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists rule_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  rule_type text not null,
  jurisdiction text not null,
  authority text not null,
  source_title text not null,
  source_url text not null,
  effective_from date not null,
  effective_to date,
  last_verified_at timestamptz not null,
  rule_version text not null,
  summary text not null,
  applicable_structures text[] not null default '{}',
  applicable_investment_types text[] not null default '{}',
  confidence text not null,
  review_status text not null,
  professional_review_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists calculation_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  engine_name text not null,
  engine_version text not null,
  input_fact_versions jsonb not null default '[]'::jsonb,
  rule_versions jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '{}'::jsonb,
  output_hash text not null,
  reproducibility_status text not null default 'reproducible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists digital_twin_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  assumptions jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists simulation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  scenario_id uuid references digital_twin_scenarios(id),
  calculation_snapshot_id uuid references calculation_snapshots(id),
  result jsonb not null,
  confidence text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  category text not null,
  state text not null,
  original_expected_impact numeric,
  revised_expected_impact numeric,
  realised_impact numeric,
  confidence text not null,
  professional_review_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists decision_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  decision_id uuid not null references decisions(id) on delete cascade,
  event_type text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  workflow_definition_id text not null,
  workflow_version text not null,
  source_decision_id uuid references decisions(id),
  title text not null,
  execution_status text not null,
  outcome_status text not null,
  expected_impact numeric,
  realised_impact numeric,
  baseline_snapshot_id uuid references calculation_snapshots(id),
  completion_snapshot_id uuid references calculation_snapshots(id),
  verification_snapshot_id uuid references calculation_snapshots(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists workflow_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  workflow_id uuid not null references workflows(id) on delete cascade,
  title text not null,
  step_type text not null,
  status text not null,
  step_order integer not null,
  required boolean not null default true,
  validation_rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists workflow_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  workflow_id uuid not null references workflows(id) on delete cascade,
  step_id uuid references workflow_steps(id),
  evidence_id uuid references evidence(id),
  satisfies_requirement_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists workflow_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  workflow_id uuid not null references workflows(id) on delete cascade,
  metric text not null,
  baseline_value numeric,
  expected_value numeric,
  actual_value numeric,
  result text not null,
  variance numeric,
  evidence_ids uuid[] not null default '{}',
  calculation_snapshot_id uuid references calculation_snapshots(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists timeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  event_time timestamptz not null,
  category text not null,
  title text not null,
  summary text not null,
  entity_type text not null,
  entity_id uuid,
  before_values jsonb not null default '{}'::jsonb,
  after_values jsonb not null default '{}'::jsonb,
  evidence_ids uuid[] not null default '{}',
  calculation_snapshot_id uuid references calculation_snapshots(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists ai_cfo_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  user_query text not null,
  workspace_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists ai_cfo_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  question_id uuid not null references ai_cfo_questions(id) on delete cascade,
  answer jsonb not null,
  calculation_snapshot_id uuid references calculation_snapshots(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  review_date date not null,
  status text not null,
  findings jsonb not null default '[]'::jsonb,
  generated_decision_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text,
  unique(user_id, review_date)
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  goal_type text not null,
  status text not null,
  target_value numeric,
  current_value numeric,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  preference_key text not null,
  preference_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text,
  unique(user_id, preference_key)
);

create table if not exists idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  idempotency_key text not null,
  operation text not null,
  response_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text,
  unique(user_id, idempotency_key, operation)
);

create table if not exists background_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  job_type text not null,
  status text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  next_retry_at timestamptz,
  error_class text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists data_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null,
  manifest jsonb,
  storage_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null,
  requested_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  final_record_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create table if not exists migration_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  source_version text,
  target_version text not null,
  status text not null,
  preview jsonb not null,
  record_count integer not null default 0,
  source_checksum text not null,
  rollback_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text,
  unique(user_id, source_checksum, target_version)
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  actor text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_hash text,
  after_hash text,
  reason text not null,
  request_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text
);

create or replace function reject_immutable_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'immutable history cannot be modified; create a superseding event';
end;
$$;

drop trigger if exists audit_events_immutable on audit_events;
create trigger audit_events_immutable before update or delete on audit_events
for each row execute function reject_immutable_change();

drop trigger if exists fact_versions_immutable on fact_versions;
create trigger fact_versions_immutable before update or delete on fact_versions
for each row execute function reject_immutable_change();

drop trigger if exists calculation_snapshots_immutable on calculation_snapshots;
create trigger calculation_snapshots_immutable before update or delete on calculation_snapshots
for each row execute function reject_immutable_change();

drop trigger if exists timeline_events_immutable on timeline_events;
create trigger timeline_events_immutable before update or delete on timeline_events
for each row execute function reject_immutable_change();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'financial_profiles','financial_facts','fact_versions','documents','document_extractions',
    'evidence','rule_references','calculation_snapshots','digital_twin_scenarios','simulation_runs',
    'decisions','decision_history','workflows','workflow_steps','workflow_evidence','workflow_outcomes',
    'timeline_events','ai_cfo_questions','ai_cfo_answers','daily_reviews','goals','user_preferences',
    'idempotency_keys','background_jobs','data_exports','account_deletion_requests','migration_runs',
    'audit_events'
  ]
  loop
    execute format('alter table %I enable row level security', table_name);
    execute format('drop policy if exists %I_user_isolation on %I', table_name, table_name);
    execute format(
      'create policy %I_user_isolation on %I using (user_id = nullif(current_setting(''app.current_user_id'', true), '''')::uuid) with check (user_id = nullif(current_setting(''app.current_user_id'', true), '''')::uuid)',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create index if not exists idx_financial_facts_user_type on financial_facts(user_id, fact_type);
create index if not exists idx_documents_user_type on documents(user_id, document_type);
create index if not exists idx_calculation_snapshots_user_engine on calculation_snapshots(user_id, engine_name, created_at desc);
create index if not exists idx_decisions_user_state on decisions(user_id, state);
create index if not exists idx_workflows_user_status on workflows(user_id, execution_status, outcome_status);
create index if not exists idx_timeline_user_time on timeline_events(user_id, event_time desc);
create index if not exists idx_background_jobs_user_status on background_jobs(user_id, status, next_retry_at);
