# Private Beta Access Approval

Private beta access is invite-only and manually approved. Public request access creates a durable review request only; it does not create an account, issue an invitation, disclose status, or activate product access.

## Authority

- PostgreSQL is the authoritative store for access requests, invitations, onboarding linkage, and private-beta audit events.
- Supabase Auth remains the only account creation mechanism.
- Authentication alone does not grant beta eligibility. A user must redeem a valid invitation and complete the existing onboarding path before entering product areas.
- Administrative access requires the `manage:private_beta_access` permission. This permission is granted through the trusted server-side role model, not caller-controlled headers.

## Operator Flow

1. Applicant uses `/login/request-access`.
2. Vireon records the request with a neutral response and no automatic invitation.
3. An authorized operator reviews `/admin/private-beta/access`.
4. Approval creates one expiring email-bound invitation transactionally.
5. The raw invitation link is displayed once to the operator and is never persisted; only its hash is stored.
6. Revocation and explicit reissue are audited.
7. Redemption validates the token server-side, binds the intended email, uses Supabase signup, consumes the invitation atomically, initializes minimum onboarding, and redirects to `/beta-onboarding`.

## Safety Rules

- Never expose a Supabase service-role key to browser code.
- Never trust client-provided user IDs, roles, workspaces, organizations, or invitation status.
- Never log raw invitation tokens or credential-bearing links.
- Public request access is rate-limited, idempotent, and generic.
- Expired, revoked, reused, mismatched, and malformed invitations fail closed.
- Live invitations must not be sent or created outside the protected admin approval flow.

## Validation

The release-candidate scope addition includes tests for request idempotency, approval, rejection, revocation, reissue, token hashing, rollback on failed issuance, RBAC, forged-header rejection, public throttling, migration safety, and browser/client service-role exposure.
