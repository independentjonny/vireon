# Vireon External Private Beta Deployment v1

## Scope

This runbook defines the external `PRIVATE_BETA` deployment path. It is operational only. It does not add a financial feature, activate Open Banking, enable live AI, approve a production model, or use real financial data for verification.

Local checks are useful development evidence, but they are not evidence that the externally hosted beta is ready.

## Canonical Architecture

- Frontend/application host: managed Next.js hosting such as Vercel, using server-side route handlers.
- Runtime type: server-rendered Next.js with server-only financial, storage and beta operations APIs.
- Region: APAC region where available, preferably Australia-aligned.
- PostgreSQL provider: managed PostgreSQL with SSL, backups, migration tracking and least-privilege `vireon_app` application role.
- Authentication provider: Supabase Auth or compatible external auth with server-side token verification.
- Private object storage: managed private bucket/container with server-only access and user-scoped object paths.
- Email/invitation provider: transactional email service with verified sender and support reply address.
- DNS/TLS: custom HTTPS beta domain with platform-managed TLS and HTTP-to-HTTPS redirect.
- Secret management: hosting-platform encrypted runtime environment variables.
- Logs: hosted application logs with financial-content and secret redaction.
- Monitoring: provider health checks plus Vireon readiness and daily-check output.
- Backups: managed PostgreSQL backups plus synthetic restore rehearsal before first-user approval.
- Rollback: previous deployment rollback, feature-flag disable, cohort suspension and invitation suspension.

## Environment Contract

`PRIVATE_BETA` startup must fail closed when any required value is missing or unsafe. Secret values must never be logged.

Required private-beta variables:

- `VIREON_EXECUTION_MODE=PRIVATE_BETA`
- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
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

Forbidden in private beta:

- `VIREON_LOCAL_JSON_FALLBACK` unless exactly `false`
- `VIREON_LIVE_AI_ENABLED=true`
- `VIREON_OPEN_BANKING_ENABLED=true`
- live AI provider keys such as `OPENAI_API_KEY`
- localhost application URLs
- default or placeholder session secrets

Optional:

- `VIREON_ANALYTICS_SINK`
- `VIREON_HOSTING_ENVIRONMENT`
- `VIREON_ROLLBACK_REFERENCE`
- `VIREON_DEPLOYMENT_APPROVER`

Local/test only:

- `VIREON_SYNTHETIC_DEMO_DATA`

Startup validation is implemented by `ExternalPrivateBetaDeployment.validateStartupEnvironment`.

## Database Provisioning

Provision managed PostgreSQL before deployment.

Required controls:

- encrypted connections with `require` or `verify-full`
- least-privilege application role provisioned through `npm run postgres:pilot:bootstrap`
- separate migration role where practical
- no public anonymous write access
- backup policy recorded
- migration version recorded in `VIREON_MIGRATION_VERSION`
- user and household ownership constraints
- indexes for user-scoped reads, exports and deletion
- health check visible through readiness APIs

Migration order:

1. provision database, migration role and restore role
2. run `npm run postgres:pilot:validate-targets` to confirm the primary and restore Supabase project references differ
3. run `npm run postgres:pilot:bootstrap` to create or rotate `vireon_app`, derive the application URL and verify preflight
4. run `npm run postgres:pilot:execute:preflight` to verify migration files, target separation and restricted-role readiness without applying migrations
5. set `VIREON_PILOT_EXECUTE_CONFIRM=APPLY_MIGRATIONS_TO_PILOT`
6. run `npm run postgres:pilot:execute` to apply the three canonical migrations, record real checksums, reconcile grants, verify restricted runtime access and rehearse backup/restore against the separate restore project
6. record migration version
7. run remote readiness
8. run two-user synthetic rehearsal

Rollback availability must be recorded per migration. Do not claim destructive migration rollback unless tested.

The restore target should be a second empty Supabase project, for example `vireon-pilot-restore`, using its Session Pooler connection string with `sslmode=require` or `sslmode=verify-full`. Do not reuse the primary pilot project for restore validation.

`0003_supabase_private_beta_security.sql` is required before external beta activation. It enables RLS on the private-beta operational tables and uses the same server-set database identity model as the existing PostgreSQL repositories: `current_setting('app.current_user_id', true)`. Do not use `auth.uid()` policies for Vireon application tables unless those tables are later queried directly by the Supabase browser client.

## Private File Storage

Uploaded financial documents must use private object storage, not public app paths.

Required controls:

- private bucket/container
- no anonymous public access
- server-side authorisation
- user-scoped object paths
- unpredictable object identifiers
- MIME and signature validation
- upload-size limits
- deletion support
- export metadata support
- retention policy
- malware-scanning boundary documented
- short-expiry signed access if downloads are supported

Remote verification must include an anonymous-access rejection check for uploaded objects.

Current storage boundary: financial-document uploads are server-only. The application does not support direct browser Supabase Storage writes for financial documents. The deployment must therefore use a private bucket named `financial-documents`, server-side credentials only, and user-scoped object paths:

```text
users/{userId}/financial-documents/{unpredictableObjectId}/{safeFileName}
```

Because browser-direct storage is not enabled, `0003_supabase_private_beta_security.sql` intentionally creates no `storage.objects` policies for `authenticated` or `anon`. If browser-direct uploads are introduced later, add a new migration with owner-only `storage.objects` policies for `bucket_id = 'financial-documents'`; do not add permissive `USING (true)` or `WITH CHECK (true)` policies.

## Authentication And Invitations

Registration must be invitation-only.

Verify:

