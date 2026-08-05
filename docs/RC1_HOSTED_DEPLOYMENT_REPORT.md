# RC1 Hosted Deployment Report

Final outcome: `HOSTED_DEPLOYMENT_BLOCKED`

Date: 2026-08-05

Scope: RC1 hosted deployment attempt only. No product code, schema, migration, private-beta activation, invitation, public launch, live AI, Open Banking, destructive deletion, commit, publication, or real-user action was performed.

## Deployment

Deployment did not start because no concrete hosted deployment target was available to the operator process.

Verified secret-safe configuration state:

| Check | Result |
| --- | --- |
| `.vercel/project.json` project binding | Missing |
| `.openai/hosting.json` hosting binding | Missing |
| Vercel CLI on PATH | Missing |
| `VERCEL_TOKEN` | Missing from process, user and machine environment |
| `VERCEL_ORG_ID` | Missing from process, user and machine environment |
| `VERCEL_PROJECT_ID` | Missing from process, user and machine environment |
| `VIREON_REMOTE_BETA_URL` | Missing from process, user and machine environment |
| `NEXT_PUBLIC_APP_URL` / `VIREON_PUBLIC_APP_URL` | Missing from process, user and machine environment |

Repository-local `.env.local` contains Supabase and database variable names, but it does not contain hosted deployment target variables or a public hosted app URL. No values were printed.

The existing local build artefact directory `.next` exists and contains a `BUILD_ID`, with last write time recorded by the filesystem as 2026-08-05 07:23:06 local time. This is not hosted deployment evidence.

## Smoke Tests

Hosted smoke tests were not executed because no hosted deployment URL exists.

The planned smoke sequence remains in:

- `docs/RC1_HOSTED_SMOKE_TEST_PLAN.md`

Blocked smoke items:

1. application starts
2. login
3. invitation redemption
4. onboarding
5. Financial Vault
6. Goals
7. Forecast
8. Dashboard
9. Decision Centre
10. Digital Twin
11. export request
12. deletion rehearsal request
13. logout
14. session restore

## Operational Verification

Documentation coverage exists for:

- deployment readiness: `docs/RC1_DEPLOYMENT_READINESS_REPORT.md`
- rollback and operator procedure: `docs/PRIVATE_BETA_OPERATOR_RUNBOOK.md`
- incident response and support: `docs/BETA_OPERATIONS_GUIDE.md`
- beta approval and activation: `PRIVATE_BETA_ACTIVATION_PACKAGE.md`
- hosted smoke: `docs/RC1_HOSTED_SMOKE_TEST_PLAN.md`
- observability: `docs/OBSERVABILITY_CHECKLIST.md`
- migration checkpoint: `docs/RC1_MIGRATION_CHECKPOINT.md`

Operational readiness could not be verified against a hosted runtime because deployment did not start.

## Known Issues

- A hosted deployment target is not configured in the repository or current environment.
- A hosted public URL is not configured.
- Hosting-provider credentials are not available to this process.
- Hosted environment variable completeness cannot be verified without a selected host/project.

## Residual Risks

| Risk | Status |
| --- | --- |
| Hosted environment drift | Unverified |
| Hosted Supabase connectivity | Unverified |
| Hosted PostgreSQL connectivity | Unverified |
| Hosted health endpoints | Unverified |
| Hosted startup logs | Unverified |
| Hosted monitoring/logging | Unverified |
| Hosted smoke journeys | Not run |

## Recommendation

Do not proceed to private-beta activation.

Minimum operator action required:

1. Select or confirm the hosted deployment provider and project.
2. Install or provide the deployment mechanism for that provider.
3. Configure encrypted hosted environment variables from `docs/RC1_DEPLOYMENT_READINESS_REPORT.md`.
4. Configure `VIREON_PUBLIC_APP_URL` or `NEXT_PUBLIC_APP_URL` to the final HTTPS beta URL.
5. Provide non-secret target metadata to the operator process, for example project binding or safe project identifiers.
6. Re-run the RC1 hosted deployment program.

After deployment succeeds, run `docs/RC1_HOSTED_SMOKE_TEST_PLAN.md` before any private-beta activation decision.
