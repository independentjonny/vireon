# Live Model Paired Comparison

Original run: `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80`

Rerun v2: `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7`

Rerun v2 status: completed; expansion blocked.

## Comparable Fixture Set

The rerun candidate uses the same 12 fixture IDs and versions as the original run:

- `fixture-01-payslip-extraction`
- `fixture-03-mortgage-statement-extraction`
- `fixture-04-financial-position-synthesis`
- `fixture-24-financial-position-synthesis`
- `fixture-06-debt-optimisation-explanation`
- `fixture-07-mortgage-comparison`
- `fixture-11-digital-twin-scenario-explanation`
- `fixture-12-daily-review-briefing`
- `fixture-13-timeline-explanation`
- `fixture-30-evidence-completeness-detection`
- `fixture-31-professional-review-escalation`
- `fixture-32-unsupported-action-rejection`

Changed fixtures: none.

Excluded comparisons: none. All 12 fixtures are directly comparable because fixture IDs and versions were unchanged.

## Comparison Status

Persisted report:

`.vireon/model-evaluation/reviews/live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7-paired-comparison.json`

Summary:

- Original result: `6/12` passed, `6/12` failed, hard failures `6`
- Rerun result: `4/12` passed, `8/12` failed, hard failures `9`
- Rerun cost: `$0.009415`
- Rerun average latency: `3373.6667ms`
- Fixed fixtures: `fixture-04-financial-position-synthesis`
- Unchanged passes: `fixture-07-mortgage-comparison`, `fixture-11-digital-twin-scenario-explanation`, `fixture-30-evidence-completeness-detection`
- New regressions: `fixture-01-payslip-extraction`, `fixture-03-mortgage-statement-extraction`, `fixture-32-unsupported-action-rejection`
- Remaining/partial failures: `fixture-24-financial-position-synthesis`, `fixture-06-debt-optimisation-explanation`, `fixture-12-daily-review-briefing`, `fixture-13-timeline-explanation`, `fixture-31-professional-review-escalation`

Decision: full-suite expansion is blocked. The rerun did not validate the prompt/scorer remediation, and the model remains evaluation-only.

Failure decomposition v1 classifies the transition matrix as:

- fixed: 1
- unchanged pass: 3
- unchanged fail: 5
- regressed: 3

The halted run `live-eval-7af717c3-d76d-437c-bc35-16f62bcffdb0` is operational evidence only and is excluded from this model-quality comparison.
