# RC1 Hosted Smoke Test Plan

Status: `READY_FOR_DEPLOYMENT_APPROVAL_REVIEW`

Use synthetic users and synthetic financial data only. Do not invite real users, activate private beta broadly, enable live AI, enable Open Banking, or perform destructive deletion during this smoke.

Each item must be marked PASS or FAIL with an evidence reference.

| # | Journey | Preconditions | Steps | Expected Result | PASS/FAIL | Evidence |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Application starts | Deployment approved and completed; hosted URL known. | Open the hosted root URL and `/api/health`. | App loads over HTTPS; health is available; no stack trace or secret appears. |  |  |
| 2 | Login | Owner account exists with trusted owner metadata. | Open `/login`, enter owner credentials, submit. | Login succeeds; secure session cookie is set; owner is not sent to onboarding unless incomplete. |  |  |
| 3 | Invitation redemption | Synthetic approved invitation exists; raw link captured once by admin. | Open the invitation link, enter intended synthetic email and password. | Account is created or confirmation-pending success appears; no generic failure after Supabase success. |  |  |
| 4 | Onboarding | Synthetic invited user can sign in after confirmation. | Complete `/beta-onboarding`. | Onboarding progress persists; product access opens only after completion. |  |  |
| 5 | Financial Vault | Onboarded synthetic user signed in. | Open `/financial-vault`; add or inspect synthetic facts/documents. | Empty state is helpful when missing; populated state shows persisted facts, confidence and provenance. |  |  |
| 6 | Goals | Synthetic Vault data exists or missing-data state expected. | Open `/goals`; create or inspect a goal. | Goal state is persisted; missing data is not shown as misleading zero. |  |  |
| 7 | Forecast | Synthetic financial inputs available. | Open forecast-related surface and run/view forecast. | Deterministic result appears with assumptions, warnings and no AI fact mutation. |  |  |
| 8 | Dashboard | Synthetic user has either empty or populated data. | Open `/`; inspect health, forecast, cashflow, goals and explanations. | Dashboard uses persisted data; explanations are expandable; unavailable/missing states are distinct. |  |  |
| 9 | Decision Centre | Synthetic calculation or recommendation source exists. | Open Decision Centre and inspect decisions. | Decisions persist with status/history; no duplicate active decision appears. |  |  |
| 10 | Digital Twin | Synthetic Vault data available. | Open `/digital-twin`; create/view scenario and simulation. | Scenario and run persist; assumptions are labelled; no local fallback. |  |  |
| 11 | Export request | Synthetic user signed in. | Submit export lifecycle request only. | Durable export request is recorded; no immediate unsafe disclosure or secret in response. |  |  |
| 12 | Deletion rehearsal request | Synthetic user signed in. | Submit deletion rehearsal/lifecycle request only. | Durable lifecycle request is recorded; no destructive account deletion executes. |  |  |
| 13 | Logout | User signed in. | Sign out and revisit a protected route. | Session is cleared; protected route blocks access safely. |  |  |
| 14 | Session restore | User signs in again, then reloads browser. | Reload dashboard and a persisted domain page. | Session remains valid; persisted records reload from PostgreSQL. |  |  |

## Additional Required Checks

- Verify `/admin/private-beta/access` is available only to an authorized owner/admin.
- Verify non-admin users receive safe 403 or protected-route behavior.
- Verify an invalid or reused invitation cannot create another account.
- Verify generated links never contain `0.0.0.0`.
- Verify Open Banking disabled state is explicit.
- Verify AI CFO live-provider state is disabled or gated as expected.
- Verify mobile viewport has no horizontal scroll on login, onboarding, dashboard and Financial Vault.
- Verify PostgreSQL unavailable simulation returns explicit unavailable state and no local/demo fallback.

## Failure Rules

No-go if any of these fail:

- authentication or session persistence
- RBAC or admin authorization
- cross-user isolation
- invitation single-use behavior
- PostgreSQL authoritative reads/writes
- live AI or Open Banking unexpectedly enabled
- secret exposure
- destructive deletion occurs
- public URL/link generation uses `0.0.0.0`
