-- Vireon PostgreSQL Phase 2 Daily Review append-only history
-- Apply after 0004_core_decisioning_persistence.sql.
-- The original pilot schema allowed only one review row per user/date. Daily Review
-- owns durable briefing history, so same-day generated reviews must be distinct by
-- app_id while review_date remains an ordering/filtering field.

alter table public.daily_reviews
  drop constraint if exists daily_reviews_user_id_review_date_key;

create index if not exists idx_daily_reviews_user_date_created
  on public.daily_reviews(user_id, review_date desc, created_at desc);

insert into public.private_beta_migration_status (version, status, checksum)
values ('0005_daily_review_append_only_history', 'applied', 'daily-review-append-only-history-v1')
on conflict (version) do update set status = excluded.status, applied_at = now();
