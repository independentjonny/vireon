# RC1 Dedicated Hosted Test Report

Status: HOSTED_DEPLOYMENT_BLOCKED_SERVERLESS_DATABASE_RUNTIME
Generated: 2026-08-05

## Summary

The original Vercel project `vireon3/vireon-private-beta` was abandoned for hosted RC1 testing because Git deployments from `rc1-hosted-preview` continued to be classified as Production. A new dedicated non-production project was created for synthetic hosted RC1 testing.

## Dedicated Test Project

- Vercel project: `vireon3/vireon-rc1-hosted-test`
- Project ID: `prj_xPCMbngu6B7BHup5VMbPA0BZgphR`
- Connected repository: `https://github.com/independentjonny/vireon.git`
- Git branch: `rc1-hosted-preview`
- Latest trigger commit: `d381a0f92c456f406120dc5c71de353d83ddf803`
- Deployment ID: `dpl_DArhN9mR59LkrWD1PHXoLXz7wbZX`
- Deployment URL: `https://vireon-rc1-hosted-test-n2497g7ny-vireon3.vercel.app`
- Stable branch alias: `https://vireon-rc1-hosted-test-git-rc1-hosted-preview-vireon3.vercel.app`
- Vercel target: `preview`
- Vercel status: `Ready`

## Non-Production Classification

This project is dedicated to hosted RC1 testing only:

- `NON_PRODUCTION`
- `SYNTHETIC_DATA_ONLY`
- `HOSTED_RC1_TEST`

The project is not the future production Vireon project and no private beta activation, real invitation, live AI, Open Banking, destructive deletion, production promotion or public launch was performed.

## Environment Configuration

The dedicated project was configured with branch-scoped Preview environment variables for `rc1-hosted-preview`, including:

- hosted RC1 test environment markers
- synthetic-data-only controls
- SSL-required database controls
- local JSON fallback disabled
- live AI disabled
- Open Banking disabled
- private-beta real-user activation disabled
- browser-safe Supabase public configuration
- server-only Supabase service configuration
- restricted PostgreSQL runtime configuration
- session secret
- default workspace and organisation identifiers

Secret values were not printed or written to this report.

## Vercel Target Configuration

Observed target configuration:

- Production Branch: `main`
- Preview: all unassigned Git branches
- Development: accessible by CLI
- `rc1-hosted-preview` deployment target: `preview`
- Latest Preview deployment aliases: branch Preview alias only

## Hosted Runtime Compatibility

Vercel Deployment Protection was disabled for the dedicated non-production hosted test project after operator approval. The Preview deployment is now externally reachable.

Observed deployment-protection state after the approved change:

- Project protection: `ssoProtection: null`
- Stable Preview branch alias: HTTP 200 for `/login`

Hosted PostgreSQL-backed request paths then failed at runtime:

- `GET /api/health`: HTTP 200, database configuration detected
- `POST /api/private-beta/request-access`: HTTP 503, `PRIVATE_BETA_INVITATION_STORE_UNAVAILABLE`
- Vercel logs show the request reached the Preview deployment and returned 503 from the application route.

Code inspection still identifies a likely serverless compatibility risk:

- `src/server/db/postgresRuntime.ts` uses `child_process.spawn` and the `psql` executable for runtime PostgreSQL queries and transactions.
- Hosted Vercel serverless runtime is not expected to provide the local Windows PostgreSQL executable path used in local testing.

The public access-request route enters `createPrivateBetaInvitationServiceFromEnv()` and attempts a PostgreSQL transaction through the runtime database client. That runtime client shells out to `psql`; the hosted serverless environment does not provide the local PostgreSQL executable path. The route catches the database failure and correctly returns a safe 503, but this blocks hosted RC1 smoke testing until the database runtime is serverless-compatible.

## Smoke Test Results

Smoke testing stopped at the deployment-protection gate.

| Check | Result | Evidence |
| --- | --- | --- |
| Dedicated project created | PASS | `vireon3/vireon-rc1-hosted-test` exists |
| Git repository connected | PASS | `independentjonny/vireon` connected |
| Branch deployment triggered by Git | PASS | commit `d381a0f92c456f406120dc5c71de353d83ddf803` |
| Deployment target is Preview | PASS | deployment `dpl_DArhN9mR59LkrWD1PHXoLXz7wbZX`, target `preview` |
| Preview URL captured | PASS | `https://vireon-rc1-hosted-test-n2497g7ny-vireon3.vercel.app` |
| Product route smoke | BLOCKED | PostgreSQL-backed access request returns 503 |
| Serverless PostgreSQL runtime | BLOCKED | Runtime database layer depends on spawned `psql` |
| Supabase redirect configuration | PENDING | Requires final reachable Preview URL decision after protection gate |

## Limitations

- PostgreSQL-backed product routes fail in hosted runtime before broad smoke testing can start.
- The older dedicated-project Production deployment created before Preview branch environment setup still exists separately from the latest Preview deployment. It was not removed without an explicit cleanup approval for the new dedicated project.
- Serverless database runtime is the active blocker. The runtime database layer must stop relying on spawned `psql` for hosted request paths.

## Cleanup / Removal Procedure

If the dedicated hosted test project is no longer needed, remove only `vireon3/vireon-rc1-hosted-test` or its test deployments from Vercel. Do not modify `vireon3/vireon-private-beta` as part of that cleanup unless separately approved.

## Recommendation

Replace the hosted runtime PostgreSQL access path with a serverless-compatible PostgreSQL client while preserving the restricted `vireon_app` role, transaction-local user scoping, fail-closed behavior, redaction and existing repository contracts. Then redeploy the dedicated Preview and rerun hosted runtime compatibility before broad smoke testing.
