# Evaluation V3 Offline Resolution

Status: completed for offline readiness.

This record resolves the known offline evaluation-system defects from:

- Original run: `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80`
- Rerun v2: `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7`
- Halted operational run: `live-eval-7af717c3-d76d-437c-bc35-16f62bcffdb0`

The halted run remains operational evidence only and is excluded from model-quality pass-rate calculations.

## Baseline

The original and v2 artifacts, human reviews, hard-failure investigations, paired comparison, prohibited-claim audit, confidence audit, counterfactual scores and task restrictions are treated as immutable. The baseline hash manifest is written to:

`.vireon/model-evaluation/analysis/v3-offline-resolution-baseline-hashes-v1.json`

Revised analysis must use a new artifact version and preserve historical conclusions.

## Failure Resolution

All nine v2 hard failures have final offline classifications in:

`.vireon/model-evaluation/analysis/v3-rerun-hard-failure-resolution-v1.json`

Summary:

- 6 confirmed prompt-policy failures involving the v2 confidence contract.
- 3 unresolved pending live test involving prohibited-claim scope where raw live output was intentionally not persisted.
- 0 historical run artifacts mutated.

The confidence failures are not evidence or deterministic-fidelity failures. They show that v2 still asked the model to supply one global confidence field while local validation enforced a minimum-confidence rule. V3 resolves this by using deterministic, task-specific confidence sources and ceilings.

The prohibited-claim failures cannot be fully cleared from the live artifacts alone because raw output text is not stored by default. They remain Stage-A validation targets.

## Regression Causes

Regression traces are stored in:

`.vireon/model-evaluation/analysis/v3-regression-causal-traces-v1.json`

Required Stage-A regressions:

- `fixture-01-payslip-extraction`: changed prompt behaviour, confidence validation transition.
- `fixture-03-mortgage-statement-extraction`: changed prompt behaviour, confidence validation transition.
- `fixture-32-unsupported-action-rejection`: changed claim-extractor behaviour, prohibited-claim transition.

All three are included in Stage A.

## Readiness

V3 offline remediation reaches Stage-A budget-approval readiness, not paid execution readiness.

Current state:

`READY FOR BUDGET APPROVAL`

Paid execution remains not authorised.
