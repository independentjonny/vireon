-- Preview-only financial-data reset support.
-- This migration does not delete data when applied. It installs a narrowly scoped,
-- authenticated reset function. The application calls it only when VERCEL_ENV=preview.
-- Personal/account records, authentication identity, onboarding, preferences,
-- feedback and immutable security audit history are intentionally retained.

create or replace function public.reject_immutable_change()
returns trigger
language plpgsql
as $$
begin
  if nullif(current_setting('app.financial_reset_user_id', true), '') is not null
     and old.user_id is not null
     and old.user_id::text = current_setting('app.financial_reset_user_id', true) then
    return old;
  end if;

  raise exception 'immutable history cannot be modified; create a superseding event';
end;
$$;

create or replace function public.reset_current_user_financial_data(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_count integer := 0;
  v_financial_records integer := 0;
  v_documents integer := 0;
  v_transactions integer := 0;
  v_analysis integer := 0;
  v_plans integer := 0;
  v_operations integer := 0;
  v_cancelled_requests integer := 0;
  v_completed_at timestamptz := now();
begin
  v_user_id := nullif(current_setting('app.current_user_id', true), '')::uuid;
  if v_user_id is null then
    raise exception 'AUTHENTICATED_USER_REQUIRED' using errcode = '42501';
  end if;
  if p_confirmation <> 'DELETE MY FINANCIAL DATA' then
    raise exception 'FINANCIAL_DATA_RESET_CONFIRMATION_REQUIRED' using errcode = '22023';
  end if;
  if not exists (select 1 from public.users where id = v_user_id) then
    raise exception 'AUTHENTICATED_USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform set_config('app.financial_reset_user_id', v_user_id::text, true);

  delete from public.workflow_evidence where user_id = v_user_id;
  get diagnostics v_count = row_count; v_plans := v_plans + v_count;
  delete from public.workflow_outcomes where user_id = v_user_id;
  get diagnostics v_count = row_count; v_plans := v_plans + v_count;
  delete from public.workflow_steps where user_id = v_user_id;
  get diagnostics v_count = row_count; v_plans := v_plans + v_count;
  delete from public.workflows where user_id = v_user_id;
  get diagnostics v_count = row_count; v_plans := v_plans + v_count;
  delete from public.decision_history where user_id = v_user_id;
  get diagnostics v_count = row_count; v_plans := v_plans + v_count;
  delete from public.decisions where user_id = v_user_id;
  get diagnostics v_count = row_count; v_plans := v_plans + v_count;
  delete from public.goals where user_id = v_user_id;
  get diagnostics v_count = row_count; v_plans := v_plans + v_count;

  delete from public.ai_cfo_answers where user_id = v_user_id;
  get diagnostics v_count = row_count; v_analysis := v_analysis + v_count;
  delete from public.ai_cfo_questions where user_id = v_user_id;
  get diagnostics v_count = row_count; v_analysis := v_analysis + v_count;
  delete from public.simulation_runs where user_id = v_user_id;
  get diagnostics v_count = row_count; v_analysis := v_analysis + v_count;
  delete from public.digital_twin_scenarios where user_id = v_user_id;
  get diagnostics v_count = row_count; v_analysis := v_analysis + v_count;
  delete from public.daily_reviews where user_id = v_user_id;
  get diagnostics v_count = row_count; v_analysis := v_analysis + v_count;
  delete from public.timeline_events where user_id = v_user_id;
  get diagnostics v_count = row_count; v_analysis := v_analysis + v_count;

  delete from public.evidence where user_id = v_user_id;
  get diagnostics v_count = row_count; v_documents := v_documents + v_count;
  delete from public.document_extractions where user_id = v_user_id;
  get diagnostics v_count = row_count; v_documents := v_documents + v_count;
  delete from public.fact_versions where user_id = v_user_id;
  get diagnostics v_count = row_count; v_financial_records := v_financial_records + v_count;
  delete from public.financial_facts where user_id = v_user_id;
  get diagnostics v_count = row_count; v_financial_records := v_financial_records + v_count;
  delete from public.documents where user_id = v_user_id;
  get diagnostics v_count = row_count; v_documents := v_documents + v_count;
  delete from public.calculation_snapshots where user_id = v_user_id;
  get diagnostics v_count = row_count; v_analysis := v_analysis + v_count;
  delete from public.rule_references where user_id = v_user_id;
  get diagnostics v_count = row_count; v_analysis := v_analysis + v_count;

  delete from public.user_subscriptions where user_id = v_user_id;
  get diagnostics v_count = row_count; v_transactions := v_transactions + v_count;
  delete from public.user_transactions where user_id = v_user_id;
  get diagnostics v_count = row_count; v_transactions := v_transactions + v_count;
  delete from public.user_transaction_imports where user_id = v_user_id;
  get diagnostics v_count = row_count; v_transactions := v_transactions + v_count;

  delete from public.data_exports where user_id = v_user_id;
  get diagnostics v_count = row_count; v_operations := v_operations + v_count;
  delete from public.migration_runs where user_id = v_user_id;
  get diagnostics v_count = row_count; v_operations := v_operations + v_count;
  delete from public.idempotency_keys where user_id = v_user_id;
  get diagnostics v_count = row_count; v_operations := v_operations + v_count;
  delete from public.background_jobs where user_id = v_user_id;
  get diagnostics v_count = row_count; v_operations := v_operations + v_count;

  update public.account_deletion_requests
     set status = 'cancelled', cancelled_at = coalesce(cancelled_at, v_completed_at),
         updated_at = v_completed_at, version = version + 1
   where user_id = v_user_id and status <> 'completed' and status <> 'cancelled';
  get diagnostics v_cancelled_requests = row_count;

  insert into public.audit_events
    (user_id, actor, action, entity_type, entity_id, before_hash, after_hash, reason, request_id, source, correlation_id)
  values
    (v_user_id, 'user', 'financial_data.reset_completed', 'financial_data', v_user_id::text,
     null, null,
     format('financial records=%s; documents=%s; transactions=%s; analysis=%s; plans=%s; operations=%s; cancelled account deletion requests=%s',
       v_financial_records, v_documents, v_transactions, v_analysis, v_plans, v_operations, v_cancelled_requests),
     gen_random_uuid()::text, 'preview-financial-data-reset', gen_random_uuid()::text);

  return jsonb_build_object(
    'completedAt', v_completed_at,
    'deleted', jsonb_build_object(
      'financialRecords', v_financial_records,
      'documentsAndEvidence', v_documents,
      'transactionsAndSubscriptions', v_transactions,
      'calculationsAndReviews', v_analysis,
      'decisionsGoalsAndWorkflows', v_plans,
      'financialOperations', v_operations
    ),
    'cancelledAccountDeletionRequests', v_cancelled_requests,
    'retained', jsonb_build_array(
      'account', 'email and display name', 'authentication and access',
      'onboarding', 'preferences', 'feedback', 'security audit history'
    )
  );
end;
$$;

revoke all on function public.reset_current_user_financial_data(text) from public;
grant execute on function public.reset_current_user_financial_data(text) to vireon_app;

comment on function public.reset_current_user_financial_data(text) is
  'Deletes only the current authenticated user financial domain. Account, identity, onboarding, preferences, feedback and audit records are retained. Runtime invocation is Preview-gated by the application.';

insert into public.private_beta_migration_status (version, status, checksum)
values ('0011_preview_financial_data_reset', 'applied', 'preview-financial-data-reset-v1')
on conflict (version) do update set status = excluded.status, checksum = excluded.checksum, applied_at = now();
