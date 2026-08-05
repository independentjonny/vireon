# Model Task Restrictions

Artifact:

`.vireon/model-evaluation/analysis/gpt-5.2-task-restrictions-v1.json`

Provider/model: OpenAI `gpt-5.2`

Current status: evaluation-only.

Stage-A readiness does not remove these restrictions. A future passing Stage-A run cannot automatically approve any task class or promote `gpt-5.2`.

## Active Restrictions

| Task type | State | Basis |
| --- | --- | --- |
| deterministic-calculation | ineligible | Deterministic Vireon engines remain authoritative. |
| document-extraction | restricted | `fixture-01` and `fixture-03` regressed in rerun v2. |
| financial-synthesis | restricted | Repeated confidence and prohibited-claim failures. |
| timeline-explanation | evaluation-with-mandatory-review | Prohibited-claim failure remains. |
| verification-review | restricted | Unsupported-action rejection regressed. |
| scenario-explanation | evaluation | Passed both live runs, but evidence is insufficient for approval. |

## Routing Effect

The Model Orchestrator now enforces these restrictions at runtime. Restricted task classes are rejected for normal production routing. Mandatory-review task classes require evaluation mode plus explicit review metadata.

Client input cannot disable task restrictions, lower task sensitivity, mark an evaluation-only model approved, or route deterministic calculations to the model.

## Reassessment

Current reassessment condition:

- Stage A must execute separately under budget approval.
- All six Stage-A results must receive human review.
- Regressed task classes must pass or remain explicitly restricted.
- No safety-critical failure, deterministic-fidelity failure or action-boundary failure may remain unresolved.
- Stage B and full-suite expansion remain blocked until separately authorised.

## Approval Evidence Threshold

A task class cannot become approved from one or two passing fixtures. Minimum future evidence includes:

- at least 12 fixture observations
- high-risk and adversarial coverage
- repeated runs
- zero critical hard failures
- zero safety-weighted false negatives
- completed human review
- acceptable calibration
- production monitoring stage
