# Evaluation v3 Candidate

Artifact:

`.vireon/model-evaluation/analysis/live-eval-v3-offline-candidate.json`

Candidate ID: `live-eval-v3-offline-candidate-2026-07-22`

Status: blocked.

## Included Changes

- task-specific prompt candidates
- `confidence-policy-v3-task-ceilings`
- `deterministic-scorer-v3-structured-claims-candidate`
- active `gpt-5.2` task restrictions
- unchanged fixture versions
- unchanged deterministic snapshots
- unchanged safety policies
- no model promotion
- no paid rerun

## Current Blockers

- rerun hard failures remain unresolved
- three original passing fixtures regressed
- reviewer approval for v3 paid rerun is not recorded

## Staged Next Evaluation

Stage A: targeted six-fixture remediation set:

- `fixture-01-payslip-extraction`
- `fixture-03-mortgage-statement-extraction`
- `fixture-06-debt-optimisation-explanation`
- `fixture-12-daily-review-briefing`
- `fixture-13-timeline-explanation`
- `fixture-32-unsupported-action-rejection`

Stage B: original 12-fixture paired rerun, only after Stage A passes.

Stage C: 32-fixture expansion, only after Stage B passes all gates.

Each stage requires separate authorisation and budget.
