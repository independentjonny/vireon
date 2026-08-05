# Financial Profile Vault Persistence

Status: SLICE 3 SHARED READ MODEL IMPLEMENTED

Target tables:

- `users`
- `financial_profiles`
- `financial_facts`
- `fact_versions`
- `documents`
- `document_extractions`
- `evidence`
- `rule_references`

The Vault remains the authoritative source of user financial knowledge. Active Financial Vault API reads and writes use PostgreSQL through `src/server/services/financialVaultPostgresService.ts`; non-Vault surfaces consume confirmed facts through `src/server/services/financialPositionReadService.ts`. They no longer read or write `.ai/local-data/financial-vault.json` or `.vireon/manual-financial-data/platform.json`.

Implemented foundation:

- profile initialize/current/update repository methods
- document create/list repository methods
- fact create-with-version and update-with-version repository methods
- RLS scoping through `app.current_user_id`

Slice 2 implementation:

- `/api/financial-vault` persists document metadata to `documents`, extraction state to `document_extractions`, evidence links to `evidence`, extracted profile values to `financial_facts`, and append-only first versions to `fact_versions`.
- `/api/financial-vault/imports` persists import lifecycle envelopes to `migration_runs.preview`, confirmed manual records to `financial_facts`, provenance evidence to `evidence`, and immutable history to `fact_versions`.
- Duplicate-prone document registration, import creation and manual fact creation use `idempotency_keys`.
- User identity is derived from the trusted server session. Request bodies, query strings and client-controlled headers are not accepted as authoritative `user_id` values.
- The UI loads the Vault via PostgreSQL-backed APIs and reports explicit persistence errors when PostgreSQL is unavailable.
- Dashboard, status, housing, forecast, goals, private-beta briefing/export, Digital Twin, Decision Centre, Action Workflows, AI CFO input and Daily Review generation paths use the shared persisted financial read model for Vault facts.

Known limitations:

- Raw document bytes remain outside PostgreSQL; the current slice stores only metadata and extraction text required by the existing UI contract.
- Fact update/archive endpoints are repository/service capabilities still to expose through a dedicated Vault history UI.
- Subscriptions, bank-transaction ingestion, notifications, exports, account deletion and operational tooling remain outside the constrained core decisioning conversion and are tracked separately.
- migrate existing local development/demo data only through an explicit opt-in utility
