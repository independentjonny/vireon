# Model Evaluation

Model promotion is evidence-based. Text quality alone is not sufficient.

## Promotion States

- `unconfigured`
- `experimental`
- `evaluation`
- `approved`
- `preferred`
- `deprecated`
- `disabled`

A model may become approved only after capability registration, health checks, synthetic evaluation, schema validation, privacy classification, cost review and regression tests.

## Fixture Areas

Golden synthetic fixtures should cover:

- payslip extraction
- bank statement classification
- mortgage comparison explanation
- structure recommendation critique
- workflow plan generation
- Daily Review briefing
- Timeline explanation
- missing-evidence detection

## Evaluation Metrics

- schema validity
- evidence citation accuracy
- unsupported-claim rate
- deterministic-output fidelity
- task completion
- confidence calibration
- latency
- cost
- refusal correctness
- privacy-policy compliance

## Safety Rules

Evaluations cannot promote a model into a sensitivity level that policy has not approved. Evaluation results may tune preferences within policy, but they cannot weaken deterministic, professional-review, evidence or privacy guardrails.

## Evaluation & Trust Framework v1

The implemented framework lives in `src/lib/modelEvaluation/` and runs all model evaluations through the Model Orchestrator. It provides synthetic fixtures, deterministic scorers, claim analysis, calibration reports, regression baselines, promotion gates, human-review records and a Developer Mode `/model-evaluation` workspace.

CLI commands:

```bash
npm run models:evaluate
npm run models:evaluate:mock
npm run models:evaluate:regression
npm run models:evaluate:report
npm run models:evaluate:promote
npm run models:evaluate:calibration
npm run models:evaluate:live:preflight
npm run models:evaluate:live -- --provider=openai --model=<configured-model> --fixture-limit=12 --budget-confirmed=true
```

Default commands do not make paid provider calls. Live-provider evaluation requires `VIREON_LIVE_MODEL_EVALUATION=true` and an explicit live execution mode.

Live Model Evaluation Pilot v1 adds a bounded synthetic 12-fixture subset, strict budget preflight, final outbound synthetic-data inspection, OpenAI live adapter support, live human-review queue generation, preliminary calibration from reviewed results and Developer Mode live status. It does not automatically promote a model and does not claim full-suite validation from a partial fixture set.

2026-07-22 execution result: run `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80` completed the 12-fixture OpenAI subset with 6 passed, 6 failed, hard failures 6, actual cost `$0.026858`, no halt, no expansion eligibility and no promotion. Human review remains pending, so calibration sample size is 0 and model quality is not approved.

See:

- `docs/EVALUATION_TRUST_FRAMEWORK.md`
- `docs/EVALUATION_FIXTURES.md`
- `docs/MODEL_PROMOTION_POLICY.md`
- `docs/AI_CONFIDENCE_CALIBRATION.md`
- `docs/HUMAN_MODEL_REVIEW.md`
- `docs/LIVE_MODEL_EVALUATION_PILOT.md`
- `docs/LIVE_MODEL_COST_CONTROLS.md`
- `docs/LIVE_MODEL_REVIEW_RUNBOOK.md`
