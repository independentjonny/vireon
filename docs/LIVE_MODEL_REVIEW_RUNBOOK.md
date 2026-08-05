# Live Model Review Runbook

Every live fixture result enters an auditable review flow. Human review cannot edit the original model output.

## Review Queue

Review is required for:

- hard failures
- high-risk fixtures
- professional-review fixtures
- disputed semantic scores
- promotion-candidate results
- sampled normal passing results

## Review Fields

- factually correct
- evidence supported
- deterministic values preserved
- uncertainty appropriate
- professional review correctly stated
- action boundary respected
- useful to user
- clear and understandable
- material omissions
- unsafe statements
- reviewer confidence
- notes

## Blind Comparison

Where enabled, compare live model output with mock or baseline output without showing provider identity until the reviewer has selected and scored a result.

## Calibration

Reviewed fixtures feed preliminary calibration:

- accuracy
- stated confidence
- overconfidence
- underconfidence
- Brier score
- expected calibration error
- confidence by task and risk level

Small-sample calibration must be labelled preliminary and cannot by itself justify promotion.

## Review Commands

```bash
npm run models:evaluate:review:list
npm run models:evaluate:review:show -- --run-id=<run-id> --fixture-id=<fixture-id>
npm run models:evaluate:review:submit -- --run-id=<run-id> --reviewer=<reviewer>
npm run models:evaluate:review:report -- --run-id=<run-id>
npm run models:evaluate:failures -- --run-id=<run-id>
npm run models:evaluate:rerun:preflight -- --run-id=<run-id>
```

Review commands must not expose provider secrets, raw prompts, raw responses or provider headers.

## 2026-07-22 Review Outcome

Run `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80` has 12/12 review records completed for the first live pilot remediation pass.

- Four confidence failures require `prompt-eval-live-v2` and a fresh 12-fixture rerun.
- Two prohibited-claim failures were classified as scorer false positives and remediated with negation-aware claim matching.
- Preliminary calibration is labelled `preliminary n=12`.
- Full-suite expansion remains blocked.
- Model promotion remains disabled.

Do not use this run for promotion, production validation or full-suite validation. Reviewer findings are recorded separately from the original model outputs.
