# AI Confidence Calibration

Confidence is tracked separately from accuracy. A model that answers many fixtures correctly but is severely overconfident is not automatically suitable for high-risk financial tasks.

## Metrics

The v1 calibration report includes:

- Brier score
- expected calibration error
- overconfidence rate
- underconfidence rate
- reliability buckets
- calibration by benchmark category
- calibration by provider
- calibration by worker
- calibration by risk group

## Interpretation

Confidence means the model's declared confidence in its output, not Vireon's verified financial confidence. Vireon financial confidence remains grounded in evidence quality, calculation freshness, rule provenance and deterministic engine results.

## Guardrails

- Missing evidence should lower confidence or block a conclusion.
- Stale rules must be disclosed.
- Professional-review-required results must not use high confidence to imply formal advice.
- Confidence cannot override hard failures.

## Live Pilot Calibration

Live Model Evaluation Pilot v1 begins calibration only after reviewed synthetic fixture results exist. Small-sample results are preliminary and cannot justify preferred-model promotion without expanded evaluation and human approval.

For rerun v2, calibration must be reported as paired preliminary analysis:

- original run `n=12`
- rerun `n=12`
- paired comparable fixtures `n=12`
- total observations `n=24`, not treated as 24 independent scenarios

Rerun v2 `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7` has review records completed and preliminary paired calibration recorded in `.vireon/model-evaluation/reviews/live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7-paired-comparison.json`.

Current paired interpretation:

- original run `n=12`
- rerun `n=12`
- paired comparable fixtures `n=12`
- total responses reviewed `n=24`
- independent scenario count remains `12`

The rerun lowered the overall score and introduced regressions, so calibration remains preliminary and cannot support promotion or expansion.

Failure decomposition v1 replaces the single model-confidence approach with `confidence-policy-v3-task-ceilings`. Future model confidence must be bounded by deterministic ceilings for missing evidence, conflicting evidence, stale evidence, estimates, professional-review requirements, unsupported assumptions and risk level.
