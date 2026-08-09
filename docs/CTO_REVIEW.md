# Vireon CTO Review

Vireon follows Director's CTO gate with these product-specific acceptance rules.

## Confirmed data only

Customer-facing values may come only from confirmed current customer data or from derived values whose required inputs are confirmed. Demo values, hard-coded defaults, retired onboarding values, superseded records, scenario assumptions, unconfirmed extraction, and historical values must never be presented as current.

Missing is not zero. Partial is not complete. Known assets are not net worth. Mortgage repayment is not mortgage balance.

## Cross-page reconciliation

When a financial fact changes, identify and verify every consumer. A page-level fix is incomplete until the relevant screens reconcile—for example, cash across Accounts, Balance Sheet, and Today; mortgage repayment across Cash Flow and Property; and confirmed assets across Balance Sheet and Today.

## Screenshot review

Customer-facing work must be rendered early. Reference-driven UI review compares sidebar width, grid geometry, card size, spacing, typography, density, hierarchy, controls, and branding. Tests cannot establish visual acceptance when the rendered screen is wrong or was not observed.

## Page purpose

Every page must answer one customer question. Unrelated metrics must not accumulate on a page.

Document Vault remains the sole document-upload authority. Other pages may link to it but must not introduce another PDF ingestion flow.

## Release acceptance

CTO approval is required at the checkpoints defined in `director/CTO_GATE.md`. A Preview and its evidence must be available before Production. The operator retains final product acceptance and all Production authority.
