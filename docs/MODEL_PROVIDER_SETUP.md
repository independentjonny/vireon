# Model Provider Setup

Model providers are configured by environment variables. Do not commit API keys.

## Global Settings

```bash
VIREON_MODEL_ORCHESTRATOR_MODE=local
VIREON_MODEL_DAILY_BUDGET=25
VIREON_MODEL_MONTHLY_BUDGET=500
VIREON_MODEL_MAX_TASK_COST=2
VIREON_MODEL_ALLOW_CROSS_PROVIDER_FALLBACK=false
VIREON_MODEL_LOG_PROMPTS=false
VIREON_MODEL_STORE_RAW_RESPONSES=false
```

Privacy-preserving defaults are used when values are absent: no raw prompt logging, no raw response storage and no cross-provider fallback.

## OpenAI

```bash
VIREON_OPENAI_ENABLED=true
VIREON_OPENAI_API_KEY=<secret>
VIREON_OPENAI_DEFAULT_MODEL=<configured-model>
VIREON_OPENAI_FAST_MODEL=<configured-fast-model>
VIREON_OPENAI_REASONING_MODEL=<configured-reasoning-model>
```

## Anthropic

```bash
VIREON_ANTHROPIC_ENABLED=true
VIREON_ANTHROPIC_API_KEY=<secret>
VIREON_ANTHROPIC_DEFAULT_MODEL=<configured-model>
VIREON_ANTHROPIC_LONG_CONTEXT_MODEL=<configured-long-context-model>
```

## Google Gemini

```bash
VIREON_GEMINI_ENABLED=true
VIREON_GEMINI_API_KEY=<secret>
VIREON_GEMINI_DEFAULT_MODEL=<configured-model>
VIREON_GEMINI_VISION_MODEL=<configured-vision-model>
```

No commercial provider is enabled without both an enabled flag and an API key. Deterministic Vireon engines remain available where implemented.

## Diagnostics

Use:

```bash
npm run models:diagnose
```

The command reports configured providers, missing keys, model identifiers, capability registration, health, policy version and blocked task classes. It must not print API keys or raw prompts.

## Live Evaluation Pilot

The first live pilot uses the first explicitly configured and approved provider in rollout order: OpenAI, then Anthropic, then Gemini. This order is sequencing only, not a quality ranking. In v1, the OpenAI adapter is the only live commercial adapter; Anthropic and Gemini remain disabled-safe until separately piloted.

Required non-production live-evaluation variables:

```bash
VIREON_LIVE_MODEL_EVALUATION=true
VIREON_SYNTHETIC_DATA_ONLY=true
VIREON_MODEL_ORCHESTRATOR_MODE=live-evaluation
VIREON_MODEL_EVALUATION_ENVIRONMENT=<non-production-environment>
VIREON_DATA_SOURCE=synthetic
VIREON_LIVE_MODEL_DAILY_BUDGET=<amount>
VIREON_LIVE_MODEL_MAX_RUN_COST=<amount>
VIREON_LIVE_MODEL_MAX_TASK_COST=<amount>
VIREON_LIVE_MODEL_EVALUATION_FIXTURE_LIMIT=12
VIREON_LIVE_MODEL_MAX_RETRIES=<count>
VIREON_LIVE_MODEL_MAX_OUTPUT_TOKENS=<tokens>
```

Run:

```bash
npm run models:evaluate:live:preflight
npm run models:evaluate:live -- --provider=openai --model=<configured-model> --fixture-limit=12 --budget-confirmed=true
```

The commands redact credentials and refuse to run if prompt logging or raw response storage is enabled.

2026-07-22 live-pilot note: OpenAI `gpt-5.2` was configured in-process for `local-pilot` with `financial-sensitive` approved for the synthetic subset. The bounded run completed 12 requests for `$0.026858`; it did not enable Anthropic or Gemini, did not store raw prompts/responses and did not promote the model.
