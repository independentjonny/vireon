# Private Beta Acceptance Test Plan

Status: `READY_FOR_OPERATOR_GO_NO_GO_REVIEW`

Use synthetic users and synthetic financial data only. Each test records PASS/FAIL and evidence path or screenshot/log reference. Do not activate private beta from this plan.

## Test Matrix

| Journey | Preconditions | Steps | Expected Result | PASS/FAIL | Evidence |
| --- | --- | --- | --- | --- | --- |
| Owner login | Owner account exists with trusted owner metadata. | Open `/login`, sign in, reload. | Secure session persists; owner reaches allowed pages. |  |  |
| Public access request | App deployed, request-access enabled. | Submit generic request with synthetic email. | Neutral success; no account or invite created automatically. |  |  |
| Admin review | Owner signed in. | Open `/admin/private-beta/access`, inspect request. | Request appears; details are bounded and non-sensitive. |  |  |
| Invitation approval | Synthetic request exists. | Approve request. | One expiring email-bound invitation is created; raw link shown once. |  |  |
| Invitation redemption | Invitation link available. | Open link, enter matching email/password, submit. | Signup succeeds or shows confirmation-pending success. |  |  |
| Email confirmation required | Supabase email confirmation enabled. | Redeem invite, inspect UI. | Message says to confirm email, not generic failure. |  |  |
| Onboarding | Invited user signed in. | Complete beta onboarding sections. | Redirects to product only after onboarding completion. |  |  |
| Session persistence | User signed in. | Reload browser and open protected route. | Session remains valid; no duplicate onboarding. |  |  |
| Logout | User signed in. | Sign out, revisit protected route. | Session cleared; protected route blocks access. |  |  |
| Financial Vault empty | Onboarded user has no facts. | Open Financial Vault. | Helpful empty state; no misleading zero values. |  |  |
| Financial Vault populated | Synthetic facts exist. | Add or load facts and evidence. | Facts and provenance display; restart reloads same records. |  |  |
| Goals | Synthetic Vault data available. | Create/update goal. | Goal persists, calculations explain assumptions. |  |  |
| Forecast | Synthetic Vault data available. | Generate forecast. | Deterministic output appears with assumptions and warnings. |  |  |
| Decision Centre | Synthetic calculation snapshot exists. | Create/list/transition decision. | Decision and history persist; no duplicate active decision. |  |  |
| Digital Twin | Synthetic Vault data available. | Create scenario and run simulation. | Scenario/run persist; assumptions distinct from facts. |  |  |
| Action Workflows | Decision exists. | Start workflow, complete one step. | Step state persists; outcome is not verified without evidence. |  |  |
| Daily Review | Synthetic daily review inputs exist. | Generate/open Daily Review. | Durable briefing shown; failure is not empty success. |  |  |
| AI CFO disabled state | Live AI disabled. | Open AI CFO. | UI explains gated/disabled state; no live provider call. |  |  |
| Open Banking disabled state | Open Banking disabled. | Open bank/import related surfaces. | Disabled state is explicit; no live connection attempted. |  |  |
| Mobile smoke | Mobile viewport. | Complete login, onboarding, dashboard, Vault navigation. | No horizontal scroll; touch targets usable. |  |  |
| Tablet smoke | Tablet viewport. | Repeat critical navigation. | Layout remains usable and readable. |  |  |
| Error recovery | Simulate unavailable API. | Trigger retry-capable flow. | Actionable message and retry; no stack trace. |  |  |
| RBAC denial | Non-admin signed in. | Visit `/admin/private-beta/access`. | 403 or safe redirect; no admin data. |  |  |
| Cross-user isolation | User A and User B exist. | User B attempts User A record access by ID/API. | Access denied; no existence disclosure. |  |  |
| Export lifecycle | User signed in. | Request export. | Durable request created; no secrets/raw docs in output. |  |  |
| Deletion rehearsal | User signed in. | Request deletion rehearsal only. | Lifecycle state recorded; no real destructive deletion. |  |  |
| Restart durability | Synthetic data exists. | Restart app/service boundary and reload. | Records reload from PostgreSQL; no local fallback required. |  |  |
| PostgreSQL outage | Controlled outage simulation. | Open data-backed pages. | Explicit unavailable state; no stale/demo fallback. |  |  |

## Acceptance Rules

- Any authentication, RBAC, cross-user isolation, secret exposure, migration or data-loss failure is a no-go.
- Any live AI or Open Banking activation is a no-go.
- Any migration or rollback-check failure is a no-go.
- Non-blocking UX defects may enter the beta backlog only if they do not mislead users or hide financial uncertainty.
