# Vireon External PRIVATE_BETA Activation v1

Status: `BLOCKED`

Date: 2026-07-24

## Activation Result

External activation has not been completed. This repository has the external deployment readiness layer, remote verification tooling and first-user approval tooling, but the actual hosted `PRIVATE_BETA` environment has not been provisioned or configured from this workspace.

No real beta users may be invited from the current state.

## Required Deployment Decisions

The following decisions must be explicitly approved before infrastructure changes:

| Decision | Current State | Required Before Activation |
| --- | --- | --- |
| Application host | Not provided | Select managed Next.js host, such as Vercel or equivalent. |
| Deployment region | Not provided | Select APAC/Australia-aligned region where available. |
| PostgreSQL provider | Not provided | Provision managed PostgreSQL with SSL, backups and least-privilege app role. |
| Authentication provider | Not provided | Configure Supabase Auth or compatible server-verified auth. |
| Private file storage provider | Not provided | Configure private bucket/container with server-only access. |
| Invitation email provider | Not provided | Configure verified sender and synthetic mailbox test path. |
| Beta domain | Not provided | Configure external HTTPS domain. |
| Monitoring provider | Not provided | Configure uptime, error, latency and security-state monitoring. |
| Backup policy | Not provided | Record frequency, retention, encryption, RPO, RTO and owner. |
| Expected monthly cost | Not provided | Estimate app host, database, storage, email and monitoring costs. |
| Deployment owner | Not provided | Name accountable pilot owner. |

## Missing Environment Contract

The following private-beta environment requirements are currently absent:

- `VIREON_REMOTE_BETA_URL`
- `VIREON_EXECUTION_MODE=PRIVATE_BETA`
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL` or `SUPABASE_DATABASE_URL`
- `VIREON_DATABASE_SSL_MODE`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VIREON_SESSION_SECRET`
- `VIREON_STORAGE_ENDPOINT`
- `VIREON_STORAGE_BUCKET`
- `VIREON_STORAGE_ACCESS_KEY`
- `VIREON_STORAGE_SECRET_KEY`
- `VIREON_INVITATION_EMAIL_FROM`
- `VIREON_EMAIL_PROVIDER_KEY`
- `VIREON_BETA_SUPPORT_OWNER`
- `VIREON_DEPLOYMENT_VERSION`
- `VIREON_COMMIT_SHA`
- `VIREON_MIGRATION_VERSION`
- `VIREON_LOCAL_JSON_FALLBACK=false`
- `VIREON_LIVE_AI_ENABLED=false`
- `VIREON_OPEN_BANKING_ENABLED=false`

Secret values must be configured only in the hosting provider secret store and must never be committed, logged or displayed.

## Activation Evidence

Required evidence is absent:

- deployment manifest
- remote verification result
- migration result
- storage privacy result
- authentication result
- invitation delivery result
- two-user synthetic rehearsal result
- negative-security rehearsal result
- backup result
- rollback result
- monitoring result
- open-findings record
- human approver record

## Current Boundary

- Open Banking remains inactive.
- Live AI remains disabled.
- No real user financial data was used.
- No real invitations were sent.
- No paid provider calls were made.
- First-user approval remains blocked.

## Next Operational Step

Provision the selected external services and configure the required `PRIVATE_BETA` environment variables. Then run:

```bash
npm run beta:verify-remote -- --url=https://your-beta-domain.example
```

Only after remote verification, deployed two-user rehearsal, negative security rehearsal, storage privacy verification, backup verification, rollback rehearsal and monitoring verification pass should the first-user approval command be run with evidence files:

```bash
npm run beta:approve-first-user
```
