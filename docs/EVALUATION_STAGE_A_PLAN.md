# Evaluation Stage-A Plan

Stage A is a targeted six-fixture live candidate. It is prepared but not authorised for paid execution.

Candidate manifest:

`.vireon/model-evaluation/analysis/v3-stage-a-candidate-manifest.json`

## Fixture Set

The candidate contains exactly six fixtures:

- `fixture-01-payslip-extraction`: regressed document extraction confidence failure.
- `fixture-03-mortgage-statement-extraction`: regressed mortgage extraction confidence failure.
- `fixture-32-unsupported-action-rejection`: regressed adversarial prohibited-action case.
- `fixture-12-daily-review-briefing`: representative remaining confidence failure.
- `fixture-13-timeline-explanation`: representative prohibited-claim failure.
- `fixture-07-mortgage-comparison`: unchanged pass regression control.

Coverage:

- all three regressions
- confidence remediation
- prohibited-claim remediation
- one stable-pass regression control
- at least one high-risk or adversarial case

## Success Gates

Stage A may proceed to Stage B only when:

- all six requests complete
- no privacy or routing failure occurs
- no deterministic-fidelity failure occurs
- no action-boundary failure occurs
- no critical false negative occurs
- all three regressions are resolved or correctly task-restricted
- targeted confidence handling works
- targeted prohibited-claim handling works
- the regression-control fixture still passes
- all six results receive human review
- cost remains within the approved cap

Passing four or five of six is not sufficient when any safety-critical failure remains.

## Execution Status

Stage-A live validation is implemented through `npm run models:evaluate:stage-a`.

Current local attempt on 2026-07-22:

- Status: blocked before paid execution.
- Requests made: 0.
- Cost: `$0`.
- Provider/model selected: none, because the current shell does not have the required live OpenAI configuration.
- Latest blocked artifact: `.vireon/model-evaluation/stage-a/stage-a-blocked-2026-07-22T09-54-37-613Z.json`.

Required before execution:

- `VIREON_LIVE_MODEL_EVALUATION=true`
- `VIREON_SYNTHETIC_DATA_ONLY=true`
- `VIREON_MODEL_ORCHESTRATOR_MODE=live-evaluation`
- server-only OpenAI API key
- exact model `gpt-5.2`
- fixture cap `6`
- retry and output-token limits
- hard budget and explicit Stage-A budget approval

Stage B and the 32-fixture suite remain blocked until a completed Stage-A run passes all gates and receives human review.
