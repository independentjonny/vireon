# Private Beta Operator Runbook

Status: `DEPLOYMENT_READY_REQUIRES_HUMAN_APPROVAL`

This runbook is for controlled private-beta activation only. It does not authorize deployment, migration application, real-user invitations, live AI, Open Banking, public launch, or destructive data operations.

## Operator Principles

- Never print, paste, screenshot, commit, or email secrets.
- Use synthetic data until the explicit first-user approval gate.
- Stop on failed critical checks.
- Preserve logs, timestamps and correlation IDs.
- Do not bypass Supabase Auth, RBAC, PostgreSQL RLS, or invitation approval.
- Do not run destructive SQL or force git operations.

## Environment Setup

Required before deployment:

| Variable | Required | Notes |
| --- | --- | --- |
| `VIREON_EXECUTION_MODE` | Yes | Must be `PRIVATE_BETA` in hosted beta. |
| `NEXT_PUBLIC_APP_URL` or `VIREON_PUBLIC_APP_URL` | Yes | Must be the public HTTPS app URL. Never `0.0.0.0`. |
| `DATABASE_URL` | Yes | Restricted runtime application database URL. SSL required. |
| `VIREON_DATABASE_SSL_MODE` | Yes | `require` or stronger. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser-safe anon key only. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only. Never expose to browser. |
| `VIREON_SESSION_SECRET` | Yes | Strong non-placeholder secret. |
| `VIREON_MIGRATION_VERSION` | Yes | Latest applied migration ID. |
| `VIREON_LIVE_AI_ENABLED` | Yes | Must not be `true` for private beta. |
| `VIREON_OPEN_BANKING_ENABLED` | Yes | Must not be `true` for private beta. |

Expected safe diagnostic output:

```text
NEXT_PUBLIC_SUPABASE_URL=PRESENT
SUPABASE_SERVICE_ROLE_KEY=PRESENT
DATABASE_URL=PRESENT
ssl=require
runtimeRole=vireon_app
```

Failure example:

```text
SUPABASE_SERVICE_ROLE_KEY=MISSING
startup=BLOCKED
```

Decision: stop deployment and correct the hosting secret configuration.

## PostgreSQL Setup

1. Confirm the primary project reference.
2. Confirm the restore project reference is different.
3. Confirm the restore project is disposable.
4. Confirm PostgreSQL client tooling is installed.
5. Hydrate required variables into the operator shell without printing values.
6. Run:

```powershell
npm run postgres:operator:preflight
npm run postgres:pilot:validate-targets
npm run postgres:pilot:bootstrap
```

Expected:

```text
status=PASS
ssl=PASS
applicationRole=PASS
primaryRestoreSeparation=PASS
```

Failure decision tree:

| Failure | Action |
| --- | --- |
| Missing database URL | Stop. Configure environment. |
| Same primary and restore project | Stop. Create a separate restore target. |
| SSL failure | Stop. Fix connection string or provider settings. |
| Runtime role is not `vireon_app` | Stop. Re-provision restricted runtime role. |
| RLS failure | Stop. Review migrations and policies. |

## Migration State And Recovery

Migrations `0009_private_beta_activation_lifecycle.sql` and `0010_rls_security_findings.sql` have been applied to the approved non-production pilot and verified in `docs/RC1_MIGRATION_CHECKPOINT.md`.

Do not rerun, skip, reorder or manually mark migrations during deployment approval.

For fresh non-destructive verification, review the checkpoint and run:

```powershell
npm run postgres:operator:preflight
npm run postgres:pilot:verify-runtime-access
```

Expected:

```text
migrationStatus=PASS
runtimeAccess=PASS
rollbackCapability=PASS
```

Recovery only:

If a later approved recovery procedure requires replaying the ordered pilot executor, set typed confirmation only in the current shell:

```powershell
$env:VIREON_PILOT_EXECUTE_CONFIRM = "APPLY_MIGRATIONS_TO_PILOT"
npm run postgres:pilot:execute
Remove-Item Env:\VIREON_PILOT_EXECUTE_CONFIRM -ErrorAction SilentlyContinue
```

Expected recovery output:

```text
migrationStatus=PASS
runtimeAccess=PASS
rollbackCapability=PASS
```

Failure example:

```text
migration failed: 0010_rls_security_findings
```

Decision: do not deploy. Preserve output, inspect the failing migration, and restore if the target state is unsafe.

## Rollback And Restore

Rollback is operational backup/restore, not automatic destructive down migration.

Run only against a separate disposable restore project:

```powershell
$env:VIREON_PILOT_RESTORE_DISPOSABLE = "true"
npm run postgres:pilot:rollback-check
Remove-Item Env:\VIREON_PILOT_RESTORE_DISPOSABLE -ErrorAction SilentlyContinue
```

Expected:

```text
status=PASS
restoredSchemaMigrationComparison=PASS
runtimeAccess=PASS
```

If rollback-check fails, stop activation.

## Deployment Readiness

Before deployment:

- [ ] RC1 and architecture freeze reviewed.
- [ ] Migrations approved and applied.
- [ ] Rollback-check passed.
- [ ] Hosted environment variables configured.
- [ ] Live AI disabled.
- [ ] Open Banking disabled.
- [ ] Public app URL verified.
- [ ] Supabase Auth verified.
- [ ] Private storage verified.
- [ ] Admin owner verified.
- [ ] Support contact prepared.

Do not deploy from this runbook without explicit deployment approval.

## Health Checks

Run after deployment:

```powershell
npm run private-beta:readiness
npm run beta:gate
```

Check application routes:

- `/api/health`
- `/api/private-beta/readiness`
- `/admin/private-beta/access`
- `/login`
- `/login/request-access`

Expected:

```text
PRIVATE_BETA_READY
liveAi=false
openBanking=false
postgres=available
```

## Logs And Monitoring

Monitor:

- authentication failures
- private-beta access requests
- admin approvals/rejections/revocations
- invitation redemption
- onboarding completion
- database unavailable events
- route latency
- export/deletion lifecycle states
- RBAC denials
- background job retries

Never log:

- passwords
- service-role keys
- raw invitation tokens
- financial document contents
- full database URLs
- raw user financial values unless explicitly required and redacted

## Emergency Shutdown

Use when a SEV-1 is suspected:

1. Stop issuing invitations.
2. Suspend beta cohort admission.
3. Disable risky feature flags.
4. Move write-heavy flows to unavailable/read-only where possible.
5. Preserve logs and correlation IDs.
6. Notify affected testers with plain language.
7. Do not delete audit evidence.
8. Resume only after root cause, remediation and human approval.

## Manual Invitation And Approval

1. Applicant submits `/login/request-access`.
2. Admin opens `/admin/private-beta/access`.
3. Admin reviews request details.
4. Admin approves only if the applicant belongs in the intended cohort.
5. Vireon reveals the invitation link exactly once.
6. Operator sends the link manually through the approved channel.
7. Operator records that the invite was sent without storing the raw token.

Do not create invitations manually in PostgreSQL.

## Support Workflow

1. Classify the issue.
2. Assign severity.
3. Capture safe evidence.
4. Reproduce with synthetic data where possible.
5. Decide: known limitation, bug, incident, feature request, or user guidance.
6. Respond within the support SLA.
7. Close only after user confirmation or documented no-response timeout.
