# Vireon Beta Hardening & User Validation v1

## Scope

This milestone hardens the existing deterministic private-beta product. It does not add a new financial engine, activate Open Banking, enable live AI, or change frozen model-evaluation assets.

## Beta Readiness Audit

| Severity | Area | Finding | Status | Remediation |
|---|---|---|---|---|
| HIGH | Authentication | Private beta must not rely on local development sessions. | Controlled | `PRIVATE_BETA` mode blocks unless database and server auth configuration are present. |
| HIGH | Analytics | Product analytics could accidentally collect financial content. | Remediated | Server allowlist rejects balances, merchants, income, debt, addresses, document text and raw financial data. |
| HIGH | Persistence | Local JSON fallback is safe for local development but not beta. | Remediated | Launch gate blocks local JSON fallback in `PRIVATE_BETA`. |
| MEDIUM | Explainability | Important results need a shared explanation model. | Remediated | Explainable results now include source records, calculation steps, assumptions, freshness, warnings and actions. |
| MEDIUM | Calculation drift | Shared values can diverge across Health, Forecasting and Goals. | Remediated | Cross-engine consistency checks compare net worth, income, expenses and forecast hash. |
| MEDIUM | Performance | Beta workflows need a repeatable baseline. | Remediated | Synthetic small, normal and heavy benchmark records are available. |
| MEDIUM | Security | Internal security review must be structured and testable. | Remediated | Security findings track severity, surface, precondition, impact, remediation, verification and status. |

No known critical beta blocker is recorded by the hardening gate when deterministic golden checks, consistency checks and private-beta foundation controls pass.

## Launch Gate

Run:

```bash
npm run beta:gate
```

The command exits non-zero when launch is blocked. Critical blockers include:

- unauthenticated private-beta mode
- cross-user isolation risk
- database persistence missing in `PRIVATE_BETA`
- local JSON fallback in `PRIVATE_BETA`
- missing migration version
- failed deterministic golden calculations
- failed cross-engine consistency checks
- live AI enabled
- Open Banking enabled
- blocked critical security finding

## Privacy-Safe Analytics

Allowed analytics fields:

- event name
- timestamp
- anonymous or pseudonymous user reference
- session reference
- application version
- page
- feature
- execution mode
- success/failure
- duration bucket
- error category
- beta cohort

Rejected analytics content:

- account balances
- transaction descriptions
- merchant names
- income
- debts
- addresses
- uploaded document text
- financial goal amounts
- financial recommendations
- raw financial data

Endpoint:

```text
POST /api/private-beta/analytics
```

## Funnel Metrics

Tracked metrics:

- onboarding start rate
- onboarding completion rate
- completion by step
- abandonment step
- import completion rate
- time to first confirmed record
- time to first Financial Health result
- time to first forecast
- time to first goal
- time to first deterministic briefing
- repeat-session rate
- feedback rate

First value means a user has confirmed enough information to receive at least one deterministic Financial Health result or Decision Centre action.

## Golden Calculation Suite

Synthetic golden fixtures cover:

- Financial Health monthly surplus, savings rate, emergency fund coverage and net worth
- Forecast final cash balance and debt reduction
- Goal required contribution and feasibility

Golden outputs are versioned as `beta-golden-expected-v1`. Changes require explicit approval and must not be hidden in aggregate test results.

## Explainability Standard

Important results use a shared explanation shape:

- result name
- displayed value
- classification
- source records
- calculation steps
- assumptions
- calculation version
- source freshness
- confirmation status
- warnings
- related actions
- generated timestamp

Applied to net worth, cash flow, savings rate, emergency fund, debt ratio, forecasts, goal feasibility and Decision Centre linked actions.

## Claims Policy

Avoid certainty-overstating terms on regulated or assumption-driven surfaces:

- guaranteed
- approved
- certain
- accurate
- optimal
- best
- will achieve
- live balance

Preferred wording:

- projected
- indicative
- based on confirmed records
- based on current assumptions
- estimated
- may
- appears
- requires review
- last updated

## Security Review

The review covers authentication, authorisation, household ownership, session handling, CSRF, XSS, SQL injection, command injection, path traversal, uploads, SSRF, secrets, logs, feature flags, admin controls, exports, deletion, rate limits and denial-of-service exposure.

This is an internal structured review. It is not an external penetration test.

## User Validation Script

For 10-20 trusted users, ask users to:

1. complete onboarding
2. add income
3. add property or housing information
4. add debt
5. import or enter transactions
6. confirm records
7. explain their Financial Health result
8. interpret a forecast
9. create a goal
10. compare a scenario
11. inspect provenance
12. submit feedback
13. export their data

Research notes must not record financial values.

## Beta Success Targets

- 80% complete onboarding without assistance
- median time to first value under 15 minutes
- 70% can explain one Financial Health result correctly
- 70% can create and interpret a goal
- fewer than 10% encounter a blocking defect
- zero cross-user data incidents
- zero accidental external AI transmissions
- zero Open Banking activations
- 100% of exports scoped correctly
- 100% of deletion requests recorded correctly

## Release and Rollback

Release sequence:

1. apply migrations
2. verify `npm run private-beta:readiness`
3. verify `npm run beta:gate`
4. verify feature flags keep live AI and Open Banking disabled
5. run smoke tests for onboarding, import, briefing, provenance, export and deletion
6. invite only the approved beta cohort

Rollback sequence:

1. disable cohort activation
2. disable non-critical feature flags
3. preserve audit and support references
4. rollback deploy artifact
5. apply database rollback only when data-loss risk is understood
6. notify affected beta users when required

A failed critical smoke test stops rollout.
