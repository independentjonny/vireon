# Daily Review Persistence

Status: CORE DECISIONING DOMAIN COMPLETE

Daily Review history is persisted through `daily_reviews` and linked deterministic metadata. The active Daily Review API and UI no longer use `aiCfoDailyReviewStore` as authoritative runtime state.

Implemented boundary:

- `/api/ai-cfo/daily-review` reads and writes through `src/server/services/coreDecisioningPostgresService.ts`.
- Each generated review stores the review payload, current snapshot, previous snapshot, mode, settings, engine version, generation status, warnings and a `calculation_snapshot_id` link.
- `migrations/0005_daily_review_append_only_history.sql` removes the original one-review-per-user/date constraint so same-day generated reviews remain durable history keyed by `app_id`.
- The dashboard, AI CFO page and Daily Review page load the latest persisted review through the same service.
- Failed generation returns an explicit persistence error and does not overwrite the previous successful review.
- Active app/server code no longer imports `aiCfoDailyReviewStore`; that legacy module is retained only for test/demo isolation.

Source-of-truth rules:

- Daily Review owns generated briefing history.
- Financial Vault owns verified facts.
- Deterministic engines own calculations.
- Daily Review snapshots are classified as calculation records, not Financial Vault facts.
- Live AI remains disabled and is not required for Daily Review persistence.

Restart durability:

- Review history is loaded from PostgreSQL by user ID, review date and creation ordering, with each row linked to its deterministic calculation snapshot.
- Browser state may only control transient display state such as selected mode or expanded panels.

Known limitation:

- Notification delivery and scheduled background generation are outside this constrained core-domain program and remain future work.
- The 0005 migration has SQL/unit coverage in this implementation attempt, but live bootstrap and rollback rehearsal still need to be run in an approved migration window.
