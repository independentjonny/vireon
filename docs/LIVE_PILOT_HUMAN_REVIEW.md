# Live Pilot Human Review

Run reviewed: `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80`

Status: all 12 synthetic live results have review records. The original run artifacts, provider outputs as persisted, routing decisions, validation scores, cost records and timestamps remain immutable.

## Review Controls

- Reviewer recorded as `codex-reviewer` for the local pilot remediation pass.
- Same known provider/model was used for every fixture, so this run has no provider-comparison validity.
- Automated score, pass/fail and ground truth were already available in the persisted summary; blind-review controls are recorded as unavailable for this run.
- Reviewer notes, dispositions and suggested corrections are stored separately from the source result.
- No raw prompts, raw responses, API keys or provider headers are stored in review artifacts.

## Review Outcome

- Results reviewed: 12/12
- Passed execution fixtures: 6
- Failed execution fixtures: 6
- Dispositions:
  - `accept`: passing fixtures without material warnings
  - `accept-with-warning`: passing fixture with non-critical warning
  - `prompt-remediation`: four confidence hard failures
  - `scorer-remediation`: two prohibited-claim false positives
- Promotion status: disabled
- Expansion status: blocked

## Artifacts

Review artifacts are under `.vireon/model-evaluation/reviews/` and include:

- integrity hashes
- review work products
- hard-failure investigations
- preliminary calibration
- rerun candidate manifest
- aggregate review report

Canonical artifacts may be regenerated for display, while versioned `live-human-review-v1` copies preserve the reviewed record version.
