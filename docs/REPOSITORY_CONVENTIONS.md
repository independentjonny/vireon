# Repository Conventions

Status: ACTIVE FOR POSTGRESQL PHASE 2

Every PostgreSQL-backed repository must follow these conventions.

## Required Inputs

Repositories accept a trusted server-side context containing:

- authenticated user ID
- actor
- request ID
- correlation ID
- source
- data mode

Repositories must not trust `user_id` from request bodies.

## Ownership

All user-owned queries must include `user_id` filtering and set `app.current_user_id` before operations that rely on RLS. Record IDs alone are never sufficient.

## Results

Repositories return domain records, not raw database rows. Not-found, conflict, validation and retryable database failures must use predictable result types or safe exceptions.

## Mutations

Mutations must:

- validate input before writing
- use transactions for multi-table consistency
- increment versions for mutable current records
- preserve history append-only where required
- write audit events for material financial or security events
- use idempotency for duplicate-prone writes

## Logging

Logs must be redacted before storage or output. Do not log passwords, full credential-bearing URLs, raw document content, complete request bodies containing financial values or unrestricted SQL with embedded secrets.
## Shared Financial Read Model

Non-Vault application surfaces that need financial facts must use `src/server/services/financialPositionReadService.ts` or a service built on top of it. They must not import retired local repositories such as `financialVaultStore` or `manualFinancialDataRepository`.

The read model is user-scoped, PostgreSQL-backed, and returns domain objects for confirmed facts, profile summary, provenance, confidence, staleness, document/import status and deterministic-engine input mapping. Missing data must remain distinguishable from database unavailability.

## Core Decisioning Persistence

Digital Twin, Decision Centre, Action Workflows, AI CFO history, Daily Review history and Goals use `src/server/services/coreDecisioningPostgresService.ts` as the active persistence service.

Converted active code must not import:

- `financialDigitalTwinStore`
- `actionWorkflowStore`
- `aiCfoStore`
- `aiCfoDailyReviewStore`
- `GoalPlanningEngine.readState`
- `GoalPlanningEngine.saveGoal`
- `.vireon/goal-planning/goal-state.json`

Legacy store modules may remain only for isolated tests or explicit demo fixtures. Production integrity checks must flag active imports or browser-storage authority for these domains.
