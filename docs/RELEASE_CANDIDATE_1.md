# RELEASE_CANDIDATE_1

Status: `PRIVATE_BETA_READY_REQUIRES_HUMAN_APPROVAL`

Date: 2026-08-05

Implementation state: `FROZEN`

Deployment state: `NOT_DEPLOYED`

Private beta state: `NOT_ACTIVATED`

Migration state: `0009 and 0010 applied and verified in non-production pilot`

## Release Notes

`RELEASE_CANDIDATE_1` is the first controlled private-beta candidate for Vireon.

Included:

- Supabase-backed authentication and owner/admin bootstrap.
- Invite-only private-beta account creation.
- Manual access request and approval workflow.
- Admin private-beta access console.
- PostgreSQL-backed Financial Vault, core decisioning domains and private-beta lifecycle state.
- Deterministic financial engines retained as calculation authority.
- AI CFO gated/disabled where live AI is not approved.
- Open Banking disabled.
- Export and deletion request lifecycles are durable but operationally gated.
- Private-beta UX polish across onboarding, dashboard, explanations, empty states and error recovery.
- Security hardening for sensitive routes, trusted identity, RBAC, upload limits, local fallback retirement and restricted runtime database access.

Not included:

- Public production launch.
- Real-user activation.
- Live AI activation.
- Open Banking activation.
- Financial execution, lender submission or professional advice automation.
- Destructive account deletion execution.
- Deployment automation.

## Known Issues

- Migrations `0009_private_beta_activation_lifecycle.sql` and `0010_rls_security_findings.sql` have been applied to the approved non-production pilot only; deployment approval remains separate.
- The final independent reviewer result was `PASS_REQUIRES_HUMAN_APPROVAL`, not automatic approval.
- Validation evidence is bounded; some large logs and route audits are summarized rather than embedded in full.
- Lint has pre-existing warnings recorded in release evidence.
- Private beta has not yet been exercised by real users.
- Email delivery and hosting behavior must be verified in the selected deployment environment before user invitations.
- Live-provider behavior for AI and Open Banking is intentionally unvalidated because those systems remain disabled.

## Open Risks

- Operational deployment risk: the migrated pilot has passed verification, but the hosted deployment environment still needs deployment approval and hosted smoke evidence.
- Deployment environment drift: local/pilot validation does not prove hosted environment configuration.
- Human usability risk: the product has passed synthetic and browser smoke checks, but not unaided real-user sessions.
- Support load risk: first users may expose confusing flows, import edge cases or terminology gaps.
- Data recovery risk: backup/restore runbooks must be followed and verified after deployment.
- Evidence granularity risk: reviewers accepted bounded evidence with caveats; human operator should inspect referenced artifacts before activation.

## Beta Limitations

- Invite-only and manually approved access only.
- Synthetic/internal testing before any real private-beta user admission.
- Open Banking remains disabled.
- Live AI remains disabled unless separately approved.
- Outputs are financial intelligence and planning support, not regulated financial advice.
- Users must not rely on Vireon for irreversible financial actions.
- Export/deletion requests are lifecycle records; real destructive deletion remains a separate approved operation.
- Demo/test fixtures must remain isolated from live beta state.

## Migration Plan

Migrations `0009` and `0010` have been applied and verified in the approved non-production pilot. Do not rerun or reorder migrations unless a later operator-approved recovery procedure requires it.

Before deployment:

1. Confirm target project and database are correct.
2. Confirm current backup exists and restore procedure is known.
3. Confirm restricted runtime role remains separate from migration/admin credentials.
4. Review `docs/RC1_MIGRATION_CHECKPOINT.md`.
5. Confirm hosted environment variables use the migrated pilot and restricted runtime role.
6. Confirm rollback-check evidence is accepted.
7. Record operator, timestamp, target project, migration checksums and deployment approval result.

## Rollback Plan

Rollback is operational, not automatic.

If migration or post-migration verification fails:

