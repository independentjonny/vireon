# Live Evaluation Failure Decomposition

Source runs:

- Original: `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80`
- Rerun v2: `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7`
- Halted operational event: `live-eval-7af717c3-d76d-437c-bc35-16f62bcffdb0`

The halted run is preserved as operational evidence only. It is excluded from model-quality pass-rate calculations.

Machine-readable artifact:

`.vireon/model-evaluation/analysis/live-failure-decomposition-v1.json`

## Transition Matrix

- Fixed: 1
- Unchanged pass: 3
- Unchanged fail: 5
- Regressed: 3

Key fixtures:

- `fixture-04-financial-position-synthesis`: fixed
- `fixture-01-payslip-extraction`: regressed
- `fixture-03-mortgage-statement-extraction`: regressed
- `fixture-32-unsupported-action-rejection`: regressed
- `fixture-07-mortgage-comparison`: unchanged pass
- `fixture-11-digital-twin-scenario-explanation`: unchanged pass
- `fixture-30-evidence-completeness-detection`: unchanged pass

## Failure Layers

The analysis separates:

1. Raw normalised model output: not persisted by policy.
2. Deterministic structural validation.
3. Claim extraction and prohibited-claim analysis.
4. Aggregate evaluation result.

Because raw provider responses were not stored, model-output conclusions are limited to persisted normalised summary metadata, validation outcomes and human-review records.

## Conclusion

`prompt-eval-live-v2` and `deterministic-scorer-v2` did not validate remediation. The rerun worsened the paired result and requires redesign before further paid testing.

## V3 Offline Resolution

V3 offline resolution preserves the v2 conclusion and adds these artifacts:

- `.vireon/model-evaluation/analysis/v3-offline-resolution-baseline-hashes-v1.json`
- `.vireon/model-evaluation/analysis/v3-rerun-hard-failure-resolution-v1.json`
- `.vireon/model-evaluation/analysis/v3-regression-causal-traces-v1.json`
- `.vireon/model-evaluation/analysis/prohibited-claim-scorer-v3-audit.json`
- `.vireon/model-evaluation/analysis/deterministic-confidence-policy-v3.json`
- `.vireon/model-evaluation/analysis/v3-stage-a-candidate-manifest.json`
- `.vireon/model-evaluation/analysis/v3-stage-a-preflight-v1.json`

Current v3 state:

`READY FOR BUDGET APPROVAL`

This means the offline design is ready for separate budget approval. It does not authorise a paid provider call.
