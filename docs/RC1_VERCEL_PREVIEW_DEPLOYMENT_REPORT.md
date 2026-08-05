# RC1 Vercel Preview Deployment Report

Final outcome: `HOSTED_DEPLOYMENT_BLOCKED`

Date: 2026-08-05

Scope: Vercel hosting setup and Preview-only RC1 deployment attempt. No product code, schema, migrations, private-beta activation, invitations, real-user admission, live AI, Open Banking, destructive deletion, commit, reset, stash, or clean action was performed.

## 1. Unintended Production Deployment Incident

Two Vercel CLI deployments were created during the approved hosting setup. Both were reported by Vercel as `target production`.

First unintended deployment:

| Field | Value |
| --- | --- |
| Deployment ID | `dpl_Bff8q6Madc6VHcPSAnB6G3352qPz` |
| URL | `https://vireon-private-beta-1f8k25k3h-vireon3.vercel.app` |
| Target | `production` |
| Production alias | `https://vireon-private-beta.vercel.app` |
| Removal result | Removed successfully |

Second unintended deployment:

| Field | Value |
| --- | --- |
| Deployment ID | `dpl_7QeMq5jUdGuaWF2HNJo1tkBJgkuw` |
| URL | `https://vireon-private-beta-qncvd2riy-vireon3.vercel.app` |
| Target | `production` |
| Production alias | `https://vireon-private-beta.vercel.app` |
| Removal result | Removed successfully after explicit human approval |

No private-beta activation, real-user invitation, live AI, Open Banking, destructive deletion, custom domain, promotion command, or production smoke test was performed.

## 2. Root Cause

Root cause is a Vercel CLI/project-target behavior mismatch:

- A plain `vercel deploy` on the first deployment was assigned to Production by Vercel because it was the project's first deployment.
- The first deployment was removed successfully.
- A second deployment using the explicit command `vercel deploy --target=preview --yes --json` still returned `"target": "production"` and attached the production alias.
- `vercel deploy --target=preview --skip-domain` was attempted first as a safety guard, but Vercel rejected it before deployment because `--skip-domain` is allowed only with production deployments.

This means the current local CLI/project configuration cannot be trusted to create a Preview-only deployment from this working tree.

## 3. Deployment Removal Result

Both unintended deployments were removed.

First removal:

```text
vercel remove https://vireon-private-beta-1f8k25k3h-vireon3.vercel.app --yes
```

Second removal:

```text
vercel remove https://vireon-private-beta-qncvd2riy-vireon3.vercel.app --yes
```

Verification:

- `vercel inspect` could no longer find `vireon-private-beta-1f8k25k3h-vireon3.vercel.app`.
- `vercel inspect` could no longer find `vireon-private-beta-qncvd2riy-vireon3.vercel.app`.
- `vercel ls` reported no deployments under `vireon3`.
- `https://vireon-private-beta.vercel.app` returned 404 after removal.
- Project `vireon-private-beta` remained present.
- Preview environment variables remained configured.

No active deployment remains for the project.

## 4. Project Preservation Result

| Item | Result |
| --- | --- |
| Vercel CLI | Present |
| Vercel CLI version | `58.5.1` |
| Authenticated account | `alexbecker1-2371` |
| Active team | `vireon3` / `Vireon` |
| Project | `vireon-private-beta` |
| Project binding | Created |
| Framework detected | Next.js |
| Repository root | `C:\Users\summe\liberva` |

`vercel link --yes --team vireon3 --project vireon-private-beta` created/linked the project and wrote `.vercel/project.json`. No project IDs or tokens are included in this report.

## 5. Explicit Preview Command Used

The explicit Preview command was:

```text
vercel deploy --target=preview --yes --json
```

Vercel nevertheless reported:

```json
{
  "target": "production",
  "readyState": "READY"
}
```

The deployment was therefore blocked before hosted smoke testing.

## 6. Preview Deployment ID And URL

No valid Preview deployment exists.

The attempted explicit Preview deployment was instead reported as Production:

- Deployment ID: `dpl_7QeMq5jUdGuaWF2HNJo1tkBJgkuw`
- URL: `https://vireon-private-beta-qncvd2riy-vireon3.vercel.app`
- Production alias: `https://vireon-private-beta.vercel.app`

## 7. Proof That No Production Alias Is Attached

Satisfied after removal.

