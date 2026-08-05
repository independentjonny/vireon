# Vireon Architecture Freeze

Status: `ACTIVE`

Date: 2026-08-05

Scope: `RELEASE_CANDIDATE_1`

## Freeze Rule

No new product features are allowed in `RELEASE_CANDIDATE_1`.

Allowed changes:

- Critical bugs
- Security fixes
- Performance fixes
- Accessibility fixes
- Usability fixes
- Regression fixes
- Deployment or migration compatibility fixes required for private-beta activation

Not allowed:

- New financial engines
- New product domains
- New persistence architectures
- ORM adoption
- Authentication redesign
- PostgreSQL Pilot redesign
- Live AI activation
- Open Banking activation
- Investment, tax, retirement or insurance feature expansion
- Broad UI redesign
- Public launch work

## Authority Boundaries

- Financial Vault owns verified facts, documents, extraction metadata, evidence and provenance.
- Deterministic engines own calculations.
- Calculation snapshots own recorded deterministic outputs.
- PostgreSQL is authoritative for completed product domains.
- AI may explain, summarize and propose, but must not overwrite verified facts or deterministic outputs.
- Browser and filesystem state are not authoritative for completed domains.

## Change Triage

Every proposed change must be classified before implementation:

| Classification | Action |
| --- | --- |
| Critical bug | Fix immediately with focused validation. |
| Security | Fix immediately with focused negative tests. |
| Performance | Fix if measurable private-beta risk exists. |
| Accessibility | Fix if it blocks or materially harms user completion. |
| Usability | Fix if it blocks first-value private-beta journeys. |
| Regression | Fix if introduced by the release candidate. |
| New feature | Move to Vireon v2 backlog. |

## Stop Conditions

Stop and request human approval before:

- destructive migration
- data rewrite
- deployment
- private-beta activation
- real-user invitation
- live AI activation
- Open Banking activation
- real deletion
- compliance claim

## Release Discipline

The goal is learning from real users, not endless polishing.

The release candidate should advance only through:

1. migration approval
2. migration application
3. deployment
4. internal synthetic testing
5. family beta
6. trusted-friends beta
7. controlled private beta
