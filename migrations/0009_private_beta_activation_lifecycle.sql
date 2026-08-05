-- Vireon private-beta activation lifecycle hardening.
-- Additive metadata only; no destructive operations.

alter table public.background_jobs add column if not exists app_id text;
alter table public.background_jobs add column if not exists workspace_id text;
alter table public.background_jobs add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.background_jobs add column if not exists payload_schema_version text not null default 'private-beta-job-v1';
alter table public.background_jobs add column if not exists idempotency_key text;
alter table public.background_jobs add column if not exists locked_at timestamptz;
alter table public.background_jobs add column if not exists locked_by text;
alter table public.background_jobs add column if not exists heartbeat_at timestamptz;
alter table public.background_jobs add column if not exists completed_at timestamptz;
alter table public.background_jobs add column if not exists failed_at timestamptz;
alter table public.background_jobs add column if not exists redacted_error text;
update public.background_jobs set app_id = id::text where app_id is null;
alter table public.background_jobs alter column app_id set not null;
create unique index if not exists idx_background_jobs_user_app_id on public.background_jobs(user_id, app_id);
create unique index if not exists idx_background_jobs_user_idempotency on public.background_jobs(user_id, idempotency_key) where idempotency_key is not null;
create index if not exists idx_background_jobs_claimable on public.background_jobs(status, next_retry_at, created_at) where status in ('pending', 'queued', 'retrying');
create index if not exists idx_background_jobs_user_type_status on public.background_jobs(user_id, job_type, status, updated_at desc);

alter table public.data_exports add column if not exists app_id text;
alter table public.data_exports add column if not exists workspace_id text;
alter table public.data_exports add column if not exists requested_at timestamptz not null default now();
alter table public.data_exports add column if not exists expires_at timestamptz;
alter table public.data_exports add column if not exists completed_at timestamptz;
alter table public.data_exports add column if not exists failed_at timestamptz;
alter table public.data_exports add column if not exists redacted_error text;
alter table public.data_exports add column if not exists idempotency_key text;
update public.data_exports set app_id = id::text where app_id is null;
alter table public.data_exports alter column app_id set not null;
create unique index if not exists idx_data_exports_user_app_id on public.data_exports(user_id, app_id);
create unique index if not exists idx_data_exports_user_idempotency on public.data_exports(user_id, idempotency_key) where idempotency_key is not null;
create index if not exists idx_data_exports_user_status_created on public.data_exports(user_id, status, created_at desc);

alter table public.account_deletion_requests add column if not exists app_id text;
alter table public.account_deletion_requests add column if not exists workspace_id text;
alter table public.account_deletion_requests add column if not exists confirmed_at timestamptz;
alter table public.account_deletion_requests add column if not exists scheduled_at timestamptz;
alter table public.account_deletion_requests add column if not exists processing_at timestamptz;
alter table public.account_deletion_requests add column if not exists failed_at timestamptz;
alter table public.account_deletion_requests add column if not exists redacted_error text;
alter table public.account_deletion_requests add column if not exists manifest jsonb not null default '{}'::jsonb;
alter table public.account_deletion_requests add column if not exists idempotency_key text;
update public.account_deletion_requests set app_id = id::text where app_id is null;
alter table public.account_deletion_requests alter column app_id set not null;
create unique index if not exists idx_account_deletion_user_app_id on public.account_deletion_requests(user_id, app_id);
create unique index if not exists idx_account_deletion_user_idempotency on public.account_deletion_requests(user_id, idempotency_key) where idempotency_key is not null;
create index if not exists idx_account_deletion_user_status_created on public.account_deletion_requests(user_id, status, created_at desc);

insert into public.private_beta_migration_status (version, status, checksum)
values ('0009_private_beta_activation_lifecycle', 'applied', 'private-beta-activation-lifecycle-v1')
on conflict (version) do update set status = excluded.status, applied_at = now();
