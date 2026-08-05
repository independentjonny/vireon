# API Persistence Matrix

This matrix records the active product API persistence source after the Vireon product-mode PostgreSQL completion work. It is evidence, not policy: live code remains authoritative.

| Route family | Persistence status | User-owned data | Authoritative tables/services | Notes |
|---|---|---:|---|---|
| `/api/financial-vault`, `/api/financial-vault/imports` | PostgreSQL-backed | Yes | `financial_profiles`, `financial_facts`, `fact_versions`, `documents`, `document_extractions`, `evidence`, `idempotency_keys` via `financialVaultPostgresService` | No active `.ai/local-data/financial-vault.json` or manual-platform fallback |
| `/api/digital-twin` | PostgreSQL-backed | Yes | `digital_twin_scenarios`, `simulation_runs`, `timeline_events`, `calculation_snapshots` via `coreDecisioningPostgresService` | Legacy Digital Twin JSON store is test/demo only |
| `/api/decisions` | PostgreSQL-backed | Yes | `decisions`, `decision_history` via `coreDecisioningPostgresService` | State transitions remain append-only |
| `/api/action-workflows`, `/api/workflow-status` | PostgreSQL-backed | Yes | `workflows`, `workflow_steps`, `workflow_evidence`, `workflow_outcomes`, `decisions`, `decision_history` | Active workflow state is durable and user scoped |
| `/api/ai-cfo`, `/api/copilot-history` | PostgreSQL-backed | Yes | `ai_cfo_questions`, `ai_cfo_answers`, `calculation_snapshots` | Legacy Copilot history no longer reads/writes local JSON |
| `/api/ai-cfo/daily-review` | PostgreSQL-backed | Yes | `daily_reviews`, `calculation_snapshots`, `user_preferences` | Demo persistence is rejected unless explicitly enabled outside production |
| `/api/goals` | PostgreSQL-backed | Yes | `goals`, `timeline_events`, `calculation_snapshots` | Active goal state and progress snapshots are durable |
| `/api/transactions`, `/api/ingest` | PostgreSQL-backed | Yes | `user_transaction_imports`, `user_transactions`, `idempotency_keys` via `transactionsSubscriptionsPostgresService` | Local transaction/import JSON fallback is retired for active routes |
| `/api/subscriptions`, `/api/subscriptions/intelligence`, `/api/merchant-intelligence` | PostgreSQL-backed | Yes | `user_subscriptions`, `user_transactions` | Subscription state and intelligence derive from persisted rows |
| `/api/housing-scenarios` | PostgreSQL-backed | Yes | `timeline_events`, `calculation_snapshots` via `coreDecisioningPostgresService` | Active Housing scenarios no longer use `.ai/local-data/housing-affordability.json` |
| `/api/financial-forecast` | PostgreSQL-backed | Yes | `calculation_snapshots`, `simulation_runs`, `digital_twin_scenarios` via `coreDecisioningPostgresService` | Forecasts are deterministic snapshots; `.vireon/financial-forecasting` is test isolation only |
| `/api/private-beta/export`, `/api/private-beta/deletion` | PostgreSQL-backed lifecycle | Yes | `data_exports`, `account_deletion_requests`, `background_jobs`, `audit_events` via `privateBetaLifecyclePostgresService` | Requests are durable, user-scoped and non-destructive; live deletion remains human-approval gated |
| `/api/backup/import` | Authenticated operational backup import | Yes | Authenticated scoped backup validation and persistence services | Versioned schema validation and ownership scoping required |
| `/api/backup/export` | Disabled operational backup export | No live product authority | PostgreSQL operator backup/rollback runbook | Returns `410 OPERATIONAL_BACKUP_EXPORT_DISABLED`; no local JSON export fallback |
| `/api/memory` | Disabled legacy route | No | None | Returns `410 MEMORY_ROUTE_DISABLED`; persisted AI CFO history is the supported memory surface |
| `/api/reset-local-data`, `/api/test-runner`, `/api/runtime/*`, `/api/autonomous-*`, `/api/build-*`, `/api/execution-queue` | Protected operational tooling | No canonical product financial authority by default | RBAC-protected operational state | Disabled or admin-gated in production; not product persistence authority |
| `/api/telemetry`, `/api/logs/ingest`, `/api/local-data/status` | Operational/local files | No canonical product financial authority | Observability/audit boundary | Retained as operational diagnostics only |

## Remaining Non-Product Or Excluded Persistence

- Notifications remain excluded or separately controlled unless explicitly approved for product persistence completion. Private-beta export and account-deletion request lifecycles are PostgreSQL-backed, but real destructive deletion and activation remain approval-gated.
- Engineering bridge, `.ai-supervisor`, `.codex-bridge`, `.ai/operations` and `.ai/builds` are frozen operational tooling, not product financial authority.
- Browser storage may remain only for transient UI state such as tabs, filters, expanded panels and unsaved drafts.
