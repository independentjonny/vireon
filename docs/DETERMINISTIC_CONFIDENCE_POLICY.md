# Deterministic Confidence Policy

Confidence is no longer treated as a free model self-assessment.

Audit artifact:

`.vireon/model-evaluation/analysis/deterministic-confidence-policy-v3.json`

## Task Policies

Document extraction:

- confidence source: field-level deterministic or hybrid confidence
- inputs: evidence presence, ambiguity and extraction consistency
- model confidence: permitted only within deterministic field-level bounds

Financial synthesis:

- confidence source: deterministic evidence-strength classification
- model confidence: not permitted as a single numeric certainty

Deterministic explanation:

- confidence source: calculation status
- model confidence: not permitted

Missing-evidence detection:

- confidence source: deterministic completeness score
- model confidence: not permitted

High-risk recommendation:

- confidence source: evidence strength plus mandatory-review state
- model confidence: not presented as certainty

Timeline and Daily Review:

- confidence source: structured certainty by claim source
- categories: observed fact, calculated conclusion and inferred narrative

## Invariants

Local validation enforces:

- model confidence cannot exceed deterministic ceiling
- missing evidence lowers the ceiling
- conflicting evidence lowers the ceiling
- stale evidence lowers the ceiling
- estimated values lower calculation certainty
- professional-review requirement cannot be removed by high confidence
- unsupported claims cannot carry high confidence
- deterministic results retain deterministic classification
- user-facing wording must match structured certainty

Current status: all offline invariants pass.
