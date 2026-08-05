# Private Beta Activation Package

Status: `DEPLOYMENT_READY_REQUIRES_HUMAN_APPROVAL`

Date: 2026-08-05

Product implementation state: `FROZEN`

Deployment state: `NOT_DEPLOYED`

Private beta state: `NOT_ACTIVATED`

## Current Status

Vireon `RELEASE_CANDIDATE_1` is accepted as `PRIVATE_BETA_READY_REQUIRES_HUMAN_APPROVAL`. The architecture is frozen. The V2 backlog is separated from private-beta scope. This package is operational only.

## Known Risks

- Migrations have been applied and verified in the approved non-production pilot; deployment remains unapproved.
- Hosted environment configuration has not been proven by deployment smoke.
- Real-user usability remains unproven.
- Email delivery must be verified with synthetic recipients before real invitations.
- Full repository secret scan has known historical findings that require triage before external expansion.
- Live AI and Open Banking remain disabled and out of scope.

## Remaining Approvals

| Approval | Required Before |
| --- | --- |
| Deploy release candidate | Hosted smoke testing. |
| Admit first internal synthetic user | End-to-end internal rehearsal. |
| Admit first real private-beta user | Successful synthetic rehearsal and operator go/no-go. |
| Expand beyond founding cohort | Stability and support review. |

## Migration State

Migrations `0009_private_beta_activation_lifecycle.sql` and `0010_rls_security_findings.sql` were applied to the approved non-production pilot and verified in `docs/RC1_MIGRATION_CHECKPOINT.md`.

Do not rerun migrations during deployment approval. Re-run only non-destructive verification commands if the operator needs fresh evidence.

## Deployment Order

1. Review `docs/RC1_MIGRATION_CHECKPOINT.md`.
2. Configure hosted environment variables.
3. Build from the frozen release candidate.
4. Deploy only after deployment approval.
5. Run hosted health checks.
6. Run private-beta readiness and beta gate.
7. Verify admin owner access.
8. Verify request-access and invitation URL generation.
9. Verify live AI and Open Banking disabled.
10. Run synthetic acceptance test.

## Rollback Order

1. Stop new invitations.
2. Suspend beta admission.
3. Preserve logs and correlation IDs.
4. Roll back application deployment if app release is faulty.
5. Restore database from verified backup if schema/data state is unsafe.
6. Re-run restricted-role and RLS checks.
7. Re-run smoke tests.
8. Resume only after human approval.

## Operator Steps

- [ ] Review `docs/RELEASE_OPERATIONS_READINESS_REVIEW.md`.
- [ ] Review `docs/PRIVATE_BETA_OPERATOR_RUNBOOK.md`.
- [ ] Review `docs/PRIVATE_BETA_ACCEPTANCE_TEST_PLAN.md`.
- [ ] Review `docs/BETA_OPERATIONS_GUIDE.md`.
- [ ] Review `docs/BETA_METRICS.md`.
- [ ] Review `docs/OBSERVABILITY_CHECKLIST.md`.
- [ ] Review `docs/BETA_EXIT_CRITERIA.md`.
- [ ] Approve or reject deployment.
- [ ] Approve or reject first synthetic hosted user.
- [ ] Approve or reject first real private-beta user.

## Tester Steps

1. Redeem invitation.
2. Confirm email.
3. Sign in.
4. Complete onboarding.
5. Add synthetic Financial Vault data.
6. Review dashboard explanations.
7. Create a goal.
8. Create a Digital Twin scenario.
9. Review a decision.
10. Start a workflow.
11. Open Daily Review.
12. Confirm AI CFO and Open Banking disabled states.
13. Sign out and back in.
14. Report confusing, wrong-looking or unsafe behavior.

## Go / No-Go Checklist

Go only if:

- [x] Migrations applied and verified.
- [ ] Rollback-check passed.
- [ ] Hosted deployment approved.
- [ ] Hosted health checks passed.
- [ ] Private beta readiness passed.
- [ ] Beta gate passed.
- [ ] Admin owner access passed.
- [ ] Synthetic acceptance test passed.
- [ ] No SEV-1 or admission-blocking SEV-2 issue open.
- [ ] Live AI disabled.
- [ ] Open Banking disabled.
- [ ] Human approval recorded.

No-go if:

- [ ] Migration or rollback evidence is missing.
- [ ] Cross-user isolation cannot be proven.
- [ ] Auth/RBAC fails.
- [ ] Service-role key appears in browser or logs.
- [ ] Database outage falls back to local/demo data.
- [ ] Invitation token leaks or can be reused.
- [ ] Hosted app URL generates `0.0.0.0` links.
- [ ] Any destructive action is required without approval.

## Final Result

`DEPLOYMENT_READY_REQUIRES_HUMAN_APPROVAL`
