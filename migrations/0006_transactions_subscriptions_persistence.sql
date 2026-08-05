-- Vireon PostgreSQL Phase 2 Transactions and Subscriptions Persistence v1
-- Apply after 0005_daily_review_append_only_history.sql.
-- Additive tables for user-scoped transaction imports, transaction records and subscription records.

create table if not exists public.user_transaction_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  workspace_id text not null,
  app_id text not null,
  status text not null check (status in ('previewed', 'persisted', 'failed', 'archived')),
  source_format text not null default 'csv',
  source_checksum text not null,
  row_count integer not null check (row_count >= 0),
  processed_count integer not null check (processed_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  recurring_count integer not null default 0 check (recurring_count >= 0),
  health_score integer not null default 0 check (health_score >= 0 and health_score <= 100),
  payload jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text,
  unique(user_id, app_id),
  unique(user_id, source_checksum)
);

create table if not exists public.user_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  workspace_id text not null,
  import_id uuid references public.user_transaction_imports(id) on delete set null,
  app_id text not null,
  merchant text not null,
  merchant_canonical text not null,
  amount numeric not null,
  currency text not null,
  category text not null,
  sub_category text not null,
  transaction_date timestamptz not null,
  recurring boolean not null default false,
  recurring_cadence text check (recurring_cadence is null or recurring_cadence in ('daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annual')),
  duplicate boolean not null default false,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  raw_description text not null,
  source_kind text not null check (source_kind in ('csv', 'api', 'manual', 'bank_feed')),
  payload jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text,
  unique(user_id, app_id)
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  workspace_id text not null,
  app_id text not null,
  transaction_app_id text,
  merchant text not null,
  merchant_canonical text not null,
  amount numeric not null check (amount >= 0),
  cadence text not null check (cadence in ('monthly', 'quarterly', 'annual')),
  next_renewal_date timestamptz not null,
  cancellation_score numeric not null default 0 check (cancellation_score >= 0 and cancellation_score <= 1),
  pricing_anomaly_score numeric not null default 0 check (pricing_anomaly_score >= 0 and pricing_anomaly_score <= 1),
  savings_opportunity numeric not null default 0,
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null,
  correlation_id text,
  unique(user_id, app_id)
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['user_transaction_imports', 'user_transactions', 'user_subscriptions']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('drop policy if exists %I_user_isolation on public.%I', table_name, table_name);
    execute format(
      'create policy %I_user_isolation on public.%I using (user_id = nullif(current_setting(''app.current_user_id'', true), '''')::uuid) with check (user_id = nullif(current_setting(''app.current_user_id'', true), '''')::uuid)',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create index if not exists idx_user_transactions_user_date on public.user_transactions(user_id, transaction_date desc) where archived_at is null;
create index if not exists idx_user_transactions_user_category on public.user_transactions(user_id, category, transaction_date desc) where archived_at is null;
create index if not exists idx_user_transactions_user_recurring on public.user_transactions(user_id, recurring, merchant_canonical) where archived_at is null;
create index if not exists idx_user_transaction_imports_user_created on public.user_transaction_imports(user_id, created_at desc) where archived_at is null;
create index if not exists idx_user_subscriptions_user_active_renewal on public.user_subscriptions(user_id, active, next_renewal_date) where archived_at is null;
create index if not exists idx_user_subscriptions_user_merchant on public.user_subscriptions(user_id, merchant_canonical) where archived_at is null;

insert into public.private_beta_migration_status (version, status, checksum)
values ('0006_transactions_subscriptions_persistence', 'applied', 'transactions-subscriptions-persistence-v1')
on conflict (version) do update set status = excluded.status, applied_at = now();
