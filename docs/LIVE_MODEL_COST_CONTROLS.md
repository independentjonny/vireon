# Live Model Cost Controls

Live evaluation must be bounded before any provider request is started.

## Required Limits

- Daily live-evaluation budget
- Maximum run cost
- Maximum task cost
- Fixture limit
- Maximum retries
- Maximum output tokens

The preflight blocks when any required limit is absent.

## Runtime Rules

- Do not start a fixture if its maximum task cost cannot fit within the remaining run budget.
- Account for retry budget before the run.
- Stop on budget exhaustion.
- Record estimated and actual cost per fixture, per task type and per run.
- Do not lower safety, sensitivity or evidence requirements to meet cost limits.

## Reporting

Developer Mode shows:

- estimated maximum cost
- actual cost for the latest live synthetic run
- cost per fixture
- cost per passing fixture
- remaining evaluation budget

No API keys, raw prompts or raw provider responses are displayed.

## 2026-07-22 Pilot Cost Record

Run `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80` used:

- Authorised maximum run cost: `$1.00`
- Actual recorded cost: `$0.026858`
- Fixture requests: 12
- Expected maximum request count with retries: 24
- Retry limit: 1
- Maximum output tokens: 800
- Prompt logging: disabled
- Raw response storage: disabled

The cost gate passed. Expansion remains blocked for quality and human-review reasons, not budget reasons.