1. Stop beta activation.
2. Disable user admission.
3. Preserve logs and correlation IDs.
4. Capture failing migration step and redacted database diagnostics.
5. Restore from the last verified backup if the target state is unsafe.
6. Re-run restricted-role and RLS verification.
7. Re-run private-beta lifecycle smoke tests.
8. Record incident and recovery outcome.

Do not attempt ad hoc destructive SQL while users are active.

## Operator Checklist

Pre-activation:

- [ ] Product implementation frozen.
- [ ] `RELEASE_CANDIDATE_1` documents reviewed.
- [ ] Architecture freeze acknowledged.
- [ ] v2 backlog separated from beta scope.
- [ ] PostgreSQL target verified.
- [ ] Backup verified.
- [ ] Migration checkpoint reviewed.
- [ ] Migrations `0009` and `0010` verified against the approved non-production pilot.
- [ ] Bootstrap passes.
- [ ] Rollback-check passes.
- [ ] Deployment completed only after migration success.
- [ ] Hosted environment variables verified without printing secrets.
- [ ] Supabase Auth verified.
- [ ] Admin owner can access `/admin/private-beta/access`.
- [ ] Invitation URLs use public app URL, not `0.0.0.0`.
- [ ] Live AI disabled.
- [ ] Open Banking disabled.
- [ ] Private-beta readiness command passes.
- [ ] Route authorization audit reviewed.
- [ ] Secret scan reviewed.

Activation:

- [ ] Internal synthetic user only.
- [ ] One browser.
- [ ] Synthetic data only.
- [ ] Run for one day before expanding.
- [ ] Record every issue in backlog or incident log.

## Beta Tester Guide

Private beta users should:

1. Accept an invitation only from the approved Vireon invitation flow.
2. Confirm their email through Supabase.
3. Sign in and complete beta onboarding.
4. Add synthetic or personally approved financial information.
5. Review the Financial Vault before trusting dashboard outputs.
6. Open explanations for any financial number they do not understand.
7. Try normal flows on desktop and mobile.
8. Report confusing copy, wrong-looking numbers, missing states and broken flows.
9. Avoid entering documents or data they are not comfortable testing with.
10. Avoid treating any output as professional advice.

Tester prompt:

> Use Vireon without help for 15 minutes. Try to understand your financial position, create a goal or scenario, and tell us where you got confused, worried or stuck.

## Administrator Guide

Administrators can:

- View private-beta access requests.
- Inspect a request.
- Approve or reject a request.
- Issue exactly one invitation link through the approved workflow.
- Revoke or reissue invitations where permitted.
- Review audit history.

Administrators must not:

- Create users directly in PostgreSQL.
- Bypass Supabase Auth.
- Hardcode a personal email.
- Expose raw invitation tokens after the one-time reveal.
- Activate private beta without migration, deployment and operator checklist completion.
- Admit real users before internal synthetic testing passes.

Additional administrators are added through trusted Supabase app metadata/RBAC assignment, not application request bodies.

## Incident Response Guide

Severity levels:

- `SEV-1`: cross-user data exposure, authentication bypass, destructive deletion defect, secret leakage, live AI/Open Banking unexpectedly active.
- `SEV-2`: database outage, failed migration, widespread onboarding failure, export/deletion lifecycle failure, broken admin approval.
- `SEV-3`: isolated UI defect, confusing copy, non-blocking accessibility issue, single-user workflow failure.

Immediate response:

1. Stop new invitations.
2. Preserve evidence.
3. Identify affected users and records using audit/correlation IDs.
4. Disable risky feature flags if available.
5. Move affected flows to unavailable/read-only state.
6. Do not delete or rewrite evidence.
7. Communicate plainly to affected testers.
8. Record root cause and remediation before re-enabling.

SEV-1 requires private-beta pause and human approval before resumption.

## Release Approval

Recommended approval: `approve release candidate for controlled private-beta process`.

Not approved:

- production launch
- public launch
- deployment
- real-user activation

The next approved action is RC1 deployment approval review. Private beta activation remains a later human gate.
