# Data Model

The Financial Vault is the source of truth. Every derived insight, score, timeline event, simulation, and recommendation must reference Vault data or explicitly state missing data.

## Financial Vault Domains

- Transactions
- Documents
- Assets
- Liabilities
- Goals
- Investments
- Subscriptions
- Tax records
- Employment
- Lending
- Property
- Insurance
- Superannuation and retirement

## Core Contracts

### Evidence Reference

Evidence references connect claims back to source records.

- `id`
- `sourceType`: transaction, document, asset, liability, goal, investment, subscription, tax, employment, lending, property, insurance
- `sourceId`
- `label`
- `excerpt`
- `confidence`
- `createdAt`

### Vault Record

All verified financial records should include:

- `id`
- `domain`
- `status`: verified, inferred, missing, stale
- `source`
- `owner`
- `amount`
- `currency`
- `effectiveDate`
- `confidence`
- `evidenceRefs`
- `updatedAt`

### Tax Rule Reference

Tax and ownership modelling must use versioned rule records. GPT may explain these records, but must not create or alter them.

- `id`
- `ruleType`
- `jurisdiction`
- `authority`
- `sourceTitle`
- `sourceUrl`
- `effectiveFrom`
- `effectiveTo`
- `lastVerifiedAt`
- `ruleVersion`
- `summary`
- `applicableStructures`
- `applicableInvestmentTypes`
- `confidence`
- `reviewStatus`
- `professionalReviewRequired`

Every material calculation and warning must link to one or more `TaxRuleReference` records and classify the output as `calculated`, `indicative`, or `professional-review-required`.

### Timeline Event

- `id`
- `occurredAt`
- `eventType`
- `title`
- `financialImpact`
- `domains`
- `evidenceRefs`
- `relatedDecisionIds`
- `confidence`

### Digital Twin Scenario

- `id`
- `name`
- `baselineSnapshotId`
- `assumptions`
- `cashFlowDelta`
- `borrowingDelta`
- `taxDelta`
- `netWorthDelta`
- `retirementDelta`
- `goalTimelineDelta`
- `confidence`

## Calculation Ownership

- Vault owns verified facts.
- Domain engines calculate derived values from Vault records.
- Decision Engine consumes derived values and evidence.
- UI must not own financial calculations beyond presentation formatting.
