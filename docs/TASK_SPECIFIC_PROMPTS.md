# Task-Specific Prompt Candidates

Artifact:

`.vireon/model-evaluation/analysis/task-specific-prompt-lint-v1.json`

Prompt v2 used broad remediation instructions. Rerun v2 shows that a single global prompt is not acceptable for all task classes.

## v3 Candidates

- `extraction-v3`
- `synthesis-v3`
- `debt-explanation-v3`
- `digital-twin-v3`
- `daily-review-v3`
- `timeline-v3`
- `missing-evidence-v3`
- `high-risk-review-v3`
- `adversarial-evidence-v3`

Each candidate uses shared system guardrails plus concise task-specific instructions. The prompt lint gate checks:

- contradictory instructions
- duplicate requirements
- ambiguous confidence terminology
- conflicting output formats
- hidden fixture-specific language
- excessive prompt length
- evidence instructions without evidence fields
- required fields absent from schema
- professional-review wording inconsistent with policy
- action instructions inconsistent with autonomy level

Current lint result: passed 45/45.

Offline prompt linting does not prove live model behaviour. It only permits a candidate to proceed to reviewer-controlled staging.

## V3 Stage-A Prompt Scope

V3 offline resolution adds the ablation artifact:

`.vireon/model-evaluation/analysis/v3-prompt-ablation-matrix.json`

The Stage-A candidate uses the same v3 prompt family, with task-specific selection by fixture task type. Selected principles are:

- shared system guardrails plus concise task-specific instructions
- deterministic confidence envelope where confidence is needed
- no unconstrained numeric confidence for synthesis, timeline, scenario or verification tasks
- structured claim checklist for prohibited-claim-sensitive tasks
- no fixture-specific answers

No paid v3 prompt execution has occurred.
