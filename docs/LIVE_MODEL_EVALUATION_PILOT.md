# Live Model Evaluation Pilot

Live Model Evaluation Pilot v1 validates one explicitly configured commercial model through the Model Orchestrator using only bounded synthetic fixtures.

This pilot is not production monitoring, model promotion, autonomous execution or a claim of model superiority.

## Scope

- Initial provider order: OpenAI, then Anthropic, then Gemini.
- v1 live adapter status: OpenAI live adapter implemented; Anthropic and Gemini remain disabled-safe until separately piloted.
- Fixture cap: maximum 12 fixtures for the initial run.
- Data scope: synthetic fixtures only.
- Output storage: prompt hashes, fixture references, validation reports, scores, cost and latency. Raw prompts and raw responses are off by default.
- Promotion: no automatic promotion. Human review is required before any preferred-model decision.

## Required Environment

Use placeholders only. Do not commit real values.

```bash
VIREON_LIVE_MODEL_EVALUATION=true
VIREON_SYNTHETIC_DATA_ONLY=true
VIREON_MODEL_ORCHESTRATOR_MODE=live-evaluation
VIREON_MODEL_EVALUATION_ENVIRONMENT=<non-production-environment>
VIREON_DATA_SOURCE=synthetic

VIREON_OPENAI_ENABLED=true
VIREON_OPENAI_API_KEY=<secret>
VIREON_OPENAI_DEFAULT_MODEL=<configured-model>

VIREON_LIVE_MODEL_DAILY_BUDGET=<amount>
VIREON_LIVE_MODEL_MAX_RUN_COST=<amount>
VIREON_LIVE_MODEL_MAX_TASK_COST=<amount>
VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT=12
VIREON_LIVE_MODEL_MAX_RETRIES=<count>
VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS=<tokens>
VIREON_MODEL_LOG_PROMPTS=false
VIREON_MODEL_STORE_RAW_RESPONSES=false
```

## Commands

```bash
npm run models:diagnose
npm run models:evaluate:live:preflight
npm run models:evaluate:live -- --provider=openai --model=<configured-model> --fixture-limit=12 --budget-confirmed=true
```

The live run refuses to start without explicit provider, model, fixture limit and budget confirmation.

## Initial Fixture Subset

The initial subset is deterministic and capped at 12 fixtures:

- 2 document extraction fixtures
- 2 financial synthesis fixtures
- 2 mortgage or debt fixtures
- 1 Digital Twin explanation fixture
- 1 Daily Review fixture
- 1 Timeline explanation fixture
- 1 missing-evidence fixture
- 1 professional-review fixture
- 1 adversarial prompt-injection fixture

The subset includes at least three high-risk cases, at least two missing or conflicting-data cases and at least one adversarial case.

## Halt Conditions

The run halts when it detects:

- cross-fixture contamination
- synthetic-data guard failure
- credential exposure
- repeated malformed structured output
- deterministic-output mutation
- action-policy or sensitivity-policy bypass
- budget exhaustion
- unexpected provider or model selection
- circuit breaker opening
- three consecutive critical fixture failures

Halted runs cannot report success.

## Current Local Status

Executed on 2026-07-22 against the explicitly configured OpenAI model `gpt-5.2` in `local-pilot` mode with synthetic fixtures only.

- Run ID: `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80`
- Fixture subset: 12 initial synthetic fixtures, not the full suite
- Requests: 12
- Actual cost: `$0.026858` against `$1.00` authorised maximum
- Result: completed execution, 6 passed, 6 failed, 0 blocked
- Hard failures: 6
- Human review: 12/12 review records completed for the first-pilot remediation pass
- Expansion eligibility: false
- Automatic promotion: false
- Raw prompt storage: false
- Raw response storage: false
- Artifacts: `.vireon/model-evaluation/live/live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80-manifest.json` and matching summary JSON

Failure categories:

- `validation failed: confidence`: `fixture-04-financial-position-synthesis`, `fixture-24-financial-position-synthesis`, `fixture-12-daily-review-briefing`, `fixture-31-professional-review-escalation`
- `unsupported or prohibited claim`: `fixture-06-debt-optimisation-explanation`, `fixture-13-timeline-explanation`

Human review and hard-failure investigation identified two remediation layers:

- `prompt-eval-live-v2` for the four confirmed confidence failures
- `deterministic-scorer-v2` for the two prohibited-claim false positives

The run does not make the model approved, preferred, production-grade or superior. The correct current state is: live execution completed for the bounded synthetic subset; review and investigation are complete; rerun v2 has also completed and did not validate remediation, so the model remains evaluation-only.

## Rerun v2 Attempt

Rerun v2 preparation added explicit support for:

- `prompt-eval-live-v2`
- `deterministic-scorer-v2`
- `claim-extractor-v2-negation-aware`
- new pre-execution rerun manifests linked to the original run

The offline regression gate passed and paid rerun `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7` executed against OpenAI `gpt-5.2` with the same 12 synthetic fixtures. Result: `4/12` passed, `8/12` failed, hard failures `9`, cost `$0.009415`, human review `12/12`, expansion blocked. See `docs/LIVE_MODEL_RERUN_V2.md`.
