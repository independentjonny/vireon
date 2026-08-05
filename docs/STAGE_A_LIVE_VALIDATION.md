# Stage A Live Validation v1

Stage A is a six-fixture live hypothesis test for the v3 remediation work. It is not a benchmark, does not promote any model and cannot expand to Stage B automatically.

## Scope

Provider and model:

- Provider: OpenAI
- Model: `gpt-5.2`
- Model status: evaluation-only
- Prompt version: `stage-a-task-specific-v3`
- Scorer version: `deterministic-scorer-v3-structured-claims-candidate`
- Confidence policy: `confidence-policy-v3-task-ceilings`

Fixtures:

- `fixture-01-payslip-extraction`
- `fixture-03-mortgage-statement-extraction`
- `fixture-32-unsupported-action-rejection`
- `fixture-12-daily-review-briefing`
- `fixture-13-timeline-explanation`
- `fixture-07-mortgage-comparison`

## Controls

- Exactly six fixture requests.
- Synthetic fixtures only.
- No Anthropic or Gemini.
- No cross-provider fallback.
- No paid judge calls.
- No prompt, scorer or fixture changes after execution begins.
- No automatic model promotion.
- Stage B remains separately authorised.

## Commands

- `npm run models:evaluate:stage-a`
- `npm run models:evaluate:review`

`models:evaluate:stage-a` refuses to call a provider unless live OpenAI configuration, the exact candidate model, six-fixture cap, v3 prompt/scorer versions and explicit Stage-A budget approval are present.

## Current Execution Status

On 2026-07-22, Stage A reached `READY FOR PAID STAGE-A EXECUTION` and was attempted with the approved six-fixture configuration.

Recorded state:

- Run ID: `live-eval-79a12349-4223-4c79-9fec-295e8deaaeb4`
- Provider: OpenAI
- Model: `gpt-5.2`
- Fixture count: 6
- Request count recorded by evaluation runner: 1
- Completed fixture records: 1
- Blocked fixtures: 5
- Cost: `$0`
- Status: halted
- Halt reason: `unexpected-provider`
- Underlying first fixture model status: `budget-blocked`
- Underlying first fixture error code: `BUDGET_EXCEEDED`
- Human review: 1/1 completed for the recorded result
- Stage-B candidate: not created
- Model promotion: disabled

Artifacts:

- `.vireon/model-evaluation/live/live-eval-79a12349-4223-4c79-9fec-295e8deaaeb4-manifest.json`
- `.vireon/model-evaluation/live/live-eval-79a12349-4223-4c79-9fec-295e8deaaeb4-summary.json`
- `.vireon/model-evaluation/stage-a/live-eval-79a12349-4223-4c79-9fec-295e8deaaeb4-stage-a-live-manifest.json`
- `.vireon/model-evaluation/stage-a/live-eval-79a12349-4223-4c79-9fec-295e8deaaeb4-stage-a-live-manifest.integrity.json`
- `.vireon/model-evaluation/reviews/live-eval-79a12349-4223-4c79-9fec-295e8deaaeb4-paired-comparison.json`

No six-fixture Stage-A quality conclusion was created. Stage B remains blocked and the model remains evaluation-only.

## Budget and Halt-Reason Remediation

On 2026-07-23, the halted run was preserved and interpreted through a separate correction artifact.

Correction summary:

- Historical halt reason remains: `unexpected-provider`
- Underlying task state: `budget-blocked`
- Underlying error code: `BUDGET_EXCEEDED`
- Corrected analytical cause: budget-control rejection
- Provider mismatch confirmed: false
- Actual provider response present: false
- Fixture record type: blocked fixture record
- Quality treatment: excluded from model pass rates, model-quality comparisons, confidence calibration, scorer precision/recall and provider latency statistics
- Operational treatment: included in operational reliability statistics

Root cause:

- The approved per-task cap was `$0.02`.
- Runtime estimated the first Stage-A request at `$0.23`.
- The runtime budget guard correctly blocked the task before provider execution.
- The historical halt classifier checked provider identity before budget error code and misclassified the local blocked result as `unexpected-provider`.

Remediation:

- `BUDGET_EXCEEDED` now maps to `budget-exceeded`.
- Provider mismatch now requires actual provider/model identity evidence.
- Unknown local block errors map to `internal-evaluation-error`.
- Stage-A preflight now dry-runs all six budget reservations before creating a live run.
- Preflight and runtime now share the live-evaluation budget source and budget configuration hash.

Fresh candidate:

- Candidate artifact: `.vireon/model-evaluation/stage-a/stage-a-execution-candidate-2026-07-23.json`
- Budget approval artifact: `.vireon/model-evaluation/stage-a/stage-a-spending-authorisation-2026-07-23.json`
- Halt correction artifact: `.vireon/model-evaluation/stage-a/live-eval-79a12349-4223-4c79-9fec-295e8deaaeb4-halt-cause-correction-2026-07-23.json`
- Reserved six-fixture cost: `$1.38`
- Per-task cap: `$0.30`
- Per-run cap: `$1.80`
- Daily cap: `$1.80`
- Retry reserve: `$0`
- Budget configuration hash: `b85666812fbbf9c9404d2cc108d450ee45b0f4ab9a80073a7ce8091f07a78665`

The fresh candidate is prepared for separate paid execution only. Stage B remains blocked and the model remains evaluation-only.

## Evaluation-Mode Routing Remediation

On 2026-07-23, a subsequent guarded Stage-A attempt created run `live-eval-41fb5bd5-6bce-4cf0-8b6d-c798f01c8c9d` and halted before any provider request.

Recorded state:

- Preflight status: ready
- Budget reservation: valid
- Request count: `0`
- Cost: `$0`
- Halt reason: `internal-evaluation-error`
- First fixture: `fixture-01-payslip-extraction`
- First error: `MODEL_NOT_AVAILABLE`
- Stage-B candidate: not created
- Model promotion: disabled

Correction summary:

- The run remains immutable.
- A separate linked remediation artifact records the corrected analytical cause: evaluation eligibility was not separated from production task restrictions.
- No provider request occurred.
- No model-quality claim was created.

Remediation:

- Explicit execution modes were added: `PRODUCTION`, `INTERNAL_EVALUATION`, `OFFLINE_TEST` and `MOCK`.
- Production restrictions remain hard-blocking in `PRODUCTION`.
- `INTERNAL_EVALUATION` can clear production-only restrictions only for the approved Stage-A synthetic envelope: exact six fixture IDs, OpenAI, `gpt-5.2`, task-specific v3 prompts, scorer-v3, no fallback and mandatory human review.
- Routing now distinguishes model registration, model health, production restriction, evaluation eligibility, task eligibility and provider availability instead of collapsing those decisions into `MODEL_NOT_AVAILABLE`.
- Developer Mode now shows production eligibility, evaluation eligibility, restriction source, override source and current mode.

The fresh Stage-A candidate remains ready for separate paid execution. Stage B remains blocked and the model remains evaluation-only.
