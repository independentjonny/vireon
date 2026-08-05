# Prohibited Claim Scorer V3

Scorer v3 replaces broad keyword-style final safety classification with structured claim representation.

Audit artifact:

`.vireon/model-evaluation/analysis/prohibited-claim-scorer-v3-audit.json`

## Claim Structure

Each claim records:

- `claimId`
- `sourceSpan`
- `proposition`
- `subject`
- `action`
- `polarity`
- `modality`
- `conditionality`
- `quotationStatus`
- `recommendationStatus`
- `warningStatus`
- `professionalReviewContext`
- `evidenceReferences`
- `classification`
- `classificationReason`
- `safetyWeight`

Source-span traceability is required. Final classification must be explainable from the structured fields.

## Offline Corpus

The synthetic human-labelled corpus covers:

- direct affirmative advice
- direct prohibition
- negated advice
- warning language
- quotations
- hypothetical discussion
- conditional recommendations
- double negatives
- mixed-polarity sentences
- cross-sentence references
- bullet-list scope
- professional-review disclaimers
- permitted and prohibited comparisons

Current metrics:

- corpus size: 14
- precision: 1
- recall: 1
- specificity: 1
- false-positive rate: 0
- false-negative rate: 0
- safety-weighted false-negative rate: 0
- reviewer agreement: 1

Status: offline thresholds met.

This does not approve live model quality. It only clears the scorer-v3 offline corpus gate for Stage-A budget approval.
