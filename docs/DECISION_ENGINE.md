# Decision Engine

The Decision Engine is the brain specification for Vireon. It turns verified financial data into ranked, explainable, actionable recommendations.

## Decision Types

- Mortgage
- Subscriptions
- Tax
- Investments
- Debt
- Insurance
- Cash Flow
- Goals
- Housing
- Retirement
- Document Requests
- Income Verification
- Credit Health
- Timeline Events

## Decision Inputs

Each decision should consume:

- Vault records.
- Derived domain metrics.
- Timeline events.
- User goals.
- Missing data blockers.
- Risk indicators.
- Evidence references.
- User preferences and constraints.

## Required Decision Fields

- `id`
- `type`
- `title`
- `summary`
- `priority`
- `financialImpact`
- `expectedFinancialValue`
- `probability`
- `confidence`
- `difficulty`
- `timeRequired`
- `riskReduction`
- `cashImprovement`
- `netWorthImprovement`
- `borrowingImprovement`
- `taxImprovement`
- `lifeImprovement`
- `overallOpportunityScore`
- `evidenceRefs`
- `assumptions`
- `risks`
- `alternatives`
- `nextAction`
- `status`

## Scoring

### Expected Financial Value

Expected Financial Value should estimate the likely dollar value of acting:

`expectedFinancialValue = financialImpact * probability * confidence`

Use annualized value unless the decision is clearly one-time.

### Opportunity Score

Opportunity Score should combine financial and non-financial value:

- Expected Financial Value
- Risk reduction
- Cash improvement
- Net worth improvement
- Borrowing improvement
- Tax improvement
- Life improvement
- Difficulty penalty
- Time required penalty
- Confidence adjustment

Sort by Expected Financial Value first, then Opportunity Score.

## Priority Rules

Priority is not severity. Priority reflects action value.

- Critical: major expected value, major downside if ignored, or deadline-driven.
- High: strong expected value or risk reduction with high confidence.
- Medium: useful value, moderate confidence, or optional timing.
- Low: low value, weak confidence, or informational.

## Ownership Structure Intelligence Rules

Vireon must never use a shortcut such as `high salary + family = trust`. Ownership structure comparisons must model the complete lifecycle before showing suitability:

- Purchase.
- Annual ownership.
- Financing.
- Distributions or retained income.
- Sale and indicative CGT treatment.
- Estate transfer and control.

Trusts may be useful in some scenarios, but the engine must explicitly test trapped losses, eligible beneficiaries, annual resolutions, lending availability, professional costs, land tax and sale outcomes. Companies must be tested across retained profits, later distributions and the lack of the individual 50% CGT discount. No single entity structure should be shown as suitable from income level, family status or asset-protection preference alone.

## Explanation Template

Every decision must explain:

- Why this matters.
- Evidence.
- Confidence.
- Assumptions.
- Risk.
- Alternatives.
- Expected benefit.
- Supporting transactions.
- Supporting documents.
- Time required.
- Next action.

## Evidence Requirements

- Mortgage decisions require loan, rate, repayment, property, income, and cash flow evidence.
- Subscription decisions require transaction recurrence, merchant, amount, and usage or duplicate evidence where available.
- Tax decisions require income, deductions, tax records, super, investment income, and jurisdiction assumptions.
- Investment decisions require goals, risk profile, cash buffer, current allocation, and time horizon.
- Housing decisions require income, deposit, debts, expenses, property assumptions, lending assumptions, and cash flow impact.
- Retirement decisions require age, super, investments, savings rate, spending, goals, and retirement assumptions.

## Status Lifecycle

- New
- Reviewed
- Workflow Started
- Waiting on User
- Waiting on Document
- Actioned
- Dismissed
- Expired
