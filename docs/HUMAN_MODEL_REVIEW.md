# Human Model Review

Human review is required for promotion-critical evaluations and high-risk model changes.

## Review Fields

Reviews capture:

- correctness
- evidence use
- usefulness
- clarity
- risk disclosure
- professional-review handling
- unsafe content
- missing content
- preferred output
- reviewer notes
- reviewer confidence

## Blind Review

Where blind review is enabled, one reviewer's decision is not shown to another reviewer until the blind comparison is complete.

## Auditability

Human reviews are immutable records. Corrections create superseding reviews or decisions rather than editing prior review history.

## Live Evaluation Pilot

Live synthetic evaluation queues every fixture result for review visibility. Review is required for hard failures, high-risk fixtures, professional-review fixtures, disputed semantic scores, promotion-candidate results and sampled normal passing results.

The review queue records corrections separately. The original model output, routing decision, scores, cost and validation failures remain immutable.

## Rerun v2 Review Status

Original run `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80` has 12/12 review records completed.

Rerun v2 `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7` has 12/12 human-review records completed. The review outcome is `remediate and rerun 12 fixtures`; expansion remains blocked and model promotion remains disabled.

## Limits

Human review can approve promotion within policy. It cannot weaken sensitivity policy, deterministic calculation authority, professional-review requirements or evidence requirements.
