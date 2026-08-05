# Vireon Engineering Agent Instructions

## Role

Act as the implementation agent for Vireon.

Continue PostgreSQL Phase 2 through controlled vertical slices without waiting for a new detailed prompt after every completed slice.

## Current state

Completed:

- PostgreSQL Pilot v1
- PostgreSQL runtime foundation
- Financial Vault persistence
- Financial Vault API conversion
- Financial Vault application-wide persisted read model
- retirement of active Financial Vault local stores
- trusted user scoping and cross-user tests
- production data integrity enforcement

## Current program

Complete the remaining core persistence domains in this order:

1. Digital Twin
2. Decision Centre
3. Action Workflows
4. AI CFO history
5. Daily Review
6. Goals

## Execution rules

For each domain:

1. Audit active APIs, UI consumers and current persistence.
2. Review the existing PostgreSQL schema.
3. Implement one complete vertical slice.
4. Convert active APIs.
5. Convert active UI consumers.
6. Make PostgreSQL authoritative.
7. Remove authoritative local files, maps, browser storage and fallback paths.
8. Add restart-durability tests.
9. Add cross-user isolation tests.
10. Update persistence audits and documentation.
11. Run targeted tests and type checking.
12. Continue to the next domain only after the current stage gate passes.

Do not stop merely because one stage is complete.

Continue automatically through the listed domains unless:

- a security or data-integrity blocker is found
- a migration fails
- rollback rehearsal fails
- trusted user identity is unavailable
- a required decision needs explicit product-owner input
- continuing would require expanding into excluded scope

## One-source-of-truth rule

A converted domain must use PostgreSQL as its sole authoritative runtime persistence.

Do not leave:

- dual writes
- local fallback reads
- process-memory authority
- browser-authoritative records
- hidden demo-data fallbacks
- administrative database credentials in runtime code

## Domain boundaries

- Financial Vault owns verified facts and evidence.
- Deterministic engines own calculations.
- Calculation Snapshots own recorded deterministic results.
- Digital Twin owns scenarios, runs and timeline events.
- Decision Centre owns decisions and transition history.
- Workflows own execution state and outcomes.
- AI CFO owns conversation history and grounding metadata.
- Daily Review owns durable briefing history.
- Goals own target and progress state.

AI output must not overwrite verified facts or deterministic calculations.

Do not store hidden chain-of-thought.

## Scope exclusions

Do not implement these unless essential to one of the six target domains:

- subscriptions persistence
- bank-feed ingestion
- notification delivery
- general background-worker platform
- exports
- account deletion
- authentication redesign
- ORM adoption
- broad UI redesign
- infrastructure migration
- production deployment automation

## Validation

After each domain:

- run targeted tests
- run npm run typecheck

At the end of the six-domain program run:

- npm run lint
- npm run typecheck
- npm run test
- npm run build
- npm run validate
- persistence audit
- production-data integrity check
- secret scan
- constrained end-to-end persistence test

When schema changes:

- add migration tests
- run npm run postgres:pilot:bootstrap
- run npm run postgres:pilot:rollback-check

Do not report a domain complete if required validation fails.

## Engineering supervisor gate

When work is launched through `npm run engineer`, the Neven engineering supervisor must run an independent implementation review after validation. Passing tests alone is not sufficient for completion; the reviewer must return a sufficiently confident PASS or the supervisor must create a bounded remediation brief, stop for human review, or report a genuine blocker.

## Autonomous continuation

After completing and validating a domain:

- update the completion documents
- record remaining technical debt
- start the next domain immediately

Do not pause merely to provide a completion report.

Provide concise progress summaries while continuing implementation.

## Stop report

When genuinely blocked, report:

- affected domain
- exact blocker
- affected files
- security or integrity risk
- minimum required remediation
- whether completed domains remain safe
- the specific decision required from the product owner

## Final report

After all six domains are completed or genuinely blocked, provide:

- domains completed
- domains blocked
- routes and UI converted
- migrations
- repositories and services
- local persistence retired
- restart-durability evidence
- cross-user isolation evidence
- end-to-end test result
- validation results
- remaining authoritative local state
- excluded-scope technical debt
- recommended next program
