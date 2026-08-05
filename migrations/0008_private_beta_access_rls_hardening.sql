-- Harden private-beta access approval RLS without weakening the existing invite-only flow.
-- Administrative list/approve/reject/revoke/reissue requires a transaction-local
-- app.private_beta_access_admin flag set by trusted server RBAC.
-- Public request submission and invitation redemption use narrow pre-auth scopes.

begin;

drop policy if exists private_beta_access_requests_runtime on private_beta_access_requests;
drop policy if exists private_beta_invitations_runtime on private_beta_invitations;

create policy private_beta_access_requests_insert_runtime on private_beta_access_requests
  for insert
  to vireon_app
  with check (coalesce(current_setting('app.current_user_id', true), '') = 'private-beta-public-access');

create policy private_beta_access_requests_admin_runtime on private_beta_access_requests
  for select
  to vireon_app
  using (coalesce(current_setting('app.private_beta_access_admin', true), '') = 'true');

create policy private_beta_access_requests_update_admin_runtime on private_beta_access_requests
  for update
  to vireon_app
  using (coalesce(current_setting('app.private_beta_access_admin', true), '') = 'true')
  with check (coalesce(current_setting('app.private_beta_access_admin', true), '') = 'true');

create policy private_beta_invitations_admin_insert_runtime on private_beta_invitations
  for insert
  to vireon_app
  with check (coalesce(current_setting('app.private_beta_access_admin', true), '') = 'true');

create policy private_beta_invitations_admin_select_runtime on private_beta_invitations
  for select
  to vireon_app
  using (
    coalesce(current_setting('app.private_beta_access_admin', true), '') = 'true'
    or coalesce(current_setting('app.current_user_id', true), '') = 'private-beta-invitation-redemption'
  );

create policy private_beta_invitations_update_runtime on private_beta_invitations
  for update
  to vireon_app
  using (
    coalesce(current_setting('app.private_beta_access_admin', true), '') = 'true'
    or coalesce(current_setting('app.current_user_id', true), '') = 'private-beta-invitation-redemption'
  )
  with check (
    coalesce(current_setting('app.private_beta_access_admin', true), '') = 'true'
    or coalesce(current_setting('app.current_user_id', true), '') = 'private-beta-invitation-redemption'
  );

insert into private_beta_migration_status (version, status, checksum)
values ('0008_private_beta_access_rls_hardening', 'applied', 'private-beta-access-rls-hardening-v1')
on conflict (version) do update set status = excluded.status, checksum = excluded.checksum, applied_at = now();

commit;
