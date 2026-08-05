-- Vireon Supabase Private Beta Security v1
-- Apply after 0001_production_data_integrity.sql and 0002_private_beta_foundation.sql.
-- This migration is additive and does not enable browser-direct financial-document storage.

alter table private_beta_onboarding enable row level security;
alter table private_beta_onboarding force row level security;
alter table private_beta_feedback enable row level security;
alter table private_beta_feedback force row level security;
alter table private_beta_deletion_requests enable row level security;
alter table private_beta_deletion_requests force row level security;
alter table private_beta_audit_events enable row level security;
alter table private_beta_audit_events force row level security;
alter table private_beta_feature_flags enable row level security;
alter table private_beta_feature_flags force row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_onboarding' and policyname = 'private_beta_onboarding_select_own') then
    create policy private_beta_onboarding_select_own on private_beta_onboarding
      for select
      using (user_id = nullif(current_setting('app.current_user_id', true), ''));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_onboarding' and policyname = 'private_beta_onboarding_insert_own') then
    create policy private_beta_onboarding_insert_own on private_beta_onboarding
      for insert
      with check (user_id = nullif(current_setting('app.current_user_id', true), ''));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_onboarding' and policyname = 'private_beta_onboarding_update_own') then
    create policy private_beta_onboarding_update_own on private_beta_onboarding
      for update
      using (user_id = nullif(current_setting('app.current_user_id', true), ''))
      with check (user_id = nullif(current_setting('app.current_user_id', true), ''));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_onboarding' and policyname = 'private_beta_onboarding_delete_own') then
    create policy private_beta_onboarding_delete_own on private_beta_onboarding
      for delete
      using (user_id = nullif(current_setting('app.current_user_id', true), ''));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_feedback' and policyname = 'private_beta_feedback_select_own') then
    create policy private_beta_feedback_select_own on private_beta_feedback
      for select
      using (user_id = nullif(current_setting('app.current_user_id', true), ''));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_feedback' and policyname = 'private_beta_feedback_insert_own') then
    create policy private_beta_feedback_insert_own on private_beta_feedback
      for insert
      with check (user_id = nullif(current_setting('app.current_user_id', true), ''));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_feedback' and policyname = 'private_beta_feedback_update_own') then
    create policy private_beta_feedback_update_own on private_beta_feedback
      for update
      using (user_id = nullif(current_setting('app.current_user_id', true), ''))
      with check (user_id = nullif(current_setting('app.current_user_id', true), ''));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_feedback' and policyname = 'private_beta_feedback_delete_own') then
    create policy private_beta_feedback_delete_own on private_beta_feedback
      for delete
      using (user_id = nullif(current_setting('app.current_user_id', true), ''));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_deletion_requests' and policyname = 'private_beta_deletion_requests_select_own') then
    create policy private_beta_deletion_requests_select_own on private_beta_deletion_requests
      for select
      using (user_id = nullif(current_setting('app.current_user_id', true), ''));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_deletion_requests' and policyname = 'private_beta_deletion_requests_insert_own') then
    create policy private_beta_deletion_requests_insert_own on private_beta_deletion_requests
      for insert
      with check (user_id = nullif(current_setting('app.current_user_id', true), ''));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_deletion_requests' and policyname = 'private_beta_deletion_requests_update_own') then
    create policy private_beta_deletion_requests_update_own on private_beta_deletion_requests
      for update
      using (user_id = nullif(current_setting('app.current_user_id', true), ''))
      with check (user_id = nullif(current_setting('app.current_user_id', true), ''));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_audit_events' and policyname = 'private_beta_audit_events_select_own') then
    create policy private_beta_audit_events_select_own on private_beta_audit_events
      for select
      using (user_id = nullif(current_setting('app.current_user_id', true), ''));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_audit_events' and policyname = 'private_beta_audit_events_insert_own') then
    create policy private_beta_audit_events_insert_own on private_beta_audit_events
      for insert
      with check (user_id = nullif(current_setting('app.current_user_id', true), ''));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_feature_flags' and policyname = 'private_beta_feature_flags_select_authenticated') then
    create policy private_beta_feature_flags_select_authenticated on private_beta_feature_flags
      for select
      using (nullif(current_setting('app.current_user_id', true), '') is not null);
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'private_beta_audit_events_immutable') then
    create trigger private_beta_audit_events_immutable
    before update or delete on private_beta_audit_events
    for each row execute function reject_immutable_change();
  end if;
end;
$$;

-- Financial-document storage remains server-only for private beta. The application
-- does not use browser-direct Supabase Storage access for financial documents, so
-- this migration creates or hardens a private bucket without creating authenticated
-- client storage.objects policies. Server object paths must be user scoped:
-- users/{userId}/financial-documents/{unpredictableObjectId}/{safeFileName}
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('financial-documents', 'financial-documents', false)
    on conflict (id) do update set public = false;
  end if;
end;
$$;

insert into private_beta_migration_status (version, status, checksum)
values ('0003_supabase_private_beta_security', 'applied', 'supabase-private-beta-security-v1')
on conflict (version) do update set status = excluded.status, applied_at = now();
