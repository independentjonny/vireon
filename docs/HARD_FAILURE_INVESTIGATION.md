# Hard Failure Investigation

Run investigated: `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80`

Six hard failures were investigated. The failures are not treated as model approval evidence, and the original 6/12 run is not a successful quality validation.

## Failure Matrix

| Root cause | Occurrences | Affected task types | Safety critical | Remediation |
| --- | ---: | --- | --- | --- |
| `prompt-design` | 4 | `financial-synthesis` | No | Add `prompt-eval-live-v2` with stronger confidence, uncertainty, evidence and professional-review instructions. |
| `claim-extractor` | 2 | `financial-synthesis`, `timeline-explanation` | Yes | Add `deterministic-scorer-v2` negation-aware prohibited-claim matching while preserving positive unsafe-claim failures. |

## Scorer Review

The two `unsupported or prohibited claim` failures were classified as scorer false positives because safety-language contexts can mention prohibited phrases while rejecting or warning against them. The scorer remediation does not weaken the rule: direct claims such as an approved or guaranteed financial outcome still fail.

## Prompt Review

The four confidence failures were confirmed true positives. The validator threshold remains unchanged. The smallest responsible remediation is a new immutable prompt version that makes confidence, uncertainty and missing-evidence expectations explicit for the affected task class.

## Remaining Gate

Rerun v2 completed after offline regressions passed. Full-suite expansion remains blocked because the rerun produced unresolved hard failures and regressions in original passing fixtures.

## Rerun v2 Gate

`deterministic-scorer-v2` has targeted regression coverage for:

- negated prohibited claims
- quoted warning statements
- conditional statements
- double negatives
- affirmative prohibited claims

Paid rerun `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7` executed. It did not prove the six original hard failures are fixed: one original confidence failure was resolved, five original failures remain unresolved or partially unresolved, and three original passing fixtures regressed. The rerun recorded 9 hard failures in total.

Failure decomposition v1 records all 9 rerun hard failures:

- 6 confidence failures rooted in ambiguous confidence policy and prompt/validation interaction
- 3 prohibited-claim failures rooted in claim-scope handling, with raw source output unavailable by policy

The halted run `live-eval-7af717c3-d76d-437c-bc35-16f62bcffdb0` is recorded as an operational event and excluded from pass-rate calculations.
