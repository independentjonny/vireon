# PostgreSQL Phase 2 Completion

Status: CORE PRODUCT PERSISTENCE COMPLETE FOR PRIVATE-BETA REVIEW

PostgreSQL Phase 2 now covers the active private-beta product persistence scope: Financial Vault, shared financial read model, Digital Twin, Decision Centre, Action Workflows, AI CFO history, Daily Review, Goals, Transactions/Subscriptions and active Housing scenarios. Excluded domains remain listed below and must not be described as complete.

Slice 2 update:

- `/api/financial-vault` is PostgreSQL-backed for profile initialization, document metadata, extraction state, evidence links, extracted facts and fact history.
- `/api/financial-vault/imports` is PostgreSQL-backed for import lifecycle state, reviewed candidates, confirmed canonical records, evidence links and fact versions.
- Financial Vault UI consumers load through these APIs and no longer receive server-rendered local JSON state.
- No schema migration was added for Slice 2; existing tables were sufficient.

Slice 3 update:

- Added `src/server/services/financialPositionReadService.ts` as the application-wide PostgreSQL-backed financial read model.
- Dashboard, status, housing, forecast, goals, private-beta briefing/export, AI CFO input and Daily Review generation paths now source Financial Vault facts from PostgreSQL.
- Retired active runtime imports of `financialVaultStore` and `manualFinancialDataRepository`; the files were removed.
- No schema migration was added for Slice 3; existing tables were sufficient.

Completion requires:

- active product API routes converted to PostgreSQL services
- UI state reloaded from PostgreSQL-backed APIs
- local JSON authoritative stores removed or isolated to explicit demo/test modes
- restart durability proven end to end
- cross-user access tests against all converted repositories
- PostgreSQL bootstrap and rollback rehearsal after any schema changes

This document must not be used to claim public production readiness. It records private-beta persistence readiness for the converted domains only.

Constrained core-domain program update:

- Added `migrations/0004_core_decisioning_persistence.sql` to extend existing public-schema tables with stable application IDs, JSON payload metadata, archive fields and user-scoped indexes needed by active Digital Twin, Decision Centre, Action Workflow, AI CFO, Daily Review and Goals routes.
- Added `migrations/0005_daily_review_append_only_history.sql` to remove the legacy `daily_reviews(user_id, review_date)` uniqueness constraint so Daily Review can retain multiple same-day briefing history rows by `app_id`.
- Added `src/server/services/coreDecisioningPostgresService.ts` as the shared server-only persistence service for the six core decisioning domains, implemented in the required order: Digital Twin, Decision Centre, Action Workflows, AI CFO history, Daily Review and Goals.
- Converted active routes: `/api/digital-twin`, `/api/decisions`, `/api/action-workflows`, `/api/ai-cfo`, `/api/ai-cfo/daily-review`, and `/api/goals`.
- Converted active UI surfaces: Digital Twin, Insights/Decision Centre, Action Workflows, AI CFO, Daily Review, Goals, dashboard decision/workflow/review cards.
- Retired active imports of `financialDigitalTwinStore`, `actionWorkflowStore`, `aiCfoStore` and `aiCfoDailyReviewStore`; remaining files are legacy test/demo fixtures and are blocked from active production imports by `findForbiddenFinancialPersistenceDependencies`.
- Goals no longer use `GoalPlanningEngine.readState`, `saveGoal`, `archiveGoal`, `saveScenario` or `.vireon/goal-planning/goal-state.json` in active routes/pages.

Core decisioning domains complete:

- Digital Twin scenarios and simulation runs persist in PostgreSQL and append calculation snapshots.
- Decision lifecycle state persists in PostgreSQL and writes append-only `decision_history` transitions.
- Workflows persist lifecycle, steps, evidence and outcomes in PostgreSQL.
- Workflow evidence is reconciled once per workflow save and linked to workflow outcomes by persisted evidence IDs.
- AI CFO persists questions, final answers, safe grounding metadata and a linked calculation snapshot without hidden reasoning.
- Legacy `/api/copilot-history` no longer reads or writes `.ai/local-data/copilot-history.json`; it stores non-authoritative history rows in `ai_cfo_questions` and `ai_cfo_answers`.
- Daily Review persists review history/settings with a linked calculation snapshot and does not rely on local page-load regeneration as the source of truth.
- Daily Review runtime generation uses server time and app-id keyed persistence, so same-day generations do not overwrite prior review history.
- Goals persist goal state and deterministic progress snapshots in PostgreSQL.

