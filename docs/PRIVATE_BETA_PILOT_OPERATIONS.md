# Vireon Private Beta Pilot Operations v1

## Scope

This is an operational milestone for a controlled 10-20 user private beta. It does not add financial engines, activate Open Banking, enable live AI, change deterministic formulas, or change AI evaluation assets.

## Deployment Verification

Private beta readiness must be verified in `PRIVATE_BETA`, not inferred from `LOCAL_DEVELOPMENT`.

Deployment verification records:

- application version
- commit SHA
- execution mode
- database status
- migration status
- storage status
- authentication status
- feature flags
- beta gate result
- smoke-test result
- deployment timestamp

`PRIVATE_BETA` must report PostgreSQL persistence, disabled local fallback, configured server authentication, applied migrations, private storage, Open Banking disabled and live AI disabled.

## Founding Cohort

The first cohort is `FOUNDING_BETA_01`.

- maximum users: 10
- invite only
- manual approval
- priority support
- deterministic features only

Enabled:

- onboarding
- manual financial records
- CSV import
- Financial Health
- forecasting
- scenarios
- goals
- deterministic briefing
- provenance
- export
- deletion request
- feedback

Disabled:

- Open Banking
- live AI
- experimental PDF extraction unless separately proven safe
- untested administrative features

Cohort flags cannot override forced platform restrictions.

## Invitation Workflow

Invitation states:

- `CREATED`
- `SENT`
- `OPENED`
- `ACCEPTED`
- `EXPIRED`
- `REVOKED`

Controls:

- unique invitation token hash
- intended email hash
- expiration
- cohort assignment
- activation status
- resend/revoke control
- audit event
- reuse prevention
- email mismatch rejection where enforced

Internal user IDs are not exposed.

## Synthetic Rehearsal

Before user invites, rehearse the full journey with synthetic identities:

1. invitation
2. registration
3. sign-in
4. onboarding
5. manual income entry
6. asset entry
7. debt entry
8. CSV import
9. candidate acceptance
10. import confirmation
11. Financial Health
12. forecast
13. scenario
14. goal
15. deterministic briefing
16. provenance
17. feedback
18. export
19. deletion request
20. sign-out and return session

Required rehearsal coverage:

- one desktop run
- one mobile run
- two isolated users
- failed-import recovery
- expired-session recovery

Synthetic rehearsal must store synthetic data only.

## Support Workspace Boundary

Support records may show:

- support reference ID
- pseudonymous user reference
- cohort
- application version
- feature
- error category
- timestamp
- status
- safe diagnostics
- linked feedback
- resolution notes

Support records must not show balances, transaction text, income, debts, account numbers, uploaded documents or goal amounts.

## Daily Check

Run:

```bash
npm run beta:daily-check
```

The command exits non-zero when critical controls fail, including:

- cross-user isolation alert
- database persistence unavailable
- local fallback active in beta
- Open Banking enabled
- live AI enabled
- required migration missing
- critical security finding open
- deletion processing materially broken

## Incident Response

`SEV-1` examples:

- cross-user data exposure
- unauthorised document access
- accidental external AI transmission
- Open Banking unexpectedly active
- destructive deletion defect
- widespread authentication compromise

`SEV-1` suspends new beta access immediately.

`SEV-2` examples:

- database outage
- major import failure
- exports unavailable
- onboarding unavailable
- calculations unavailable

`SEV-3` examples:

- isolated workflow defect
- display error
- non-blocking accessibility issue
- minor performance degradation

Each incident must record detection, containment, owner, communication, evidence preservation, rollback decision, recovery verification and post-incident review.

## Release Control

Release sequence:

1. merge approved changes
2. run full validation
3. run beta gate
4. generate release manifest
5. apply migrations
6. deploy
7. run smoke tests
8. verify feature flags
9. verify Open Banking disabled
10. verify live AI disabled
11. activate release
12. monitor initial period
13. record outcome

Initial cohort change freeze:

- freeze deterministic formula changes
- freeze major navigation changes
- freeze schema redesigns
- freeze feature expansion
- allow critical fixes
- allow usability fixes supported by beta evidence
- require explicit approval for golden-output changes

## User Validation

Facilitator guide:

1. explain that Vireon is a private beta
2. confirm consent
3. ask user to complete onboarding
4. observe without leading
5. ask user to interpret Financial Health
6. ask user to explain one forecast
7. ask user to create one goal
8. ask user to compare one scenario
9. ask user to inspect provenance
10. ask user what they would do next
11. ask user to submit feedback
12. verify export visibility

Research notes must not record financial values.

## Beta Survey

Questions:

- How easy was setup?
- Did you understand your Financial Health results?
- Did the forecast feel useful?
- Did goal planning help you compare options?
- Did you trust the calculations?
- Could you understand where results came from?
- What was the most valuable feature?
- What was confusing?
- What would make you return weekly?
- Would you recommend Vireon to someone you trust?

Do not request sensitive financial information.

## Weekly Review

Review:

- funnel metrics
- time to first value
- task completion
- blocking errors
- misunderstood calculations
- provenance usage
- feature usage
- support issues
- performance
- accessibility
- privacy concerns
- requested features

Priorities:

- `P0`: security, privacy, cross-user access, destructive data loss
- `P1`: blocking journey defects
- `P2`: major confusion or trust issues
- `P3`: minor usability problems
- `P4`: future enhancements

## First-Cohort Decision

After 10 users, produce a decision report with:

- invitations sent
- activations
- onboarding completion
- median time to first value
- import completion
- Financial Health comprehension
- forecast comprehension
- goal completion
- provenance usage
- repeat usage
- support incidents
- blocking defects
- top user requests
- trust concerns
- privacy concerns
- performance findings

Allowed outcomes:

- `CONTINUE`
- `CONTINUE_WITH_REMEDIATION`
- `PAUSE`
- `STOP`

## Expansion Gate

Expansion requires:

- no unresolved `SEV-1`
- no cross-user access issue
- no accidental AI transmission
- Open Banking disabled
- 80% onboarding completion
- median time to first value under 15 minutes
- fewer than 10% blocking defects
- exports scoped correctly
- deletion requests recorded correctly
- users can generally interpret core results
- beta gate passes

Stages:

- Stage 1: 10 users
- Stage 2: 25 users
- Stage 3: 50 users

Each stage requires a recorded decision.