- intended-email enforcement where applicable
- secure HTTPS-only cookies
- SameSite settings
- session expiry
- sign-out revocation
- expired invitation handling
- invitation reuse prevention
- revoked invitation blocking
- password reset if enabled
- suspended-user handling
- deleted-account handling
- cross-user isolation

Never trust client-supplied user IDs.

## Email Delivery

Use synthetic mailboxes for deployment verification.

Verify:

- sender identity
- reply/support address
- invitation URL
- invitation expiry
- resend and revoke controls
- email mismatch protection
- delivery failure handling
- safe audit events
- no financial content in email

Do not invite real users until `npm run beta:approve-first-user` records approval.

## Domain TLS And Headers

Verify:

- valid TLS
- HTTP redirects to HTTPS
- canonical external app URL
- HSTS where appropriate
- Content-Security-Policy
- frame protection
- content-type protection
- referrer policy
- permissions policy
- no stack traces in user-facing responses
- no public development source maps unless explicitly approved

Document any hosting-controlled headers.

## Deployment Pipeline

Required stages:

1. install from lockfile
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test`
5. `npm run build`
6. security checks
7. `npm run private-beta:readiness`
8. `npm run beta:gate`
9. migration plan
10. deploy
11. apply migrations
12. smoke test
13. synthetic rehearsal
14. activate cohort
15. monitor
16. record release result

Stop on any failed critical stage.

Separate build-time secrets, runtime secrets and migration credentials. CI/CD must not make live AI calls.

## Deployment Manifest

Every release records:

- release ID
- application version
- commit SHA
- build timestamp
- execution mode
- hosting environment
- database migration version
- feature flags
- calculation versions
- Open Banking state
- live AI state
- local fallback state
- known warnings
- rollback reference
- approver
- deployment outcome
- integrity hash

Manifests are append-only.

## Remote Verification

Run against the hosted app:

```bash
npm run beta:verify-remote -- --url=https://beta.example.com
```

The command checks:

- public app availability
- HTTPS
- readiness endpoint
- `PRIVATE_BETA` execution mode
- PostgreSQL persistence
- migration visibility
- storage readiness
- authentication readiness
- local fallback disabled
- Open Banking disabled
- live AI disabled
- deployment manifest or operations deployment report
- pilot operations daily-check status

It exits non-zero on critical failure and does not print secrets.

## Synthetic Two-User Rehearsal

Before inviting real users, run the deployed journey with two synthetic users.

Each synthetic user must:

1. receive invitation
2. create account
3. sign in
4. complete onboarding
5. enter synthetic financial records
6. import synthetic CSV
7. confirm records
8. view Financial Health
9. view forecast
10. create goal
11. compare scenario
12. view deterministic briefing
13. inspect provenance
14. submit feedback
15. request export
16. sign out and return

Then verify:

- cross-user access is denied both ways
- exports are owner-scoped
- support records contain no financial content
- analytics reject disallowed fields
- uploaded files are isolated
- deletion request is recorded

Use synthetic identities and synthetic financial records only.

## Negative Security Rehearsal

Verify safe failure for:

- unauthenticated API access
- modified client user ID
- cross-user resource identifier
- expired invitation
- reused invitation
- revoked invitation
- disabled feature access
- local-fallback activation attempt
- Open Banking flag activation attempt
- live-AI flag activation attempt
- oversized upload
- invalid MIME
- malicious filename
- public storage URL
- expired session
- unsupported HTTP method
- malformed request body

Every prohibited action must fail without exposing internal details or financial data.

## Backup And Restore

Record:

- backup frequency
- retention
- encryption
- restore procedure
- recovery-point objective
- recovery-time objective
- owner

Perform a synthetic restore rehearsal where supported and verify restored data remains user-scoped.

## Rollback

Verify:

- previous application version rollback
- feature-flag disable
- migration compatibility
- forward-only migration limitations
- failed smoke-test response
- cohort suspension
- invitation suspension

Record the maximum safe rollback point for each migration.

## Monitoring And Logging

Monitor:

- application availability
- error rate
- latency
- database connectivity
- storage failures
- authentication failures
- invitation failures
- import failures
- export failures
- deletion-request failures
- cross-user isolation alerts
- readiness failure
- local-fallback detection
- Open Banking state
- live AI state

Alerts and logs must not include balances, transaction descriptions, income, debts, account numbers, addresses, uploaded document text, access tokens, cookies, database URLs, provider keys or complete financial request bodies.

## Privacy And Terms

The deployed app must state:

- Vireon is a private beta
- Open Banking is inactive
- live AI is disabled
- projections are deterministic estimates
- results depend on user-provided information
- data can be exported
- deletion can be requested
- support and privacy contact process
- uploaded documents are handled privately

Legal wording must be reviewed separately before broader public launch.

## Pilot Owner Runbook

Daily:

- review health
- run daily check
- inspect critical errors
- review failed imports
- review export/deletion failures
- verify Open Banking and live AI remain disabled

Before inviting a user:

- verify gate
- verify cohort capacity
- create invitation
- record consent workflow
- confirm support availability

During an incident:

- classify severity
- suspend access if required
- preserve evidence
- rollback or disable feature
- communicate verified facts
- verify recovery

After each beta session:

- review feedback
- classify issues
- record task completion
- avoid recording financial values

## First Real-User Approval

Run only after all external evidence exists:

```bash
npm run beta:approve-first-user
```

The command requires:

- remote verification passed
- two-user synthetic rehearsal passed
- negative security rehearsal passed
- database backup verified
- rollback verified
- monitoring active
- no open SEV-1 findings
- privacy page deployed
- export tested
- deletion request tested
- invitation delivery tested
- support ready
- explicit human approval

The command records readiness only. It does not send a real invitation.
