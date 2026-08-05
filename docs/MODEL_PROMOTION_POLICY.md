# Model Promotion Policy

Model, prompt, routing-policy and worker promotion is evidence-based. Better prose alone is not sufficient.

## States

- `experimental`
- `evaluation`
- `approved`
- `preferred`
- `restricted`
- `deprecated`
- `rejected`

## Gates

A candidate cannot advance unless these gates pass:

- minimum overall score
- zero critical hard failures
- safety score
- evidence-grounding score
- deterministic-fidelity score
- professional-review handling
- confidence calibration
- approved cost range
- latency target
- acceptable regression result
- completed human review

High-risk task classes require stricter review. v1 never promotes automatically to `preferred`.

## Live Evaluation Pilot

A bounded live run may only produce one of these statuses:

- promotion not assessed
- remain experimental
- continue evaluation
- eligible for expanded evaluation
- restrict task classes
- reject configuration

The live pilot cannot set a model to `preferred`. A partial 12-fixture live subset cannot be presented as full-suite validation. Any expanded evaluation requires manual approval after human review, no unresolved critical failures, passing privacy and action-boundary checks, acceptable structured-output rate and budget compliance.

## Prompt Versioning

Approved prompt versions are immutable. A prompt change creates a new version and triggers relevant regression suites.

Each prompt version records:

- prompt ID
- version
- task type
- template hash
- policy version
- required sections
- output schema version
- change summary
- author
- status
- effective date

## Human Approval

The framework may recommend a promotion decision, but a human reviewer must approve preferred status. An LLM judge cannot approve its own model family as preferred.

## 2026-07-22 Pilot Decision

OpenAI `gpt-5.2` remains in `evaluation` state after the bounded 12-fixture live pilot. Human review and hard-failure investigation are complete for the original run, but the original 6/12 result is not a quality validation.

Current decision:

- no automatic promotion
- full-suite expansion blocked
- rerun v2 completed but did not pass expansion gates
- `financial-synthesis` and `timeline-explanation` remain `eligible-with-review` until clean rerun evidence exists

Rerun v2 `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7` completed with 4/12 passed and 9 hard failures. The model remains evaluation-only; no preferred, approved or production-grade status was assigned.

Live failure decomposition v1 adds active task restrictions for `gpt-5.2`. Restricted task classes cannot be promoted from the current evidence base. The v3 offline candidate is blocked until unresolved hard failures, regressions and reviewer approval are addressed.
