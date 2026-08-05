# Live Model Evaluation Rerun v2

Original run: `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80`

Status: `completed; remediation not validated`

Completed rerun: `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7`

An earlier v2 attempt, `live-eval-7af717c3-d76d-437c-bc35-16f62bcffdb0`, halted after one budget-blocked fixture because the per-task cap was below the orchestrator estimate. That halted run is preserved separately and is not treated as the paired quality result.

The completed rerun contacted OpenAI `gpt-5.2` through the server-only adapter using the same 12 synthetic fixture IDs and versions as the original run.

## Intended Rerun Scope

- Provider: OpenAI only
- Model: same explicitly configured OpenAI model as the original run
- Fixture count: same 12 synthetic fixture IDs and versions
- Prompt version: `prompt-eval-live-v2`
- Scorer version: `deterministic-scorer-v2`
- Claim extractor: `claim-extractor-v2-negation-aware`
- Anthropic/Gemini: disabled
- Raw prompt storage: disabled
- Raw response storage: disabled
- Automatic promotion: disabled
- Full-suite expansion: not executed and not eligible

## Offline Gate

The offline gate passed before the paid rerun was attempted:

- `npm run lint`: passed with 28 existing warnings
- `npm run typecheck`: passed
- targeted scorer/prompt/live-evaluation tests: passed 54/54
- `npm run models:evaluate:mock`: passed 32/32
- `npm run models:evaluate:regression`: passed 12/12
- `npm run test`: passed 277/277
- `npm run build`: passed

## Rerun Preflight Result

`npm run models:evaluate:rerun:preflight` with `VIREON_OFFLINE_REGRESSION_PASSED=true` returned `READY FOR PAID 12-FIXTURE RERUN`.

The preflight confirmed:

- `VIREON_LIVE_MODEL_PROMPT_VERSION=prompt-eval-live-v2`
- `VIREON_LIVE_MODEL_SCORER_VERSION=deterministic-scorer-v2`
- provider `openai`
- model `gpt-5.2`
- fixture count `12`
- estimated maximum cost `$1.00`
- synthetic-only mode
- raw prompt and raw response storage disabled

## Execution Result

- Original run: `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80`
- Rerun: `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7`
- Provider/model: `openai` / `gpt-5.2`
- Prompt/scorer: `prompt-eval-live-v2` / `deterministic-scorer-v2`
- Requests: `12`
- Cost: `$0.009415`
- Halt reason: `none`
- Result: `4/12` passed, `8/12` failed
- Hard failures: `9`
- Human reviews: `12/12`
- Expansion: blocked
- Promotion: disabled

The rerun did not validate the targeted remediation. Six confidence failures remain, three prohibited-claim failures remain, and three previously passing fixtures regressed.

Failure decomposition v1 artifacts:

- `.vireon/model-evaluation/analysis/live-failure-decomposition-v1.json`
- `.vireon/model-evaluation/analysis/prohibited-claim-audit-v1.json`
- `.vireon/model-evaluation/analysis/confidence-policy-v3-audit.json`
- `.vireon/model-evaluation/analysis/gpt-5.2-task-restrictions-v1.json`
- `.vireon/model-evaluation/analysis/live-eval-v3-offline-candidate.json`

## Required Environment

Use private server-side environment configuration only. Do not commit values.

```bash
VIREON_OPENAI_ENABLED=true
VIREON_OPENAI_API_KEY=<server-only-secret>
VIREON_OPENAI_DEFAULT_MODEL=<same-model-as-original>
VIREON_OPENAI_APPROVED_SENSITIVITY_LEVELS=public,internal,personal,financial-sensitive
VIREON_MODEL_ORCHESTRATOR_MODE=live-evaluation
VIREON_LIVE_MODEL_EVALUATION=true
VIREON_SYNTHETIC_DATA_ONLY=true
VIREON_DATA_SOURCE=synthetic
VIREON_MODEL_EVALUATION_ENVIRONMENT=local-pilot
VIREON_LIVE_MODEL_DAILY_BUDGET=1
VIREON_LIVE_MODEL_MAX_RUN_COST=1
VIREON_LIVE_MODEL_MAX_TASK_COST=<small-per-task-cap>
VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT=12
VIREON_LIVE_MODEL_MAX_RETRIES=<bounded-count>
VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS=<bounded-count>
VIREON_LIVE_MODEL_PROMPT_VERSION=prompt-eval-live-v2
VIREON_LIVE_MODEL_SCORER_VERSION=deterministic-scorer-v2
VIREON_MODEL_LOG_PROMPTS=false
VIREON_MODEL_STORE_RAW_RESPONSES=false
VIREON_MODEL_ALLOW_CROSS_PROVIDER_FALLBACK=false
```

## Current Decision

The configuration remains evaluation-only. Full-suite expansion is blocked because the rerun has unresolved hard failures and regressions against original passing fixtures.
