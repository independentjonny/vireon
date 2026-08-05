# Financial Health Engine v1

Financial Health Engine v1 turns confirmed Financial Vault records into deterministic health metrics and actions. It does not call an AI model and it does not use unreviewed import candidates.

## Inputs

- Confirmed canonical records only.
- Supported record kinds: transaction, account, asset, liability, income and expense.
- Rejected, unreviewed and superseded records are excluded.
- Every metric carries evidence record IDs where supporting records exist.

## Outputs

- Cash-flow metrics: average monthly income, average monthly spending, surplus, savings rate, burn rate and income stability.
- Spending metrics: largest categories, recurring subscription-like merchants, month-on-month spending trend and merchant concentration.
- Debt metrics: total debt, debt-to-income ratio, mortgage utilisation, credit-card utilisation and estimated monthly interest burden.
- Safety metrics: emergency-fund coverage, liquidity, income concentration and upcoming large obligations.
- Wealth metrics: net worth, asset allocation, super proportion and debt ratio.
- Deterministic actions for Decision Centre and AI CFO context.

## Guardrails

- The engine is deterministic and local.
- It does not provide financial, tax, credit or legal advice.
- Professional-review flags are attached to debt/refinance-style actions where appropriate.
- Missing inputs produce lower-confidence metrics and data-refresh actions rather than invented values.
- AI CFO may explain these results, but it must not change calculations or invent missing Vault facts.

## Current Integration

- `ManualFinancialDataPlatform.financialHealth(userId)` returns the health snapshot.
- `/api/financial-vault/imports` returns `health` beside imports, canonical records, decisions and refresh status.
- `/financial-vault/imports` shows the health score, key metrics, deterministic actions and AI CFO briefing facts after confirmed import data exists.
