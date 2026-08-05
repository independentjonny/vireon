-- Vireon PostgreSQL Phase 2 Core Decisioning Persistence v1
-- Apply after 0001, 0002 and 0003.
-- Additive metadata columns needed to preserve existing domain IDs and payloads.

alter table public.digital_twin_scenarios add column if not exists app_id text;
alter table public.digital_twin_scenarios add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.digital_twin_scenarios add column if not exists baseline boolean not null default false;
alter table public.digital_twin_scenarios add column if not exists archived_at timestamptz;
update public.digital_twin_scenarios set app_id = id::text where app_id is null;
alter table public.digital_twin_scenarios alter column app_id set not null;
create unique index if not exists idx_digital_twin_scenarios_user_app_id on public.digital_twin_scenarios(user_id, app_id);
create index if not exists idx_digital_twin_scenarios_user_active on public.digital_twin_scenarios(user_id, active, archived_at);

alter table public.simulation_runs add column if not exists app_id text;
alter table public.simulation_runs add column if not exists engine_version text not null default 'financial-digital-twin-v1';
alter table public.simulation_runs add column if not exists input_fingerprint text not null default 'legacy';
alter table public.simulation_runs add column if not exists warnings jsonb not null default '[]'::jsonb;
update public.simulation_runs set app_id = id::text where app_id is null;
alter table public.simulation_runs alter column app_id set not null;
create unique index if not exists idx_simulation_runs_user_app_id on public.simulation_runs(user_id, app_id);
create index if not exists idx_simulation_runs_user_scenario_created on public.simulation_runs(user_id, scenario_id, created_at desc);

alter table public.timeline_events add column if not exists app_id text;
alter table public.timeline_events add column if not exists archived_at timestamptz;
update public.timeline_events set app_id = id::text where app_id is null;
alter table public.timeline_events alter column app_id set not null;
create unique index if not exists idx_timeline_events_user_app_id on public.timeline_events(user_id, app_id);

alter table public.decisions add column if not exists app_id text;
alter table public.decisions add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.decisions add column if not exists source_module text not null default 'decision-centre';
alter table public.decisions add column if not exists urgency text not null default 'Medium';
alter table public.decisions add column if not exists archived_at timestamptz;
update public.decisions set app_id = id::text where app_id is null;
alter table public.decisions alter column app_id set not null;
create unique index if not exists idx_decisions_user_app_id on public.decisions(user_id, app_id);
create index if not exists idx_decisions_user_source_state on public.decisions(user_id, source_module, state, updated_at desc);

alter table public.workflows add column if not exists app_id text;
alter table public.workflows add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.workflows add column if not exists archived_at timestamptz;
update public.workflows set app_id = id::text where app_id is null;
alter table public.workflows alter column app_id set not null;
create unique index if not exists idx_workflows_user_app_id on public.workflows(user_id, app_id);
create index if not exists idx_workflows_user_active_updated on public.workflows(user_id, execution_status, updated_at desc);

alter table public.workflow_steps add column if not exists app_id text;
alter table public.workflow_steps add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.workflow_steps add column if not exists completed_at timestamptz;
alter table public.workflow_steps add column if not exists due_at timestamptz;
update public.workflow_steps set app_id = id::text where app_id is null;
alter table public.workflow_steps alter column app_id set not null;
create unique index if not exists idx_workflow_steps_user_workflow_app_id on public.workflow_steps(user_id, workflow_id, app_id);
create index if not exists idx_workflow_steps_user_status on public.workflow_steps(user_id, status, updated_at desc);

alter table public.workflow_outcomes add column if not exists app_id text;
alter table public.workflow_outcomes add column if not exists payload jsonb not null default '{}'::jsonb;
update public.workflow_outcomes set app_id = id::text where app_id is null;
alter table public.workflow_outcomes alter column app_id set not null;
create unique index if not exists idx_workflow_outcomes_user_app_id on public.workflow_outcomes(user_id, app_id);

alter table public.ai_cfo_questions add column if not exists app_id text;
alter table public.ai_cfo_questions add column if not exists conversation_id text not null default 'default';
alter table public.ai_cfo_questions add column if not exists prompt_version text not null default 'deterministic-ai-cfo-v1';
update public.ai_cfo_questions set app_id = id::text where app_id is null;
alter table public.ai_cfo_questions alter column app_id set not null;
create unique index if not exists idx_ai_cfo_questions_user_app_id on public.ai_cfo_questions(user_id, app_id);
create index if not exists idx_ai_cfo_questions_user_conversation on public.ai_cfo_questions(user_id, conversation_id, created_at desc);

alter table public.ai_cfo_answers add column if not exists app_id text;
alter table public.ai_cfo_answers add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.ai_cfo_answers add column if not exists provider text not null default 'deterministic-disabled-live-ai';
alter table public.ai_cfo_answers add column if not exists model text not null default 'none-approved';
alter table public.ai_cfo_answers add column if not exists output_classification text not null default 'deterministic-briefing';
update public.ai_cfo_answers set app_id = id::text where app_id is null;
alter table public.ai_cfo_answers alter column app_id set not null;
create unique index if not exists idx_ai_cfo_answers_user_app_id on public.ai_cfo_answers(user_id, app_id);

alter table public.daily_reviews add column if not exists app_id text;
alter table public.daily_reviews add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.daily_reviews add column if not exists engine_version text not null default 'daily-review-v1';
alter table public.daily_reviews add column if not exists input_fingerprint text not null default 'legacy';
alter table public.daily_reviews add column if not exists calculation_snapshot_id uuid references public.calculation_snapshots(id);
update public.daily_reviews set app_id = id::text where app_id is null;
alter table public.daily_reviews alter column app_id set not null;
create unique index if not exists idx_daily_reviews_user_app_id on public.daily_reviews(user_id, app_id);
create index if not exists idx_daily_reviews_user_date_version on public.daily_reviews(user_id, review_date desc, engine_version);

alter table public.goals add column if not exists app_id text;
alter table public.goals add column if not exists priority text not null default 'medium';
alter table public.goals add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.goals add column if not exists archived_at timestamptz;
update public.goals set app_id = id::text where app_id is null;
alter table public.goals alter column app_id set not null;
create unique index if not exists idx_goals_user_app_id on public.goals(user_id, app_id);
create index if not exists idx_goals_user_status_priority on public.goals(user_id, status, priority, updated_at desc);

insert into public.private_beta_migration_status (version, status, checksum)
values ('0004_core_decisioning_persistence', 'applied', 'core-decisioning-persistence-v1')
on conflict (version) do update set status = excluded.status, applied_at = now();
