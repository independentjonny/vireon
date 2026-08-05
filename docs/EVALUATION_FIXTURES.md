# Evaluation Fixtures

Evaluation fixtures are versioned test cases used to benchmark AI output quality without using real-user financial data.

## Fixture Sources

Default runs may use only:

- `synthetic`
- `deterministic-generated`
- `manually-reviewed` synthetic fixtures

`approved-anonymised` fixtures require explicit opt-in and must not run in default local validation.

## v1 Coverage

`eval-fixture-v1.0` contains 32 fixtures across 20 benchmark categories:

- payslip extraction
- bank statement classification
- mortgage statement extraction
- financial position synthesis
- cash-flow anomaly explanation
- debt optimisation explanation
- mortgage comparison
- borrowing-capacity explanation
- investment-structure critique
- tax-rule grounding
- Digital Twin scenario explanation
- Daily Review briefing
- Timeline explanation
- Decision Centre recommendation
- workflow plan generation
- evidence completeness detection
- conflicting-fact detection
- professional-review escalation
- unsupported-action rejection
- user-facing financial explanation

The default set includes high-risk, missing-evidence, conflicting-data and adversarial cases.

## Ground Truth

Ground truth separates:

- exact facts
- accepted numeric ranges
- required concepts
- acceptable alternatives
- prohibited claims
- evidence requirements
- deterministic outputs
- expected uncertainty
- expected professional-review classification

Natural-language answers are not exact-text matched. Deterministic values are exact or tolerance-scored.

## Governance

Every fixture must carry a test-data marker and synthetic fixture user scope. Cross-user or unmarked data is rejected before execution.

## Live Pilot Subset

The live pilot uses a deterministic subset of at most 12 fixtures. The subset includes extraction, synthesis, mortgage/debt, Digital Twin, Daily Review, Timeline, missing-evidence, professional-review and adversarial cases. It is labelled as a partial fixture set and cannot be reported as full-suite validation.