Application-wide transactions/subscriptions update:

- Added `migrations/0006_transactions_subscriptions_persistence.sql` for `user_transaction_imports`, `user_transactions` and `user_subscriptions` with RLS, indexes and runtime-role grant reconciliation.
- Added `src/server/services/transactionsSubscriptionsPostgresService.ts` as the server-only persistence service for imported transaction rows, import history, derived subscriptions, subscription intelligence and idempotent duplicate suppression.
- Converted active routes `/api/transactions`, `/api/ingest`, `/api/subscriptions`, `/api/subscriptions/intelligence`, `/api/dashboard-metrics`, `/api/finance-health`, `/api/merchant-intelligence`, `/api/workflow-status` and the transaction-aware portions of `/api/copilot` to read/write persisted PostgreSQL state.
- Retired active transaction/import/subscription reads and writes from `.ai/local-data/transactions.json`, `.ai/local-data/imports.json` and `.ai/local-data/subscriptions.json`; remaining local-store references are backup/test/demo/operational surfaces and are no longer the active transaction/subscription authority.
- Transaction and subscription workspace pages no longer display hardcoded financial metric cards; their active sections load persisted API data and show explicit unavailable states on PostgreSQL failure.

Product-mode pilot validation update, 2026-08-02:

- Added migrations `0004`, `0005` and `0006` to the PostgreSQL pilot manifest so the pilot execution and rollback gates validate the full repository schema.
- Adjusted execution preflight to treat a partial runtime-object count as safe only when ordered pending migrations explain the partial state and `schema_migrations` has no conflicts.
- Adjusted rollback rehearsal cleanup for the explicitly disposable restore project to reset only the restore target `public` schema before replaying the public-schema backup, avoiding `pg_restore --clean` policy-drop races on newly added tables while preserving managed-schema exclusion.
- `npm run postgres:pilot:bootstrap` passed after migration execution.
- `npm run postgres:pilot:rollback-check` passed after migration execution.
- `/ai-cfo` now hydrates persisted AI CFO conversation history from PostgreSQL on page load; the deterministic first answer remains an unsaved draft only when no history exists.
- `/api/ai-cfo/daily-review` rejects demo-mode persistence unless `VIREON_ALLOW_DAILY_REVIEW_DEMO_MODE=true` is set outside production.

Final Housing remediation update:

- Active `/api/housing-scenarios`, `/housing-scenarios`, dashboard, insights, status and AI CFO context paths now use PostgreSQL-backed Housing state through `coreDecisioningPostgresService`.
- Housing scenarios and generated purchase-readiness reports persist as append-only `timeline_events` linked to `calculation_snapshots`; no new migration was required.
- `src/lib/housingAffordabilityStore.ts` remains only as a legacy test/demo local-file wrapper around the same deterministic Housing state builder.
- `__tests__/lib/coreDecisioningPostgresService.test.ts` covers Housing restart-style reload, user scoping and active route/page retirement of the local Housing store.

Attempt 2 remediation evidence:

- `__tests__/lib/coreDecisioningPostgresService.test.ts` covers Decision Centre trusted-user scoping, workflow outcome/evidence persistence without duplicate evidence reconciliation, AI CFO snapshot linkage, AI CFO page persisted-history hydration, Daily Review snapshot linkage, Daily Review demo-mode gating, and Goals scoped PostgreSQL persistence.
- `__tests__/lib/coreDecisioningPersistenceMigration.test.ts` covers the additive `0004_core_decisioning_persistence` migration, including the Daily Review `calculation_snapshot_id` link.

Attempt 1 continuation evidence:

- `__tests__/lib/coreDecisioningPersistenceMigration.test.ts` covers `0005_daily_review_append_only_history` and asserts it does not delete or truncate review rows.
- `__tests__/lib/coreDecisioningPostgresService.test.ts` asserts Daily Review writes use `on conflict (user_id, app_id)` rather than the legacy `review_date` conflict path.
- Earlier supervised attempts did not run migration bootstrap and rollback rehearsal; the product-mode pilot validation update above records the later successful bootstrap and rollback-check.

Remaining outside this constrained program:

- live bank-feed ingestion
- notifications
- exports
- account deletion
- broad operational tooling
- full production deployment automation

The correct status wording is "private-beta core product persistence complete for converted domains"; wider application persistence is not complete until excluded domains are converted, retired or explicitly accepted as out of scope.
