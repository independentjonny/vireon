# Production Rollout

Production Data Integrity and Readiness v1 is an architecture and safety foundation. It does not make Vireon production-ready for real-user financial data by itself.

## Phase 1: Repository Interfaces

- Keep current local stores for behaviour compatibility.
- Introduce typed repository interfaces and in-memory contract tests.
- Document data ownership and persistence audit.
- Add production readiness diagnostics.
- Block production mode from unsafe local or demo fallbacks.

Rollback: disable repository-backed routes and continue local development stores.

## Model Provider Rollout

Model Orchestrator v1 is a local provider-neutral boundary. It does not by itself approve live commercial AI operation.

Provider rollout stages:

1. Local contracts: deterministic adapter, mock adapter, routing policy, validation, diagnostics and tests.
2. Single provider: enable one commercial provider with approved models, synthetic health checks, cost controls and no cross-provider fallback.
3. Independent review: add a second approved provider or configured reviewer model for high-risk critique where policy requires it.
4. Evaluation: run golden synthetic fixtures and promote models explicitly by configuration version.
5. Production operation: enable privacy-approved provider routing with monitoring, incident response and budget governance.

Rollback: set `VIREON_MODEL_ORCHESTRATOR_MODE=disabled` or disable individual providers. Deterministic Vireon features must continue to operate without LLM providers.

## Evaluation Rollout

Evaluation & Trust Framework v1 adds local synthetic benchmark evidence for model, prompt, routing-policy and worker changes. It is not proof of production AI quality by itself.

Evaluation rollout stages:

1. Local trust contracts: synthetic fixtures, deterministic scorers, mock runs, regression baselines, calibration and Developer Mode reporting.
2. Live-provider dry run: limited synthetic fixtures, explicit cost cap, no real-user data, no automatic promotion.
3. Human review: promotion-critical outputs reviewed with structured human review records.
4. Controlled preference changes: model or prompt candidates move through explicit configuration-version changes after gates pass.
5. Production monitoring: compare offline benchmark quality with live operating metrics such as evidence corrections, user edits, realised outcome variance and safety incidents.

Rollback: keep the current preferred model/prompt configuration unchanged. Failed or blocked evaluations must not alter provider routing policy.

Live-provider dry run uses `npm run models:evaluate:live:preflight` and `npm run models:evaluate:live -- --provider=openai --model=<configured-model> --fixture-limit=12 --budget-confirmed=true`. It must remain blocked unless a non-production environment, synthetic-only mode, explicit provider/model, cost budgets and fixture limit are configured. Passing this dry run does not make the selected model preferred or production-grade.

## Phase 2: PostgreSQL Repositories

- Apply `migrations/0001_production_data_integrity.sql` to a non-production PostgreSQL database.
- Implement repository methods against PostgreSQL executor.
- Run repository contract tests against in-memory and PostgreSQL adapters.
- Add migration preview, dry run and rollback tests.
- Import test users only.
- Use `docs/POSTGRES_PILOT_RUNBOOK.md` for the disposable pilot environment. The pilot scope is limited to Financial Vault facts/evidence, decisions/history, Action Workflows/outcome verification, Timeline events and calculation snapshots.

Rollback: drop non-production schema or restore from pre-migration backup.

## Phase 3: Authentication Enforcement

- Derive user identity from server session for all write APIs.
- Reject unauthenticated, expired and revoked sessions.
- Enable and test row-level security policies.
- Add direct-object-reference attack tests.
- Stop returning seeded financial data after auth failure.

Rollback: restrict affected APIs to internal testers and read-only mode.

## Phase 4: Backup, Recovery and Internal Pilot

- Verify PITR and logical backups.
- Run recovery drill with non-production financial data.
- Enable structured telemetry with sensitive-value redaction.
- Pilot document upload, Daily Review, AI CFO, Workflows and Timeline with internal users.
- Track failed writes, conflicts, migration failures and job retries.

Rollback: pause background jobs, disable write endpoints, restore last verified backup if needed.

## Phase 5: External Beta and Local Fallback Removal

- Remove unsafe production local JSON fallbacks.
- Enforce idempotency keys for all production writes.
- Require optimistic concurrency on mutable records.
- Keep demo mode visibly labelled and repository-isolated.
- Add account export and deletion operational monitoring.

Rollback: move external users to read-only mode, retain backups, and replay validated events after repair.

## Exit Criteria

- Every user-owned row is scoped by authenticated user and RLS.
- Every write path has idempotency, validation, audit and conflict handling.
- Every verified outcome has evidence and before/after snapshots.
- Production cannot start with unsafe persistence fallback.
- Backup restore and migration rollback drills pass outside production.
- Security regression tests pass for cross-user access, forged IDs, unsafe client fields and demo/live separation.
