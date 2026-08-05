# Vireon Operating Manual

This directory is the persistent product constitution for Vireon. Future AI and human development sessions should read this index before making product, UI, data, AI, or architecture decisions.

## Read Order

1. `PRODUCT_VISION.md` - why Vireon exists.
2. `UX_PRINCIPLES.md` - how every screen should behave.
3. `DECISION_ENGINE.md` - the brain specification for recommendations.
4. `DATA_MODEL.md` - the Financial Vault and shared data contracts.
5. `AI_ARCHITECTURE.md` - AI CFO, context, prompting, and confidence.
6. `DESIGN_SYSTEM.md` - visual and interaction standards.
7. `ROADMAP.md` - platform evolution sequence.
8. `FEATURE_STATUS.md` - what exists, what is in progress, and what is planned.
9. `CODING_STANDARDS.md` - implementation conventions.
10. `TESTING.md` - verification expectations.
11. `PERSISTENCE_AUDIT.md` - current local/browser/mock persistence inventory.
12. `DATA_OWNERSHIP.md` - canonical data owners and mutation boundaries.
13. `BACKUP_AND_RECOVERY.md` - production backup, restore, rollback and recovery drill expectations.
14. `PRODUCTION_ROLLOUT.md` - staged transition from local-first storage to production persistence.

## Non-Negotiable Product Principles

- Every screen must answer a financial question.
- AI first. Charts second. Users care about actions, not graphs.
- Everything connects. Transactions, cash flow, balance sheet, borrowing, housing, retirement, goals, timeline, and reports must not become silos.
- Every recommendation must explain why, evidence, confidence, expected outcome, and time required.
- Never duplicate calculations. The Financial Vault owns verified financial data; other systems reference it.
- Every feature must improve net worth, cash flow, borrowing capacity, tax position, financial confidence, or time saved.