- `vercel ls` reported no deployments under `vireon3`.
- `https://vireon-private-beta.vercel.app` returned 404.
- `vercel project inspect vireon-private-beta` still found the project.

No valid Preview deployment exists yet, so hosted smoke testing remains blocked.

## 8. Supabase Redirect Configuration

Not performed.

Do not add hosted redirects until the deployment target issue is resolved and a real Preview-only URL exists.

## 9. Environment-Variable Completeness

Preview environment variables were configured through Vercel CLI stdin so secret values were not passed as command arguments.

Configured for Preview:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `SUPABASE_DATABASE_URL`
- `VIREON_DATABASE_SSL_MODE`
- `VIREON_PERSISTENCE_MODE`
- `VIREON_LOCAL_JSON_FALLBACK`
- `VIREON_LIVE_AI_ENABLED`
- `VIREON_OPEN_BANKING_ENABLED`
- `VIREON_SYNTHETIC_DATA_ONLY`
- `VIREON_MIGRATION_VERSION`
- `VIREON_DEPLOYMENT_VERSION`
- `VIREON_COMMIT_SHA`
- `VIREON_DEFAULT_WORKSPACE_ID`
- `VIREON_DEFAULT_ORG_ID`
- `VIREON_EXECUTION_MODE`
- `VIREON_SESSION_SECRET`

Excluded intentionally:

- `OPENAI_API_KEY`, because live AI is not approved.
- migration/admin database credentials.
- rollback/bootstrap/operator-only variables.
- local psql executable discovery variables.

Important correction: the first attempt to generate `VIREON_SESSION_SECRET` used an unsupported PowerShell RNG method. The Preview variable was immediately rotated using `System.Security.Cryptography.RandomNumberGenerator.Create()` before deployment.

Not yet configured:

- `VIREON_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_URL`

Reason: the exact Vercel deployment URL was unknown until after first deployment.

## 10. Local Validation Before Deployment

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, 29 known warnings, 0 errors |
| `npm run test` | PASS, 867/867 |
| `npm run build` | PASS |
| `npm run validate` | PASS |

No migrations were rerun.

## 11. Hosted Runtime Compatibility

Not verified.

The hosted runtime compatibility check was not reached because the deployment target remained Production.

Outstanding required check after a valid Preview deployment:

- Determine whether hosted request paths depend on spawning a local Windows `psql` executable.
- If any hosted path depends on `C:\Program Files\PostgreSQL\18\bin\psql.exe`, stop with `HOSTED_DEPLOYMENT_BLOCKED_SERVERLESS_DATABASE_RUNTIME`.

## 12. Smoke Results

Not run.

Reason: stop condition triggered by Vercel assigning both deployment attempts to Production.

Smoke plan remains available at:

- `docs/RC1_HOSTED_SMOKE_TEST_PLAN.md`

## 13. Logs And Errors

Build logs for both Vercel deployments showed successful Next.js builds and did not print application secret values.

Critical error:

- Vercel returned `target production` despite the explicit `--target=preview` command.

## 14. Auth And Session Results

Hosted auth/session checks were not run after deployment because the Production-target stop condition was reached.

## 15. Background-Job Compatibility

Not verified.

## 16. Export/Deletion Compatibility

Not verified.

No export or deletion action was run.

## 17. Known Limitations

- Vercel assigned both attempted deployments to Production.
- Even `vercel deploy --target=preview --yes --json` returned `target production`.
- A non-deploying dry run with `vercel deploy --target=preview --dry` completed, but it does not prove the next real deployment will be Preview-only because the prior real command with the same target still created Production.
- Public URL variables are not configured yet.
- Supabase hosted redirects are not configured yet.
- Hosted smoke has not run.
- Hosted PostgreSQL runtime compatibility has not been proven.

## 18. Required Remediation

Immediate required operator action:

1. Determine why the Vercel CLI/project maps local deploys to Production even with `--target=preview`.
2. Use a verified Preview-only path before any hosted smoke:
   - Git branch Preview deployment through Vercel Git integration, or
   - a separate non-production Vercel project dedicated to preview testing, or
   - Vercel support/project setting correction that makes `--target=preview` produce a Preview deployment.

Do not configure Supabase hosted redirects, run smoke tests, or activate beta until the deployment target is corrected.

## 19. Recommendation

`HOSTED_DEPLOYMENT_BLOCKED`

Do not proceed to private-beta activation.

Do not run hosted smoke until the production alias is removed and a Preview-only deployment URL is available.
