# RC1 Deployment Readiness Report

Status: `DEPLOYMENT_READY_REQUIRES_HUMAN_APPROVAL`

Date: 2026-08-05

Scope: deployment approval review only. No product code, schema, migration, deployment, private-beta activation, invitation, live AI, Open Banking, commit, destructive deletion, publication, or real-user action was performed.

## Reviewed Artefacts

- `docs/RELEASE_CANDIDATE_1.md`
- `PRIVATE_BETA_ACTIVATION_PACKAGE.md`
- `docs/PRIVATE_BETA_OPERATOR_RUNBOOK.md`
- `docs/RC1_MIGRATION_CHECKPOINT.md`
- `docs/RELEASE_OPERATIONS_READINESS_REVIEW.md`
- `docs/ARCHITECTURE_FREEZE.md`
- `docs/EXTERNAL_PRIVATE_BETA_DEPLOYMENT.md`
- `next.config.ts`
- `package.json`
- `src/lib/publicAppUrl.ts`

## Deployment Order

1. Confirm RC1 deployment approval is recorded.
2. Confirm migrations `0009` and `0010` remain applied and verified; do not rerun them as part of deployment approval.
3. Configure the hosted environment using encrypted platform variables.
4. Confirm public URL configuration uses `VIREON_PUBLIC_APP_URL` or `NEXT_PUBLIC_APP_URL`; never use `0.0.0.0`.
5. Build from the frozen RC1 source state.
6. Deploy only after explicit deployment approval.
7. Run hosted health checks.
8. Run hosted private-beta readiness and beta gate.
9. Run the hosted smoke-test sequence in `docs/RC1_HOSTED_SMOKE_TEST_PLAN.md`.
10. Record evidence and stop for separate private-beta activation approval.

## Rollback Order

1. Stop new invitations and pause admission.
2. Preserve logs, correlation IDs, deployment ID and migration checkpoint.
3. Roll back the application deployment to the previous known-good release if hosted smoke fails because of application behavior.
4. Keep migrations `0009` and `0010` in place unless the database state is unsafe and a human-approved restore procedure is chosen.
5. Restore from the verified backup only if the database state is unsafe.
6. Re-run restricted runtime role, RLS and hosted smoke checks after rollback or restore.
7. Resume only after human approval.

## Required Hosted Environment

All values must be configured as hosting-platform environment variables. Operators may print `PRESENT` or `MISSING` only, never values.

| Variable | Required | Deployment Expectation |
| --- | --- | --- |
| `VIREON_EXECUTION_MODE` | Yes | `PRIVATE_BETA` |
| `VIREON_PUBLIC_APP_URL` or `NEXT_PUBLIC_APP_URL` | Yes | Public HTTPS URL; not localhost or `0.0.0.0` |
| `DATABASE_URL` or `VIREON_APPLICATION_DATABASE_URL` | Yes | Restricted runtime app database connection |
| `VIREON_DATABASE_SSL_MODE` or connection `sslmode` | Yes | `require` or stronger |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser-safe anon key only |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only |
| `VIREON_SESSION_SECRET` | Yes | Strong non-placeholder value |
| `VIREON_MIGRATION_VERSION` | Yes | `0010_rls_security_findings` or equivalent latest applied marker |
| `VIREON_LIVE_AI_ENABLED` | Yes | Must not be `true` |
| `VIREON_OPEN_BANKING_ENABLED` | Yes | Must not be `true` |
| `VIREON_LOCAL_JSON_FALLBACK` | Yes | Must be absent or exactly `false` |
| `VIREON_DEFAULT_WORKSPACE_ID` | Yes | Existing default workspace identifier |
| `VIREON_DEFAULT_ORG_ID` | Yes | Existing default organization identifier |
| `VIREON_STORAGE_ENDPOINT` | Required if uploads/downloads are enabled | Private object storage endpoint |
| `VIREON_STORAGE_BUCKET` | Required if uploads/downloads are enabled | Private object storage bucket |
| `VIREON_STORAGE_ACCESS_KEY` | Required if uploads/downloads are enabled | Server-only |
| `VIREON_STORAGE_SECRET_KEY` | Required if uploads/downloads are enabled | Server-only |
| `VIREON_INVITATION_EMAIL_FROM` | Required before real invitations | Verified sender |
| `VIREON_EMAIL_PROVIDER_KEY` | Required before real invitations | Server-only |
| `VIREON_BETA_SUPPORT_OWNER` | Yes | Support owner/contact reference |
| `VIREON_DEPLOYMENT_VERSION` | Yes | RC1 release/deployment identifier |
| `VIREON_COMMIT_SHA` or host commit SHA | Yes | Source revision identifier |

## Supabase Configuration

Required before deployment:

- Supabase Auth enabled for email/password.
- Email confirmation policy preserved; do not disable confirmation to simplify testing.
- Service-role key available server-side only.
- Browser bundle exposes only the public URL and anon key.
- Owner/admin metadata remains trusted `app_metadata`.
- `manage:private_beta_access` is granted through RBAC, not hardcoded identity.
- Invitation redemption uses Supabase Auth only.

## PostgreSQL Configuration

Required before deployment:

- Migrations `0009` and `0010` applied in the non-production pilot.
- Restricted runtime role is `vireon_app`.
- Runtime role is not owner, postgres, migration role or service-role proxy.
- SSL required.
- `public.users` RLS enabled and forced.
- Metadata tables `schema_migrations` and `private_beta_migration_status` are restricted SELECT-only for runtime.
- No local JSON fallback is active in hosted private beta.

## DNS And Base URL

- Public app URL must be HTTPS.
- Generated links must use `VIREON_PUBLIC_APP_URL` first, then `NEXT_PUBLIC_APP_URL`.
- `0.0.0.0`, bind hosts and localhost are invalid for hosted private beta links.
- Reverse-proxy Host derivation is acceptable only when configured public URL is absent and the request headers are trusted by the host.

## Startup And Health

Startup command:

```text
npm run start
```

Pre-deployment build command:

```text
npm run build
```

Hosted health/readiness endpoints to verify after deployment:

- `/api/health`
- `/api/private-beta/readiness`
- `/api/private-beta/operations`
- `/api/auth/session`
- `/login`
- `/login/request-access`
- `/admin/private-beta/access`

Expected high-level health:

- app reachable
- PostgreSQL available
- restricted runtime role active
- Supabase Auth configured
- private beta gate active
- live AI disabled
- Open Banking disabled
- no local fallback

## Monitoring Readiness

Monitoring must cover:

- application availability
- route latency and error rate
- PostgreSQL connectivity/timeouts
- authentication failures
- RBAC denials
- access request, invitation and redemption events
- onboarding completion
- export/deletion lifecycle state
- background job failures
- local fallback detection
- live AI/Open Banking flag drift
- secret leakage alerts

## Operator Checklist Completeness

Complete enough for deployment approval:

- Migration order and state: covered by `docs/RC1_MIGRATION_CHECKPOINT.md`.
- Rollback order: covered by runbook and this report.
- Hosted smoke tests: covered by `docs/RC1_HOSTED_SMOKE_TEST_PLAN.md`.
- Operational support: covered by `docs/BETA_OPERATIONS_GUIDE.md`.
- Observability: covered by `docs/OBSERVABILITY_CHECKLIST.md`.
- Go/no-go: covered by `docs/RC1_DEPLOYMENT_APPROVAL_PACKAGE.md`.

## Decision

No deployment-blocking documentation or configuration defect was found during this review.

Final deployment decision remains a human approval gate.
