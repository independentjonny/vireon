# Model Routing Policy

Policy version: `model-routing-policy-v1`.

The router is deterministic. It never asks a model which model should be used.

## Routing Order

1. Safety and policy eligibility.
2. Deterministic-engine requirement.
3. Sensitivity and provider approval.
4. Required capabilities.
5. Output-schema support.
6. Provider and model health.
7. Provider restrictions from user, organisation or task.
8. Task-specific preferences.
9. Cost limit.
10. Latency target.
11. Fallback eligibility.

The routing result records selected provider/model, score, routing reasons, rejected candidates and fallback candidates.

## Sensitivity

Supported sensitivity levels:

- `public`
- `internal`
- `personal`
- `financial-sensitive`
- `identity-sensitive`
- `highly-restricted`

Provider eligibility is explicit in the registry. Model names do not imply approval.

## Deterministic Priority

`deterministic-calculation` and requests with `deterministicEngineRequired=true` route only to `vireon-deterministic-engines-v1`. If the deterministic engine is unavailable, the task fails safely. It does not fall back to an LLM.

## Fallback

Fallback is allowed only when the task permits fallback, the alternate provider satisfies every required capability and sensitivity rule, cost remains within limits, and no uncertain external side effect has occurred.

Fallback is never allowed from deterministic calculations to an LLM or from an approved sensitive provider to an unapproved provider.

## High-Risk Content

High-risk tax, legal, investment, SMSF, trust, company, lender-policy and regulated-advice tasks must preserve professional-review classification where required. Model output cannot remove professional-review flags.

## Live Evaluation Restrictions

After live runs `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80` and `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7`, the configured OpenAI `gpt-5.2` setup remains evaluation-only.

Active task restrictions:

- `document-extraction`: restricted
- `financial-synthesis`: restricted
- `timeline-explanation`: evaluation with mandatory review
- `verification-review`: restricted
- `scenario-explanation`: evaluation only
- `deterministic-calculation`: ineligible
- full-suite expansion is blocked
- automatic promotion is disabled

These restrictions do not permit LLM deterministic calculations, realised-impact mutation, evidence approval or audit/timeline history mutation.
