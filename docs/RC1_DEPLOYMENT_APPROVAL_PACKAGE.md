# RC1 Deployment Approval Package

Final outcome: `DEPLOYMENT_READY_REQUIRES_HUMAN_APPROVAL`

Date: 2026-08-05

Scope: deployment approval only. This package does not approve production launch, private-beta activation, real invitations, public release, live AI, Open Banking, destructive deletion, deployment, publication, commit, or schema changes.

## Deployment Readiness

RC1 is ready for a human deployment go/no-go decision.

Accepted baseline:

- `RELEASE_CANDIDATE_1` complete.
- Architecture freeze active.
- Release Operations artefacts complete.
- Migrations `0009` and `0010` applied and verified in the approved non-production pilot.
- Bootstrap and rollback rehearsal passed.
- Restricted runtime role verified.
- `public.users` RLS enabled and forced.
- Cross-user isolation verified.
- Product implementation remains frozen.

## Remaining Risks

| Risk | Status | Operator Action |
| --- | --- | --- |
| Hosted environment drift | Open until deployed smoke passes | Verify every required hosted variable and run hosted smoke. |
| Email delivery | Open until synthetic hosted invitation test passes | Use synthetic mailbox only before real invitations. |
| Real-user usability | Expected beta risk | Start with owner/internal synthetic rehearsal, then small family/trusted cohort only after approval. |
| Monitoring maturity | Needs hosted verification | Confirm logs, alerts and daily checks after deployment. |
| Full public readiness | Out of scope | Do not treat private-beta readiness as public production approval. |

## Known Limitations

- Live AI remains disabled unless separately approved.
- Open Banking remains disabled unless separately approved.
- Export/deletion lifecycle is durable, but destructive deletion execution remains separately gated.
- The product is private beta, not regulated advice or public production.
- Hosted smoke evidence does not exist until after deployment approval and deployment.

## Outstanding Approvals

| Approval | Required Before |
| --- | --- |
| Deploy RC1 | Any hosted deployment. |
| Admit first internal synthetic hosted user | After hosted smoke passes. |
| Send a real invitation | After synthetic hosted rehearsal and human go/no-go. |
| Activate private beta for real users | Separate activation approval. |
| Enable live AI | Separate provider, budget, safety and product approval. |
| Enable Open Banking | Separate provider, compliance and product approval. |

## Rollback Confidence

Rollback confidence is acceptable for deployment approval because:

- Pilot rollback-check passed after migrations `0009` and `0010`.
- Restore target was separate and approved disposable.
- Migration checkpoint records checksums, RLS state, grants and restricted-role verification.
- Application rollback is expected to use the hosting platform previous deployment.

Rollback remains operational backup/restore; no destructive down migration is implied.

## Migration State

| Migration | State |
| --- | --- |
| `0009_private_beta_activation_lifecycle` | Applied and verified |
| `0010_rls_security_findings` | Applied and verified |

Evidence: `docs/RC1_MIGRATION_CHECKPOINT.md`.

## Monitoring Readiness

Monitoring checklist exists and covers:

- route latency
- app availability
- PostgreSQL availability
- auth/RBAC failures
- invitation lifecycle
- onboarding
- export/deletion lifecycle
- background jobs
- persistence unavailable states
- live AI/Open Banking drift
- local fallback detection
- secret-safe logging

Hosted alert wiring still needs verification after deployment.

## Support Readiness

Support artefacts exist:

- `docs/PRIVATE_BETA_OPERATOR_RUNBOOK.md`
- `docs/BETA_OPERATIONS_GUIDE.md`
- `docs/PRIVATE_BETA_ACCEPTANCE_TEST_PLAN.md`
- `docs/BETA_EXIT_CRITERIA.md`

Support must use synthetic reproduction data where possible and must not request passwords, raw tokens, full financial documents or unredacted provider payloads.

## Go / No-Go Checklist

Go for deployment only if:

- [ ] Human deployment approval is recorded.
- [ ] Hosted variables are configured and secret-safe diagnostics show required values as present.
- [ ] Hosted public URL is HTTPS and not `0.0.0.0`.
- [ ] Runtime database role is restricted `vireon_app`.
- [ ] Live AI disabled.
- [ ] Open Banking disabled.
- [ ] Local JSON fallback disabled.
- [ ] Previous deployment rollback target identified.
- [ ] Operator is ready to run hosted smoke immediately after deployment.

No-go if:

- [ ] Any secret is missing or appears in logs.
- [ ] Hosted app would use admin DB credentials at runtime.
- [ ] Hosted app URL or invitation link would use `0.0.0.0`.
- [ ] PostgreSQL is unavailable and the app would silently fall back.
- [ ] Supabase Auth or RBAC configuration is incomplete.
- [ ] Private beta would be activated as part of deployment.
- [ ] Real invitations would be sent as part of deployment.

## Decision

`DEPLOYMENT_READY_REQUIRES_HUMAN_APPROVAL`

Recommended next human action: approve or reject RC1 hosted deployment. Private-beta activation remains a later, separate approval gate after hosted smoke and synthetic rehearsal.
