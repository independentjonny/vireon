# AI Confidence Policy

Artifact:

`.vireon/model-evaluation/analysis/confidence-policy-v3-audit.json`

Confidence must not be a free model-selected number. Vireon separates:

- evidence completeness
- evidence consistency
- calculation certainty
- model interpretation confidence
- recommendation confidence
- user-facing uncertainty

## Deterministic Ceiling

The maximum permitted confidence is capped by:

- missing required evidence
- conflicting evidence
- stale evidence
- estimated values
- professional-review requirement
- unsupported assumptions
- task risk level

Examples:

- missing required evidence caps confidence at `0.65`
- conflicting evidence caps confidence at `0.55`
- critical risk caps confidence at `0.65`
- professional-review-required output caps confidence at `0.70`

The model may only emit a value at or below the deterministic ceiling.

## Task Policy

- Document extraction: hybrid field-level confidence.
- Deterministic explanation: inherit deterministic calculation status; no free-form model confidence.
- Missing-evidence detection: deterministic completeness classification.
- High-risk recommendation: evidence strength and professional-review status, not a single global confidence.
- User-facing summary: uncertainty wording derived from structured facts.

Rerun v2 shows the old single-confidence contract is insufficient.
