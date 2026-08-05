# Application Persistence Architecture

Status: PHASE 2 CORE DECISIONING DOMAINS IMPLEMENTED

PostgreSQL is the target authoritative persistence layer for Vireon application state. PostgreSQL Pilot v1 is frozen and remains the safety platform for migration execution, runtime-role verification, backup and restore rehearsal.

## Source Of Truth

- Deterministic financial engines remain authoritative for calculations.
- PostgreSQL stores confirmed facts, versions, evidence, decisions, workflows, snapshots, scenarios, goals, preferences, jobs, exports and deletion requests.
- AI CFO output may reference facts, evidence and snapshots, but must not overwrite deterministic facts or become the source of truth for calculations.
- Local JSON and in-memory stores are compatibility paths only for explicit demo/test or excluded domains. They must not be used silently in private-beta or production runtime modes. Financial Vault facts, Digital Twin scenarios/runs, Decision Centre lifecycle state, Action Workflow state, AI CFO history, Daily Reviews and Goals are PostgreSQL-authoritative for active routes and UI surfaces.

## Runtime Database Boundary

Runtime application requests must use the restricted `vireon_app` role through the server-only database layer under `src/server/db/`.

Runtime database code must:

- require SSL
- reject administrative usernames
- validate Supabase Session Pooler routed usernames
- pass passwords through child-scoped `PGPASSWORD` or an equivalent secret-safe driver transport
- avoid password-bearing process arguments
- redact URLs, SQL password clauses and PostgreSQL client environments before logging
- classify database errors into safe application categories
- attach correlation IDs to operations

## Repository Boundary

Repositories live under `src/server/repositories/` and accept explicit authenticated user context. They scope reads and writes by server-derived `user_id`, set `app.current_user_id` for RLS, map rows to domain types and hide raw database internals.

Multi-table mutations must use transactions. Duplicate-prone writes must use idempotency keys where a repeated request could create inconsistent state.

## Current Implementation

Implemented in this milestone:

- `src/server/db/postgresRuntime.ts`: server-only runtime configuration validation, psql-backed client boundary, secret-safe redaction, SQL binding, error classification and query logging hooks.
- `src/server/repositories/postgresApplicationRepositories.ts`: application repository factory over existing pilot repositories, profile persistence, document persistence and fact versioning helpers.
- `src/server/services/applicationPersistenceAudit.ts`: API persistence matrix source for Phase 2 conversion planning.
- `src/server/services/financialVaultPostgresService.ts`: Financial Vault API service for profile initialization, document metadata, extraction state, import lifecycle, evidence links, confirmed facts, fact versions and idempotency.
- `src/server/services/financialPositionReadService.ts`: shared persisted financial read model for dashboard/status and non-Vault deterministic input consumers.
- `src/server/services/persistedAICfoInputService.ts`: AI CFO input adapter that grounds existing AI surfaces in persisted Vault facts without starting AI CFO persistence.
- `src/server/services/coreDecisioningPostgresService.ts`: server-only persistence service for Digital Twin, Decision Centre, Action Workflows, AI CFO history, Daily Review and Goals.

Active API conversion is complete for `/api/financial-vault`, `/api/financial-vault/imports`, `/api/digital-twin`, `/api/decisions`, `/api/action-workflows`, `/api/ai-cfo`, `/api/ai-cfo/daily-review` and `/api/goals`. Excluded product domains remain pending for their own state. See `docs/API_PERSISTENCE_MATRIX.md`.

## Financial Vault Slice

The active Vault APIs use PostgreSQL as their only authoritative runtime state:

- document uploads store metadata and extraction payloads in `documents` and `document_extractions`
- source evidence is stored in `evidence`
- extracted and confirmed financial facts are stored in `financial_facts`
- fact history is stored in append-only `fact_versions`
- CSV import review state is stored in `migration_runs.preview`
- duplicate-prone mutations reserve request fingerprints in `idempotency_keys`

The legacy `ManualFinancialDataPlatform` remains a deterministic parser/review transformer inside a single request, but its local repository is not imported by the active API route. Browser state is limited to transient form and display state.

## Core Decisioning Slice

The constrained Big Bang converted the six remaining core decisioning domains without changing deterministic formulas:

- Digital Twin uses persisted scenarios, simulation runs, timeline events and calculation snapshots.
- Decision Centre uses persisted decisions and append-only decision history.
- Action Workflows use persisted workflows, steps, evidence and outcomes.
- AI CFO uses persisted question/answer history with grounding metadata and no hidden reasoning.
- Daily Review uses persisted review history and settings, with failed generation isolated from the last successful review.
- Goals use persisted goal records, scenario variants and deterministic progress snapshots.

Active UI components consume routes or server services. Browser storage remains allowed only for transient UI preferences such as Developer Mode or panel state.

## Migration Policy

Schema changes must use the existing migration system and pass:

```powershell
npm run postgres:pilot:bootstrap
npm run postgres:pilot:rollback-check
```

No migration may touch Supabase-managed schemas, weaken RLS, broaden `vireon_app` privileges or bypass `schema_migrations`.
