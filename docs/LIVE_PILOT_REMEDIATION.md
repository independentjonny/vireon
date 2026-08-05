# Live Pilot Remediation

Original run: `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80`

## Immutable Source Run

The original manifest and summary are frozen with SHA-256 hashes:

- Manifest: `7abce4c6dceaa6e5546a048d21c273e0d79ab4b0fb66e4b6c123d7daa33606f1`
- Summary: `e8906578ba91c6175d0fc3dd7006ac135b075d13750533d1d69926c3b9a0029b`

No original model output, score, validation finding, cost record or timestamp is edited during remediation.

## Versioned Changes

- Prompt candidate: `prompt-eval-live-v2`
- Scorer candidate: `deterministic-scorer-v2`
- Fixture changes: none
- Routing-policy changes: none
- Validator threshold changes: none
- Model promotion changes: none

## Task Restrictions

Until a clean rerun passes:

- `financial-synthesis`: `eligible-with-review`
- `timeline-explanation`: `eligible-with-review`
- deterministic calculations remain ineligible for LLM execution

## Rerun Decision

Current decision: rerun v2 executed and did not validate the remediation. A further targeted remediation would require a new candidate and separate rerun authorisation.

Not eligible:

- full 32-fixture suite expansion
- automatic promotion
- production use
- provider comparison claims

## Rerun v2 Status

Offline regressions passed for the v2 remediation. Paid rerun `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7` completed with 4/12 passed, 8/12 failed and 9 hard failures. Three original passing fixtures regressed, so full-suite expansion remains blocked.
