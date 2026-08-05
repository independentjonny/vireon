-- Vireon Private Beta Invitations v1
-- Additive invite-only account creation support for private beta.
-- Rollback/recovery: disable invitation redemption, then drop private_beta_access_requests
-- and private_beta_invitations during a maintenance window if no live invitations exist.

create table if not exists private_beta_invitations (
  id uuid primary key default gen_random_uuid(),
  access_request_id uuid,
  email_normalized text,
  token_hash text not null unique,
  intended_email text not null,
  status text not null default 'issued' check (status in ('issued', 'consumed', 'revoked', 'expired')),
  issued_by_user_id text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_user_id text,
  redeemed_at timestamptz,
  redeemed_user_id uuid references public.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by_user_id text,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'manual-approval',
  correlation_id text
);

create index if not exists private_beta_invitations_email_idx
  on private_beta_invitations (lower(intended_email), status, expires_at);

create table if not exists private_beta_access_requests (
  id uuid primary key default gen_random_uuid(),
  email text,
  email_normalized text,
  email_original text,
  display_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn', 'expired')),
  message text,
  reason text,
  reviewed_at timestamptz,
  reviewed_by_user_id text,
  review_reason text,
  approved_invitation_id uuid,
  request_fingerprint text,
  source text not null default 'public-request-access',
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  correlation_id text
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'private_beta_invitations_access_request_fk') then
    alter table private_beta_invitations
      add constraint private_beta_invitations_access_request_fk
      foreign key (access_request_id) references private_beta_access_requests(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'private_beta_access_requests_invitation_fk') then
    alter table private_beta_access_requests
      add constraint private_beta_access_requests_invitation_fk
      foreign key (approved_invitation_id) references private_beta_invitations(id) on delete set null;
  end if;
end;
$$;

create unique index if not exists private_beta_access_requests_open_email_idx
  on private_beta_access_requests (coalesce(email_normalized, lower(email)))
  where status = 'pending';

create unique index if not exists private_beta_invitations_active_email_idx
  on private_beta_invitations (coalesce(email_normalized, lower(intended_email)))
  where status = 'issued';

create index if not exists private_beta_access_requests_status_idx
  on private_beta_access_requests (status, submitted_at desc);

alter table private_beta_access_requests enable row level security;
alter table private_beta_access_requests force row level security;
alter table private_beta_invitations enable row level security;
alter table private_beta_invitations force row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_access_requests' and policyname = 'private_beta_access_requests_runtime') then
    create policy private_beta_access_requests_runtime on private_beta_access_requests
      for all
      using (nullif(current_setting('app.current_user_id', true), '') is not null)
      with check (nullif(current_setting('app.current_user_id', true), '') is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'private_beta_invitations' and policyname = 'private_beta_invitations_runtime') then
    create policy private_beta_invitations_runtime on private_beta_invitations
      for all
      using (nullif(current_setting('app.current_user_id', true), '') is not null)
      with check (nullif(current_setting('app.current_user_id', true), '') is not null);
  end if;
end;
$$;

insert into public.private_beta_migration_status (version, status, checksum)
values ('0007_private_beta_invitations', 'applied', 'private-beta-invitations-v1')
on conflict (version) do update set status = excluded.status, applied_at = now(), checksum = excluded.checksum;
