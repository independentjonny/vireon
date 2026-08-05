# Background Jobs

Status: PLANNED FOR PHASE 2

Target table:

- `background_jobs`

Initial durable job types:

- document extraction
- fact reconciliation
- deterministic recalculation
- Digital Twin simulation
- Daily Review generation
- AI CFO context preparation
- export generation
- deletion processing

Jobs must be user-scoped, idempotent where appropriate, bounded by retry limits and safe to resume after process restart. Job payloads must not contain secrets.
