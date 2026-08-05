# Evaluation & Trust Framework

Evaluation & Trust Framework v1 measures whether AI outputs are accurate, grounded, safe, consistent, cost-aware and compliant with Vireon's financial guardrails.

It evaluates models, prompts, routing policies and worker configurations through the Model Orchestrator. It never calls provider SDKs directly.

## Architecture

- `src/lib/modelEvaluation/types.ts`: fixture, run, result, baseline, promotion and calibration models.
- `src/lib/modelEvaluation/fixtures.ts`: versioned synthetic benchmark fixtures and suites.
- `src/lib/modelEvaluation/runner.ts`: mock, deterministic, regression and live-opt-in run orchestration.
- `src/lib/modelEvaluation/scorers.ts`: deterministic scoring and hard-failure detection.
- `src/lib/modelEvaluation/groundTruth.ts`: fixture safety validation and structured claim analysis.
- `src/lib/modelEvaluation/calibration.ts`: Brier score, expected calibration error and confidence buckets.
- `src/lib/modelEvaluation/comparison.ts`: side-by-side run comparison.
- `src/lib/modelEvaluation/promotion.ts`: promotion gates and immutable prompt-version guardrails.
- `src/lib/modelEvaluation/store.ts`: local immutable evaluation history.
- `/model-evaluation`: Developer Mode scorecards, fixtures, calibration and promotion gates.

## Default Execution

Default evaluation runs use synthetic fixtures with mock or deterministic adapters only.

Paid live-provider evaluation is blocked unless:

- `VIREON_LIVE_MODEL_EVALUATION=true`
- a provider is configured
- a budget and fixture limit are supplied
- the evaluation environment is approved
- the fixture set is synthetic or explicitly approved

## Scoring

Scores are normalised from `0` to `1`, but hard failures remain separate. A high average score never hides a hard safety failure.

Core score areas:

- schema validity
- factual accuracy
- evidence grounding
- deterministic fidelity
- unsupported claims
- completeness
- safety
- policy compliance
- confidence calibration
- professional-review handling
- action-boundary compliance
- latency
- cost

## Hard Failures

Hard failures include invented facts, changed deterministic results, unsupported evidence references, missing professional-review classification, prohibited autonomous actions, fabricated realised benefits, policy bypasses and unsafe test data.

Any hard failure fails the fixture regardless of aggregate score.

## Promotion

v1 can recommend promotion status, but it cannot make a model, prompt, routing policy or worker preferred automatically. Human review is always required before preferred-model promotion.

## Privacy

Routine evaluation stores fixture IDs, hashes, structured scores and metadata. It does not store raw prompts, raw provider responses, real bank data, identity numbers, customer conversations or production model-run history by default.

## Live Model Evaluation Pilot

Live Model Evaluation Pilot v1 runs through the same orchestrator and scorers, but adds a stronger preflight and runtime safety envelope:

- one configured commercial provider and model
- `VIREON_LIVE_MODEL_EVALUATION=true`
- `VIREON_SYNTHETIC_DATA_ONLY=true`
- `VIREON_MODEL_ORCHESTRATOR_MODE=live-evaluation`
- non-production environment identifier
- fixture cap no greater than 12
- explicit daily, run and task budgets
- raw prompt logging and raw response storage disabled

The pilot stores prompt hashes, fixture references, routing decisions, validation reports, scores, cost, latency, halt reasons and human-review queue items. It does not store raw prompts or raw provider responses by default.

Safety halt conditions include synthetic-data guard failure, credential exposure, malformed structured output, deterministic-output mutation, action-boundary failure, sensitivity-policy failure, budget exhaustion, unexpected provider/model selection and repeated critical fixture failures.

## Human Review Remediation

Live run `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80` has completed 12/12 local review records and six hard-failure investigations. The review does not mutate original run artifacts.

Remediation is versioned:

- `prompt-eval-live-v2` for confirmed confidence failures
- `deterministic-scorer-v2` for prohibited-claim false positives

The setup remains evaluation-only. Full-suite expansion and model promotion require a fresh 12-fixture rerun with no unresolved critical failures and completed offline regressions.
