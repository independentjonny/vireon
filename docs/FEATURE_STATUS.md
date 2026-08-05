# Feature Status

This file tracks product capability status at a high level. Update it when major capabilities move.

## Complete

- Vireon product naming on core visible surfaces.
- Master product vision.
- Platform roadmap.
- AI agent product rules.
- My AI CFO route placeholder.
- Financial Vault and housing scenario foundations.
- Existing dashboard, navigation, and financial workspaces.
- AI CFO Daily Review v1 deterministic engine, route, API, Dashboard card, AI CFO card, Decision Centre card, empty-state handling, partial-failure handling, and regression tests.
- Action Workflows v1 engine, route, API, workflow persistence, Decision Centre start-workflow link, status transitions, blockers, professional-review flags, evidence, audit trail, and regression tests.
- Workflow Execution and Outcome Verification v1 execution model, versioned templates, separate execution/outcome states, outcome verification checks, immutable evidence statuses, user-attestation guardrails, artefacts, communications model, next-best-action selection, affected-engine tracking, Decision Centre linkage metadata, Daily Review deduplication keys, timeline milestone IDs, route/API/UI updates, Dashboard realised-progress protection, and regression tests.
- Stabilise Project Validation v1: canonical `npm run validate`, standalone TypeScript validation, local Node test runner alias loader, bounded Neven stages, Neven progress/timing output, timeout last-stage reporting, non-zero incomplete validation exits, and child-process cleanup.
- Fix Neven Supervisor Remediation Timeout v1: root-cause diagnosis, bounded remediation substages, atomic validation lock, stale-lock recovery, concurrent-run prevention, `npm run neven:diagnose`, fail-fast browser/app issue classification, hydration-stable Developer Mode state, and remediation guard regression tests.
- Polish Daily Review Design v1: calm first-viewport briefing hierarchy, deterministic featured-finding selection, maximum three priority action cards, lightweight financial wins, collapsed System Health, partial/empty state handling, deterministic date formatting, and presentation regression tests.
- Dashboard Financial Briefing redesign v1: Dashboard command-centre hierarchy, deterministic hero/top-priority selection, current-position strip, active-workflow precedence, capped secondary actions, verified financial progress, compact Daily Review routing, AI CFO entry point, contextual workspace navigation, mobile ordering, and updated smoke coverage.
- Optimise Dashboard Density and Remove Duplication v1: single briefing hero, compact current-position strip with sparkline, stable source-ID duplicate suppression, one primary workflow surface, lightweight secondary actions, compact Daily Review row, capped AI CFO prompts, capped contextual workspace links, mobile action ordering, and density regression tests.
- Financial Timeline and Explainability v1: immutable financial timeline event model, deterministic event aggregation from Vault, Balance Sheet, Decision Centre, Action Workflows, Daily Review, Digital Twin and tax-rule provenance, compare-dates engine, recommendation explanations, metric-cause explanations, counterfactual summaries, milestone detection, yearly Financial Journey summaries, `/timeline` views and regression tests.
- Production Data Integrity and Readiness v1: persistence audit, canonical data ownership manual, PostgreSQL target migration, production repository contract layer, user-isolation guardrails, idempotency, optimistic concurrency, transaction rollback, append-only audit events, calculation snapshot integrity, demo/live separation, safe export/deletion boundaries, background job model, production configuration validation, Developer Mode Production Readiness page, and regression tests.
- PostgreSQL Pilot v1: Supabase PostgreSQL migration safety platform, target validation, restricted `vireon_app` runtime-role provisioning, bootstrap, execution preflight, migration execution, schema_migrations verification, runtime grant reconciliation, post-migration restricted-role verification, public-schema-only backup, managed-schema protection, disposable restore rehearsal, bounded authentication propagation retry, rollback check and operator runbook. Status is complete and frozen; future work is limited to bug fixes, PostgreSQL upgrades, Supabase compatibility and security fixes.
- PostgreSQL Phase 2 Slice 2 Financial Vault persistence: active `/api/financial-vault` and `/api/financial-vault/imports` routes now use the restricted PostgreSQL runtime for document metadata, extraction state, import lifecycle, evidence links, confirmed facts, append-only fact versions and idempotency. The Financial Vault UI loads through the converted APIs with no route-level `.ai/local-data` or manual-platform JSON fallback.
- PostgreSQL Phase 2 Slice 3 Financial read model: dashboard, status, housing, forecast, goals, private-beta briefing/export, AI CFO input and Daily Review generation paths now use the PostgreSQL-backed Financial Vault read model for confirmed facts, provenance, confidence and freshness. Retired active imports of `financialVaultStore` and `manualFinancialDataRepository` were removed.
- PostgreSQL Phase 2 core decisioning domains: Digital Twin, Decision Centre, Action Workflows, AI CFO history, Daily Review history and Goals now persist active route/UI state through PostgreSQL using the restricted runtime role. Active imports of the retired domain local stores are blocked by production integrity checks. This is not wider application-persistence completion; excluded domains remain tracked separately.
- PostgreSQL application transactions and subscriptions persistence: active import, transaction, subscription, dashboard-metric, finance-health, merchant-intelligence, workflow-status and transaction-aware Copilot routes now use `user_transaction_imports`, `user_transactions` and `user_subscriptions` through the restricted PostgreSQL runtime. Active `.ai/local-data` transaction/import/subscription fallback is retired for these flows.
- PostgreSQL Housing scenario persistence: active `/api/housing-scenarios`, `/housing-scenarios`, dashboard, insights, status and AI CFO context paths use PostgreSQL `timeline_events` and `calculation_snapshots` through `coreDecisioningPostgresService`; `.ai/local-data/housing-affordability.json` is legacy test/demo state only.
- Autonomous Operations v1: read-only autonomous financial operator layer, first-class goal model, deterministic planning, opportunity scanner, approval-gated task queue, specialised worker registry, supervisor state, bounded context builder, verification classification, learning metrics, scheduled review model, event triggers, executive briefing, knowledge-health scoring, Developer Mode diagnostics page, API endpoint and regression tests.
- Model Orchestrator v1: provider-neutral model task/result contracts, deterministic routing policy, explicit provider capability registry, sensitivity guardrails, structured-output validation, budget controls, circuit breakers, run/audit repository, deterministic/mock adapters, disabled-safe commercial adapter stubs, AI CFO and Autonomous Operations request boundaries, Developer Mode workspace, API routes and regression tests.
- Evaluation & Trust Framework v1: provider-neutral evaluation model, synthetic fixture suites, deterministic scorers, claim analysis, evidence-grounding checks, deterministic-fidelity checks, confidence calibration, regression baselines, promotion gates, immutable prompt-version guardrails, human-review records, local evaluation repository, CLI commands, Developer Mode workspace, API routes and regression tests.
- Live Model Evaluation Pilot v1 implementation: OpenAI live adapter boundary, redacted live preflight, bounded 12-fixture synthetic subset, cost and fixture gates, runtime halt reasons, no-automatic-promotion guardrails, human-review queue modelling, Developer Mode live status, CLI commands and regression tests are implemented locally.

## In Progress

- Private Beta Foundation v1: deterministic private-beta onboarding, first-value briefing, provenance, freshness, export, deletion request, feedback, feature flags and readiness controls are implemented without Open Banking or live AI. `PRIVATE_BETA` mode blocks local JSON financial persistence and requires database configuration before deployment.
- Private Beta Access Approval v1: public request-access is generic and manually reviewed, protected operators use `manage:private_beta_access`, and approval issues one expiring email-bound invitation without persisting raw tokens. See `docs/PRIVATE_BETA_ACCESS_APPROVAL.md`.
- Beta Hardening & User Validation v1: launch gate, privacy-safe analytics, funnel metrics, deterministic golden fixtures, cross-engine consistency checks, reusable explainability, claims policy, recovery references, performance baseline, security review, cohort controls and user-validation documentation are implemented. Live AI and Open Banking remain disabled.
- Manual Financial Data Platform v1: provider-neutral ingestion and provenance records, canonical confirmed financial records, private user-owned file storage with hashing/duplicates/deletion/audit, staged CSV preview/mapping/review/confirmation/rollback, OFX/QFX/QIF parsers, import review workspace, manual record creation and history, confirmed-only idempotent Digital Twin sync hashes, deterministic decisions, grounded AI CFO context, refresh/staleness/overlap controls, manual first-value onboarding and synthetic Australian fixtures are implemented. Active transaction/import/subscription APIs are PostgreSQL-backed; Open Banking is an inactive optional connector and fully wired review-mutation/product workflows remain release blockers.
- Private Beta Product Upgrade Program v1: Financial Vault completeness and staleness prioritisation, deterministic Digital Twin downside stresses, verification-aware AI CFO workflows, read-only Adviser Workspace, gated beta onboarding, measurable web/API performance budgets, security headers/CSRF/rate limiting, and non-averaged private-beta release gates are implemented with regression coverage. Live third-party contracts, production authentication/persistence, operational ownership and measured deployment evidence remain external launch blockers.
- Financial Document Ingestion v1: Financial Vault uploads now validate 10 MB file limits and real file signatures, parse structured CSV bank statements, extract supported PDF text layers, feed payslip/tax-return/mortgage/super text into deterministic Vault extraction, retain source metadata and warnings, and route scanned PDFs to review instead of claiming successful extraction. Production OCR, encrypted object storage, malware scanning and authenticated user-scoped persistence remain required before external beta.
- Production Open Banking integration v1: provider-neutral consent and adapter boundary, OAuth state/PKCE controls, token-vault references, user-isolated connection/account/transaction records, cursor-based idempotent sync, normalized signed transactions, evidence references, revocation and fail-closed production readiness checks are implemented. A live provider contract, credentials, encrypted token vault, signed webhooks and authenticated API/UI flow remain required before external beta.
- AI Decision Centre moving toward Decision Engine 2.0.
- Vault-grounded My AI CFO.
- Housing and borrowing intelligence refinements beyond persisted scenario/report history.
- Financial Health and recommendations.
- Local-first document and finance data foundations.
- Live Model Evaluation Pilot v1 execution: bounded OpenAI execution completed against `gpt-5.2` using 12 synthetic fixtures. Human review and six hard-failure investigations are complete for the original run; remediation is versioned, expansion remains blocked and no model promotion occurred.
- Live Model Evaluation Rerun v2: paid paired rerun `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7` completed against OpenAI `gpt-5.2` with the same 12 synthetic fixtures, `prompt-eval-live-v2` and `deterministic-scorer-v2`. Result: 4/12 passed, 8/12 failed, hard failures 9, cost `$0.009415`, human reviews 12/12. Expansion remains blocked and the model remains evaluation-only.
- Live Evaluation Failure Decomposition v1: offline decomposition is implemented for original, rerun and halted runs. Artifacts record 1 fixed fixture, 3 unchanged passes, 5 unchanged failures and 3 regressions. Prohibited-claim scorer audit uses 11 labelled synthetic cases with precision 1, recall 1 and safety-weighted false-negative rate 0. A deterministic confidence-ceiling policy and task-specific v3 prompt candidates are defined. `gpt-5.2` task restrictions are active; v3 preflight is blocked and no new paid rerun is authorised.
- V3 Offline Resolution and Targeted Stage-A Readiness: all nine rerun hard failures have offline classifications, all three regressions have causal traces, scorer-v3 meets offline prohibited-claim thresholds on 14 labelled synthetic cases, deterministic confidence policy v3 is active, the exact six-fixture Stage-A candidate is defined, and Stage-A preflight reaches `READY FOR BUDGET APPROVAL`. Paid execution, Stage B, full-suite expansion and model promotion remain blocked.
- Stage A Live Validation v1 implementation: `npm run models:evaluate:stage-a` now enforces the approved six-fixture Stage-A subset, OpenAI `gpt-5.2`, `stage-a-task-specific-v3`, `deterministic-scorer-v3-structured-claims-candidate`, explicit budget approval, synthetic-only data, no fallback, no paid judges and all-result human-review queue creation. Run `live-eval-79a12349-4223-4c79-9fec-295e8deaaeb4` reached `READY FOR PAID STAGE-A EXECUTION` and then halted after the first recorded fixture with halt reason `unexpected-provider`; the underlying model task was `budget-blocked` with `BUDGET_EXCEEDED`, cost `$0`, 1/1 recorded review completed, no Stage-B candidate created, model remains evaluation-only and Stage B remains blocked.
- Stage-A Budget and Halt-Reason Remediation v1: the historical halted run remains immutable with recorded halt reason `unexpected-provider`, but a separate correction artifact classifies the analytical cause as `budget-control rejection`. `BUDGET_EXCEEDED` now maps to `budget-exceeded`, provider mismatch requires actual provider evidence, budget-blocked task records are excluded from quality/calibration/scorer metrics, and Stage-A preflight dry-runs all six budget reservations before run creation. A fresh six-fixture execution candidate was prepared with `$0.30` per-task cap, `$1.80` run/daily cap, `$1.38` reserved cost, zero retry reserve and no Stage-B or promotion authority.
- Evaluation Mode Routing and Eligibility Remediation v1: halted Stage-A run `live-eval-41fb5bd5-6bce-4cf0-8b6d-c798f01c8c9d` remains immutable with `requestCount: 0`, `cost: $0`, `haltReason: internal-evaluation-error` and first error `MODEL_NOT_AVAILABLE`. A linked remediation artifact records the corrected analytical cause as evaluation eligibility not being separated from production task restrictions. Explicit execution modes now distinguish `PRODUCTION`, `INTERNAL_EVALUATION`, `OFFLINE_TEST` and `MOCK`; production restrictions remain enforced while approved Stage-A synthetic fixtures can be evaluation-eligible only under the exact OpenAI `gpt-5.2` manifest, v3 prompt/scorer, no-fallback and mandatory-review envelope.
- Financial Health Engine v1: confirmed Financial Vault records now produce deterministic health metrics for cash flow, spending, subscriptions, debt, safety and wealth. The manual import API returns the health snapshot with evidence IDs, deterministic actions are included in Decision Centre output, and the import workspace shows immediate post-confirmation health findings plus AI CFO briefing facts. No AI calls, Open Banking activation or unconfirmed candidate data are used.
- Financial Timeline & Forecasting v1: confirmed canonical records and explicit assumptions now generate deterministic monthly cash-flow, debt and net-worth forecasts, projected financial timeline events, scenario deltas, baseline comparisons, forecast-quality warnings, Decision Centre findings and AI CFO context facts. `/digital-twin/timeline` exposes baseline projection, event timeline, charts, editable scenarios and safety labelling without Open Banking or live AI calls.
- Goals & Scenario Planning v1: user-defined goals, confirmed records and explicit assumptions now produce deterministic contribution requirements, feasibility classes, home-purchase, retirement and debt-repayment analysis, milestone timeline events, scenario comparisons, goal Decision Centre actions and grounded AI CFO context. `/goals` now supports goal creation, scenario comparison, pause/archive actions and safety labelling without Open Banking or live AI calls.

## Planned

- Decision Engine scoring by expected financial value.
- Digital Financial Twin.
- Automation Engine.
- Proactive daily briefing.
- Money Map.
- Life Planner.
- Refinance Engine.
- Document Intelligence Engine with citations.
- Executive Mode.
- Professional Mode.
- Command palette and pinned AI panel.
- Dark mode.
- PostgreSQL Phase 2 application persistence rollout: repository layer, Decision Centre persistence, Digital Twin persistence, AI CFO persistence, background job persistence, performance optimisation, observability and production deployment.
- PostgreSQL Phase 2 application persistence foundation: server-only runtime database configuration validation, restricted-role URL validation, psql-backed runtime client boundary, safe SQL parameter binding, database error classification, redacted database diagnostics, initial profile/document/fact-version repository methods and API persistence matrix. Active product API conversion remains incomplete and is tracked in `docs/POSTGRES_PHASE2_COMPLETION.md`.

## Validation Caveats

- Resolved on 2026-07-18: standalone TypeScript validation now passes via `npm run typecheck` after enabling `allowImportingTsExtensions` for the existing `.ts` test import convention.
- Resolved on 2026-07-18: `npm run neven` no longer has an unbounded browser-health subprocess or 900-second remediation wait. It now has stage-level progress, explicit per-stage timeouts, `LAST_ACTIVE_STAGE` output, child-process cleanup, and non-zero incomplete exits.
- Resolved on 2026-07-19: `npm run neven` no longer enqueues a normal supervisor `/task` from `supervisor-remediation-task`. The timeout root cause was validation using the full autonomous supervisor task path for browser-health repair; that path can run Codex, screenshots, GPT review, build health and retries, and one historical run failed after about 34 minutes with `EBUSY: resource busy or locked, unlink '.tmp-vireon-start-3020.err.log'`. Remediation is now a bounded health-check, diagnosis, `/repair`, and post-check sequence.
- Current non-blocking warnings: `npm run lint` reports 28 existing warnings and `npm run build` reports existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- Codex sandbox note: `npm run test` can fail with `spawn EPERM` when run inside the restricted sandbox because Node's test runner starts per-file workers. The same command passed unsandboxed on 2026-07-18.
- Codex sandbox note: `npm run neven:diagnose` can report Playwright `spawn EPERM` inside the restricted sandbox. The same command passed unsandboxed on 2026-07-19 with browser health OK.

## Latest Validation Log

PostgreSQL Pilot v1, completed and frozen on 2026-07-31:

- `postgres:pilot:bootstrap` passed against the configured Supabase pilot targets with `roleProvisioning: PASS`, `preMigrationRoleVerification: PASS`, migrated-state detection and no blocked requirements.
- `postgres:pilot:rollback-check` passed end to end, including public-schema-only backup, managed-schema exclusion, backup table-of-contents inspection, disposable restore target validation, `schema_migrations` preservation, restored application-role provisioning, runtime grant reconciliation, bounded authentication propagation retry and full restricted runtime-role verification.
- The pilot is now the standard migration safety platform for Vireon. Future work is frozen to bug fixes, PostgreSQL version upgrades, Supabase compatibility fixes and security fixes.
- Phase 2 application persistence work is tracked separately in `docs/POSTGRES_PHASE2_ROADMAP.md`.

Live Model Evaluation Pilot v1 execution, run on 2026-07-22:

- Configured provider/model for the execution: OpenAI `gpt-5.2`, promotion state `evaluation`.
- Environment was configured only for the process: `VIREON_MODEL_ORCHESTRATOR_MODE=live-evaluation`, `VIREON_LIVE_MODEL_EVALUATION=true`, `VIREON_SYNTHETIC_DATA_ONLY=true`, `VIREON_DATA_SOURCE=synthetic`, `VIREON_MODEL_EVALUATION_ENVIRONMENT=local-pilot`, prompt logging off, raw response storage off and cross-provider fallback off. The API key was not committed, printed or stored.
- Preflight passed with 12 fixtures, expected maximum request count 24, estimated maximum cost `$1.00`, sensitivity level `financial-sensitive`, health check healthy and Anthropic/Gemini disabled.
- First execution attempts exposed implementation defects and halted safely: an overly broad credential detector matched `tokenUsage`, exact model routing was not enforced when multiple OpenAI registry entries existed, and preflight did not check selected-model sensitivity approval. These were fixed with regression coverage before the final run.
- Final run ID: `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80`.
- Final run status: completed execution, not promoted and not expansion-eligible.
- Final run metrics: 12 requests, actual cost `$0.026858`, average latency `5746.8333ms`, 6 fixtures passed, 6 failed, 0 blocked, overall score `0.4564`, hard failures `6`.
- Hard-failure categories: four `validation failed: confidence` failures and two `unsupported or prohibited claim` failures.
- Human review status: superseded by the remediation pass below. The original execution created 12 review items; the follow-up review completed 12/12 and generated preliminary `n=12` calibration.
- Reproducibility artifacts were written without raw prompts, raw responses or secrets: `.vireon/model-evaluation/live/live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80-manifest.json` and `.vireon/model-evaluation/live/live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80-summary.json`.
- Post-run validation passed: `npm run lint` exited 0 with 28 warnings; `npm run typecheck` exited 0; `npm run test` exited 0 with 269/269 tests passing; `npm run build` exited 0; `npm run validate` exited 0 in 47.1 seconds including `npm run neven` in 8.9 seconds; `npm run models:diagnose` exited 0 with live preflight ready; `npm run models:evaluate:mock` passed 32/32 with cost 0; `npm run models:evaluate:regression` passed 12/12; `npm run models:evaluate:report` passed 16/16; `npm run models:evaluate:calibration` completed with Brier `0.0784` and ECE `0.28`; `npx playwright test` passed 14/14; focused `/model-evaluation` and `/model-orchestrator` desktop/mobile smoke checks passed with no horizontal overflow.
- Remaining warnings: the existing 28 ESLint warnings, Node `ExperimentalWarning` / `MODULE_TYPELESS_PACKAGE_JSON` warnings from TypeScript stripping, and existing Turbopack warnings for workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.

Live Model Evaluation Rerun v2 attempt, run on 2026-07-22:

- Original run: `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80`.
- Intended remediation versions: `prompt-eval-live-v2`, `deterministic-scorer-v2`, `claim-extractor-v2-negation-aware`.
- Code changes: live runner now carries prompt/scorer versions into prompt context, evaluation run metadata, scorer notes and run manifests. Rerun preflight now checks offline regression status and live-provider readiness, not just review completion.
- Fixture set: unchanged 12 synthetic fixtures from the original run. No fixture versions were changed.
- Offline regression approval artifact: `.vireon/model-evaluation/reviews/live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80-offline-regression-approval-v2.json`.
- Offline gate passed: `npm run lint` exited 0 with 28 existing warnings; `npm run typecheck` exited 0; targeted remediation tests passed 54/54; `npm run models:evaluate:mock` passed 32/32; `npm run models:evaluate:regression` passed 12/12; `npm run test` passed 277/277; `npm run build` exited 0 with existing Turbopack warnings.
- `npm run models:diagnose` exited 0 and reported live evaluation blocked in the current shell, with OpenAI unconfigured and no live evaluation env loaded.
- `VIREON_OFFLINE_REGRESSION_PASSED=true npm run models:evaluate:rerun:preflight -- --run-id=live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80` exited 1 with `RERUN BLOCKED`.
- Rerun blockers: missing `VIREON_LIVE_MODEL_EVALUATION`, `VIREON_SYNTHETIC_DATA_ONLY`, `VIREON_MODEL_ORCHESTRATOR_MODE`, configured OpenAI provider/model, provider health, sensitivity approval, daily/run/task budgets, fixture limit, retry limit, output-token limit, environment identifier and budget-within-daily-limit check.
- Paid OpenAI requests made for completed rerun v2: 12.
- Rerun ID: `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7`.
- Rerun result: 4/12 passed, 8/12 failed, hard failures 9, cost `$0.009415`, average latency `3373.6667ms`, halt reason `none`.
- Human review: 12/12 completed for rerun v2.
- Paired comparison: persisted at `.vireon/model-evaluation/reviews/live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7-paired-comparison.json`.
- Regressions from original passing fixtures: `fixture-01-payslip-extraction`, `fixture-03-mortgage-statement-extraction`, `fixture-32-unsupported-action-rejection`.
- Rerun status: remediation not validated; full-suite expansion blocked.
- Model status: evaluation-only. No automatic promotion and no full-suite expansion.
- Correct current execution status: Live Model Evaluation Pilot v1 execution completed for the bounded synthetic OpenAI subset; human review and hard-failure investigation are complete; the model remains evaluation-only pending offline regressions and a fresh clean 12-fixture rerun. Do not describe the model as approved, preferred, production-grade or superior.

V3 Offline Resolution and Targeted Stage-A Readiness, validated on 2026-07-22:

- Baseline hash manifest created for original, v2 rerun, halted operational run and analysis artifacts.
- All nine v2 hard failures were classified offline: six confirmed prompt-policy confidence failures and three prohibited-claim cases unresolved pending live validation because raw live output text is not persisted by policy.
- All three regressions have causal traces: `fixture-01-payslip-extraction`, `fixture-03-mortgage-statement-extraction` and `fixture-32-unsupported-action-rejection`.
- Prohibited-claim scorer-v3 corpus passed offline thresholds: 14 labelled synthetic examples, precision `1`, recall `1`, specificity `1`, false-positive rate `0`, false-negative rate `0`, safety-weighted false-negative rate `0`.
- Deterministic confidence policy v3 passed nine invariants and disables unconstrained model confidence for synthesis, scenario explanation, evidence mapping, verification review and timeline explanation.
- Stage-A candidate manifest created with exactly six fixtures: `fixture-01-payslip-extraction`, `fixture-03-mortgage-statement-extraction`, `fixture-32-unsupported-action-rejection`, `fixture-12-daily-review-briefing`, `fixture-13-timeline-explanation` and `fixture-07-mortgage-comparison`.
- Stage-A preflight reports `READY FOR BUDGET APPROVAL`, with `paidExecutionAuthorised=false`, `budgetApproved=false` and `providerCallsMade=false`.
- `gpt-5.2` task restrictions remain active, model promotion remains disabled, Stage B and full-suite expansion remain blocked.
- Validation passed: `npm run lint` exited 0 with 28 existing warnings; `npm run typecheck` exited 0; `npm run test` exited 0 with 294/294 tests passing; `npm run build` exited 0; `npm run validate` exited 0; `npm run models:evaluate:mock` passed 32/32; `npm run models:evaluate:regression` passed 12/12; all v3 offline commands completed; `npx playwright test` passed 22/22.

Human Review and Hard-Failure Remediation v1 for run `live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80`, completed on 2026-07-22:

- Original run artifacts were frozen with SHA-256 hashes. Manifest hash: `7abce4c6dceaa6e5546a048d21c273e0d79ab4b0fb66e4b6c123d7daa33606f1`. Summary hash: `e8906578ba91c6175d0fc3dd7006ac135b075d13750533d1d69926c3b9a0029b`.
- Human review records completed: 12/12 under `live-human-review-v1`. Review records are stored separately from source run artifacts.
- Hard-failure investigations completed: 6/6.
- Failure matrix: four confirmed `prompt-design` confidence failures and two `claim-extractor` prohibited-claim false positives.
- Remediation versions: `prompt-eval-live-v2` and `deterministic-scorer-v2`.
- Scorer correction: negation-aware prohibited-claim matching now avoids false positives for safety language while preserving hard failure for positive unsafe claims.
- Preliminary calibration: `preliminary n=12`, Brier `0.1667`, expected calibration error `0.0333`.
- Rerun candidate: created for the same 12-fixture subset, with no fixture-version, routing-policy or validator-threshold changes.
- Rerun eligibility: blocked until offline regressions pass; expansion remains blocked until a fresh clean 12-fixture rerun satisfies gates.
- Model status: evaluation-only. No automatic promotion, no full-suite expansion, no production-grade claim.
- Added review/remediation CLIs: `models:evaluate:review:list`, `models:evaluate:review:show`, `models:evaluate:review:submit`, `models:evaluate:review:report`, `models:evaluate:failures` and `models:evaluate:rerun:preflight`.
- Added docs: `docs/LIVE_PILOT_HUMAN_REVIEW.md`, `docs/HARD_FAILURE_INVESTIGATION.md` and `docs/LIVE_PILOT_REMEDIATION.md`.
- Added `/model-evaluation` review/remediation dashboard and developer-only review report API for the original run.
- Validation after remediation: `npm run lint` exited 0 with the existing 28 warnings; `npm run typecheck` exited 0; `npm run test` exited 0 with 276/276 tests passing; `npm run build` exited 0; `npm run validate` exited 0 including `npm run neven` in 8.8 seconds; `npm run models:diagnose` exited 0 with live evaluation blocked in the unconfigured local environment; `npm run models:evaluate:mock` passed 32/32; `npm run models:evaluate:regression` passed 12/12; `npm run models:evaluate:calibration` completed with Brier `0.0784` and ECE `0.28`; `npm run models:evaluate:review:report` showed 12/12 reviews and 6/6 investigations; `npm run models:evaluate:failures` listed four prompt-design and two claim-extractor findings; `npm run models:evaluate:rerun:preflight` correctly blocked without `VIREON_OFFLINE_REGRESSION_PASSED=true` and reported `READY FOR FRESH 12-FIXTURE RERUN` when that flag was set after offline regression commands passed; `npx playwright test` passed 22/22 including desktop/mobile `/model-evaluation` and `/model-orchestrator` smokes.
- Remaining warnings: the existing 28 ESLint warnings, Node `ExperimentalWarning` / `MODULE_TYPELESS_PACKAGE_JSON` warnings from TypeScript stripping, and existing Turbopack warnings for workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.

Live Model Evaluation Pilot v1 implementation, validated on 2026-07-22:

- Added `src/lib/modelOrchestrator/providers/commercial.ts` with a server-only OpenAI adapter boundary for health checks, estimates, execution, cancellation stub, result normalisation, safe error classification, timeouts and structured-output requests. Provider-native responses and API keys do not escape the adapter.
- Added `src/lib/modelOrchestrator/providers/disabled.ts`; Anthropic and Gemini remain disabled-safe in this phase until separately piloted.
- Extended the model registry with `live-evaluation` mode and environment-configurable approved sensitivity levels for commercial providers.
- Added `src/lib/modelEvaluation/livePilot.ts` with redacted live preflight, deterministic initial 12-fixture subset selection, strict synthetic-data checks, required budgets, fixture cap, retry/output-token checks, expected request count, halt conditions, operational metrics, human-review queue modelling and no-automatic-promotion state.
- Added CLI commands: `npm run models:evaluate:live:preflight` and `npm run models:evaluate:live`.
- Updated `npm run models:diagnose` to include live-evaluation preflight state without printing secrets.
- Enhanced `/model-evaluation` and `/model-orchestrator` Developer Mode pages with Synthetic live evaluation status, configured provider/model, cost envelope, metrics, blockers, human-review queue state and expansion eligibility. These pages do not display credentials, raw prompts or raw provider responses.
- Added docs: `docs/LIVE_MODEL_EVALUATION_PILOT.md`, `docs/LIVE_MODEL_COST_CONTROLS.md` and `docs/LIVE_MODEL_REVIEW_RUNBOOK.md`. Updated Model Provider Setup, Model Evaluation, Evaluation & Trust Framework, Human Model Review, Model Promotion Policy, AI Confidence Calibration, Evaluation Fixtures, AI Architecture, Data Ownership, Testing and Production Rollout docs.
- Added `__tests__/lib/liveModelEvaluation.test.ts` with 21 regression tests covering disabled-by-default live evaluation, synthetic-only enforcement, production-data rejection, required fixture/budget limits, bounded fixture subset, secret-safe diagnostics, no raw prompt/response persistence, provider/sensitivity guardrails, model eligibility, routing to the explicit configured provider, invalid structured output, deterministic-fidelity hard failures, professional-review omissions, budget halt, circuit breaker opening, halted-run failure status, no automatic promotion, partial-fixture-set labelling, no-provider/mock continuity, cross-fixture rejection and Developer API/output secret safety.
- `npm run lint` passed with 28 existing warnings and 0 errors.
- `npm run typecheck` passed.
- `npm run test` passed: 266/266 tests.
- `npm run build` passed with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npm run validate` passed in 46.4 seconds, including `npm run neven` in 8.8 seconds with `APP=OK`, `SUPERVISOR=OK`, `BROWSER=OK` and `LAST_TASK=OK`.
- `npm run models:diagnose` passed. It reports `mode=local`, deterministic/mock providers enabled, commercial providers disabled, raw prompt logging off, raw response storage off and live evaluation blocked.
- `npm run models:evaluate:live:preflight` exited 1 as expected in the current environment and printed `LIVE MODEL EVALUATION BLOCKED`. Missing requirements include live-evaluation flag, synthetic-only mode, live orchestrator mode, configured provider/model, health check, budget limits, fixture cap, retry/output-token limits and non-production environment identifier.
- `npm run models:evaluate:live` exited 1 as expected without explicit arguments and refused to start until `--provider`, `--model`, `--fixture-limit=12` and `--budget-confirmed=true` are supplied.
- Offline evaluation commands remained free and deterministic: `models:evaluate:mock` passed 32/32 with cost 0 and score 0.9416; `models:evaluate:regression` passed 12/12; `models:evaluate:report` passed 16/16 with Brier 0.0784 and ECE 0.28; `models:evaluate:calibration` passed 32 fixtures; `models:evaluate:promote` returned `requires-human-review` and `Automatic promotion: false`.
- `npx playwright test` passed 14/14 after one first-attempt mobile-nav flake retried successfully.
- `/model-evaluation` and `/model-orchestrator` returned HTTP 200.
- Focused desktop/mobile smoke for `/model-evaluation` and `/model-orchestrator` passed at 1440x900 and 390x844 with no horizontal overflow. The first sandboxed Playwright probe failed with `spawn EPERM`; rerunning the same probe outside the restricted sandbox passed.
- Remaining warnings: 28 ESLint warnings, Node `ExperimentalWarning` for `--experimental-loader`, Node `MODULE_TYPELESS_PACKAGE_JSON` warnings for TypeScript test files/model modules, existing Turbopack build warnings and one Playwright mobile-nav first-attempt flake that passed on retry.
- Scope note: this is a local implementation and blocked-environment validation. The real live commercial-model pilot has not run because no provider/environment/budget configuration is present. Do not describe the model as production-grade, preferred or superior. Correct current execution status: Live Model Evaluation Pilot v1 execution remains blocked pending explicit non-production provider configuration.

Evaluation & Trust Framework v1, validated on 2026-07-21:

- Added `src/lib/modelEvaluation/` with canonical evaluation fixture/run/result/baseline/promotion/calibration models, 32 synthetic fixtures across 20 suites, deterministic scoring, hard-failure detection, claim analysis, calibration reporting, run comparison, immutable local history, prompt-version immutability and promotion gates that require human review.
- Added evaluation adapters for orchestrator-backed execution, deterministic execution and mock execution. All evaluation tasks flow through the Model Orchestrator; provider SDKs are not called directly by the evaluation framework.
- Added CLI commands: `npm run models:evaluate`, `npm run models:evaluate:mock`, `npm run models:evaluate:regression`, `npm run models:evaluate:report`, `npm run models:evaluate:promote` and `npm run models:evaluate:calibration`.
- Added Developer Mode `/model-evaluation` workspace and API routes for suites, runs, run detail, comparison, promotion review and calibration.
- Added docs: `docs/EVALUATION_TRUST_FRAMEWORK.md`, `docs/EVALUATION_FIXTURES.md`, `docs/MODEL_PROMOTION_POLICY.md`, `docs/AI_CONFIDENCE_CALIBRATION.md` and `docs/HUMAN_MODEL_REVIEW.md`. Updated Model Evaluation, Model Orchestrator, AI Architecture, Data Ownership, Testing and Production Rollout docs.
- Added `__tests__/lib/modelEvaluation.test.ts` covering synthetic fixture governance, default no-paid-call behaviour, live opt-in blocking, unsafe test data rejection, hard-failure isolation, deterministic mechanical scoring, judge limits, evidence-reference validation, professional-review requirements, promotion human-review requirement, immutable prompt versions, immutable baselines, calibration, instability detection, adversarial routing protection, comparison metrics, reviewer disagreement, blocked-live-run safety, cross-fixture contamination, evidence-over-prose promotion gating, realised-benefit guardrails, deterministic/mock no-provider operation and schema validation without exact text matching.
- `npm run lint` passed with 28 existing warnings and 0 errors.
- `npm run typecheck` passed.
- `npm run test` passed: 245/245 tests.
- `npm run build` passed. Existing Turbopack warnings remain: workspace root inference due multiple lockfiles and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npm run validate` passed in 46.7 seconds after the final runner cleanup, including `npm run neven` in 8.9 seconds with `APP=OK`, `SUPERVISOR=OK`, `BROWSER=OK` and `LAST_TASK=OK`.
- `npm run models:diagnose` passed. Local configuration shows deterministic and mock providers enabled/healthy; OpenAI, Anthropic and Gemini are disabled because no API keys are configured. Raw prompt logging, raw response storage and cross-provider fallback remain off.
- `npm run models:evaluate:mock` passed after the final runner cleanup: 32 fixtures, 32 passed, 0 failed, 0 blocked, overall score 0.9416, hard failures 0, cost 0, average latency 0ms, live-provider status `no paid provider calls`, promotion status `requires-human-review`.
- `npm run models:evaluate:regression` passed: 12 fixtures, regression status `passed`, cost 0, no paid provider calls.
- `npm run models:evaluate:report` passed: 16 fixtures, overall score 0.9424, hard failures 0, Brier score 0.0784, expected calibration error 0.28.
- `npm run models:evaluate:promote` passed and correctly did not promote automatically: proposed state `approved`, status `requires-human-review`, automatic promotion `false`, failed gate `humanReviewComplete`.
- `npm run models:evaluate:calibration` passed: 32 fixtures, Brier score 0.0784, expected calibration error 0.28, overconfidence 0, underconfidence 0.
- `npx playwright test` passed: 14/14 across Chromium and mobile Chrome.
- `/api/model-evaluation/suites` route smoke passed with HTTP 200.
- `/model-evaluation` route smoke passed with HTTP 200.
- `/model-evaluation` desktop smoke at 1440x900 and mobile smoke at 390x844 passed with the Evaluation & Trust Framework page visible and no horizontal overflow. The first sandboxed one-off Playwright probe failed with `spawn EPERM`; rerunning the same probe outside the restricted sandbox passed.
- Remaining warnings: 28 ESLint warnings, Node `ExperimentalWarning` for `--experimental-loader`, Node `MODULE_TYPELESS_PACKAGE_JSON` warnings for TypeScript test files/modelEvaluation modules, and existing Turbopack build warnings.
- Scope note: locally validated using synthetic benchmark fixtures, mock/deterministic adapters and disabled-safe commercial provider configuration. This does not prove production AI quality, live-provider performance, privacy approval, or superiority over another provider. Live-provider evaluations, human review and production monitoring remain separate rollout work.

Autonomous Operations v1, validated on 2026-07-20:

- Added `src/lib/autonomousOperations.ts` with first-class autonomous goals, versioned plans, opportunity scanning, approval-gated task queue, specialised worker registry, supervisor state, bounded context assembly, worker-result verification classification, learning metrics, scheduled review model, event triggers, executive briefing, knowledge-health scoring, safety flags and deterministic duplicate suppression.
- Added read-only `/api/autonomous-operations` endpoint. It returns autonomous operations state only and does not mutate Financial Vault, Action Workflow or Decision Centre records.
- Added Developer Mode `/autonomous-operations` page showing supervisor state, goals, planner, current task queue, worker results, approvals, safety envelope, scheduled reviews, knowledge health and learning metrics.
- Added `Autonomous Operations` to Developer Mode navigation.
- Added `__tests__/lib/autonomousOperations.test.ts` covering goal planning, duplicate suppression, approval enforcement, context assembly, supervisor retries/state surface, event triggering, learning updates, explainability/verification classification and blocked autonomous mutation-style tasks.
- Fixed date-sensitive production data integrity and PostgreSQL pilot test fixtures that expired on 2026-07-20 by moving synthetic session expiry to 2027-07-20 while preserving explicit expired-session regression coverage.
- `npx tsx --test __tests__\lib\autonomousOperations.test.ts` passed: 7/7 tests.
- `npm run lint` passed with 28 existing warnings and 0 errors.
- `npm run typecheck` passed.
- `npm run test` passed: 208/208 tests.
- `npm run build` passed with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npm run validate` passed in 54.8 seconds, including `npm run neven` in 9.2 seconds with `APP=OK`, `SUPERVISOR=OK`, `BROWSER=OK` and `LAST_TASK=OK`.
- `/autonomous-operations` route smoke passed with HTTP 200.
- `/api/autonomous-operations` route smoke passed with HTTP 200.
- Remaining warnings: 28 ESLint warnings, Node `ExperimentalWarning` for `--experimental-loader`, Node `MODULE_TYPELESS_PACKAGE_JSON` warnings for TypeScript test files, and existing Turbopack build warnings.
- Safety status: Autonomous Operations v1 is a read-only control plane. It can plan, prepare, classify and request approval, but it does not execute financial actions, verify realised outcomes without evidence, or allow GPT to mutate financial facts.

PostgreSQL Pilot Provisioning Pack v1, validated on 2026-07-19:

- Added `docs/POSTGRES_PILOT_PROVISIONING.md` with managed PostgreSQL, local Windows PostgreSQL and Docker provisioning paths. Managed PostgreSQL is identified as the preferred route.
- Documented required private environment variables: `VIREON_PILOT_DATABASE_URL`, `VIREON_PILOT_RESTORE_DATABASE_URL`, `VIREON_PILOT_MIGRATION_DATABASE_URL`, `VIREON_PILOT_APPLICATION_DATABASE_URL`, `VIREON_PERSISTENCE_MODE=postgres-required`, `VIREON_ENVIRONMENT`, `VIREON_SYNTHETIC_DATA_ONLY=true` and SSL requirement flags. Documentation uses placeholders only and contains no credentials.
- Documented migration-owner, application and restore roles, least-privilege rules, SQL templates, required pilot databases `vireon_pilot` and `vireon_pilot_restore`, reset expectations and the exact resume command: `Execute PostgreSQL Persistence Pilot v1`.
- Added shared pilot check helpers in `scripts/postgres-pilot-checks.mjs`.
- Added `npm run postgres:pilot:tooling`, which reports `psql`, `pg_dump` and `pg_restore` paths/versions and exits non-zero when required tools are absent.
- Enhanced `npm run postgres:pilot:diagnose` to report redacted environment status, persistence mode, database reachability, SSL status, role flags, schema version and client-tool status when infrastructure exists.
- Added `npm run postgres:pilot:preflight`, which fails unless URLs, separate primary/restore targets, non-production/synthetic mode, `postgres-required`, client tools, connectivity and role guardrails are satisfied.
- Updated `docs/POSTGRES_PILOT_RUNBOOK.md` and `docs/TESTING.md` with provisioning handoff, preflight commands and blocked-environment expectations.
- `npm run lint` passed with 28 existing warnings and 0 errors.
- `npm run typecheck` passed.
- `npm run test` passed: 201/201 tests.
- `npm run build` passed with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npm run validate` passed in 43.8 seconds, including `npm run neven` in 8.8 seconds with `APP=OK`, `SUPERVISOR=OK`, `BROWSER=OK` and `LAST_TASK=OK`.
- `npm run postgres:pilot:tooling` exited 1 as expected in the current environment and reported missing `psql`, `pg_dump` and `pg_restore`.
- `npm run postgres:pilot:diagnose` exited 0 and reported `readyForRealPilot=false`.
- `npm run postgres:pilot:preflight` exited 1 as expected and printed `POSTGRESQL PILOT BLOCKED`. Missing requirements include PostgreSQL client tools, all pilot database URLs, `VIREON_PERSISTENCE_MODE=postgres-required`, `VIREON_SYNTHETIC_DATA_ONLY=true`, and reachable primary, restore, migration-role and application-role database connections.
- No PostgreSQL readiness gates were marked passed. Current status remains: PostgreSQL persistence pilot blocked pending real non-production infrastructure and PostgreSQL client tooling.

PostgreSQL Persistence Pilot execution attempt, 2026-07-19:

- Requested execution of the real PostgreSQL Persistence Pilot v1 was stopped at preflight, per the pilot rule not to substitute mocks when infrastructure cannot be provisioned.
- `npm run postgres:pilot:diagnose` exited 0 but reported `readyForRealPilot=false`.
- Environment status: `VIREON_PILOT_DATABASE_URL=false`, `VIREON_PILOT_RESTORE_DATABASE_URL=false`, `VIREON_PERSISTENCE_MODE=local`.
- Client tooling status: `psql=false`, `pg_dump=false`, `pg_restore=false`, `docker=false`. A direct `Get-Command psql, pg_dump, pg_restore, docker` check found no commands.
- Blocked real pilot gates: schema, isolation, migration apply, backup and restore.
- Not run because real infrastructure/tooling is absent: migration dry run/apply/rerun against PostgreSQL, repository contract suite against PostgreSQL, application isolation suite against PostgreSQL, RLS suite, rollback injection suite, idempotency suite, concurrency suite, migration pilot, dual-run comparison, export/deletion tests against PostgreSQL, backup creation, restore drill, post-restore suite, outage tests and Production Readiness smoke from real pilot evidence.
- Correct status remains blocked: PostgreSQL persistence pilot implementation is prepared and locally contract-tested, but the real non-production PostgreSQL pilot has not been executed or validated. Vireon is not production-ready.

PostgreSQL Persistence Pilot v1, validated on 2026-07-19:

- Added `src/lib/postgresPilotPersistence.ts` with `UserContext`, synthetic pilot identity enforcement, pilot persistence modes (`local`, `postgres-pilot`, `postgres-required`), SQL-bound PostgreSQL migration runner, SQL repository adapter boundary, pilot evidence/audit repositories, transaction rollback injection, migration preview/execution helpers, dual-run comparison, backup-manifest verification, calculation reproduction checks, readiness gate evaluation and persistence-mode enforcement.
- Added `schema_migrations` to `migrations/0001_production_data_integrity.sql` so migration ID, checksum, applied time, duration, executor, success/failure, error details and correlation ID can be recorded.
- Added `scripts/postgres-pilot-diagnose.mjs` and package scripts `postgres:pilot:diagnose` and `postgres:pilot:test`.
- Enhanced `/api/production-readiness` and `/production-readiness` with PostgreSQL pilot status: persistence mode, database configured state, adapter status, Pilot Ready indicator and all readiness gates.
- Added `docs/POSTGRES_PILOT_RUNBOOK.md` with setup, migration, reset, pilot users, backup, restore, troubleshooting, rollback, incident handling and readiness gates.
- Updated `docs/PERSISTENCE_AUDIT.md`, `docs/DATA_OWNERSHIP.md`, `docs/BACKUP_AND_RECOVERY.md`, `docs/PRODUCTION_ROLLOUT.md` and `docs/TESTING.md` with the limited pilot scope and blocked infrastructure rules.
- Added `__tests__/lib/postgresPilotPersistence.test.ts` covering in-memory/local/PostgreSQL-harness contract parity, cross-user denial, version conflicts, idempotent decisions, rollback injection, synthetic-user enforcement, `postgres-required` no-fallback behaviour, migration conflict prevention, safe rerun idempotency, client server-owned field rejection, backup restore gating, failed readiness gates blocking Pilot Ready, dual-run discrepancy visibility, unavailable engine-version reproducibility, migration checksum conflict refusal and SQL adapter user scoping.
- `npm run postgres:pilot:diagnose` passed and reported `readyForRealPilot=false`: `VIREON_PILOT_DATABASE_URL=false`, `VIREON_PILOT_RESTORE_DATABASE_URL=false`, `VIREON_PERSISTENCE_MODE=local`, `psql=false`, `pg_dump=false`, `pg_restore=false`, `docker=false`. Blocked real gates: schema, isolation, migration apply, backup and restore.
- Targeted pilot test file passed when run directly: 20/20.
- `npm run postgres:pilot:test` was inconclusive in the Codex sandbox because Node's test runner hit `spawn EPERM`; the requested unsandboxed rerun was not approved. The same test file is included in `npm run test`, which passed.
- `npm run lint` passed with 28 existing warnings and 0 errors.
- `npm run typecheck` passed.
- `npm run test` passed: 201/201 tests.
- `npm run build` passed with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npm run validate` passed in 42.2 seconds, including `npm run neven` in 8.7 seconds with `APP=OK`, `SUPERVISOR=OK`, `BROWSER=OK`, and `LAST_TASK=OK`.
- `npx playwright test` passed: 14/14 across Chromium and mobile Chrome.
- `/production-readiness` route smoke passed with HTTP 200.
- `/api/production-readiness` route smoke passed with HTTP 200.
- `/production-readiness` desktop smoke passed at 1440x900 with `Production Readiness` and `Configuration Checks` visible and no horizontal overflow.
- `/production-readiness` mobile smoke passed at 390x844 with `Production Readiness` and `Configuration Checks` visible and no horizontal overflow.
- Not completed: disposable PostgreSQL provisioning, migration apply, migration rerun against PostgreSQL, PostgreSQL RLS tests, direct SQL application-role tests, real database outage simulation, `pg_dump` backup creation, restore into a clean database, post-restore repository tests and corruption recovery drill. These require non-production PostgreSQL infrastructure and client tools that are not available in this environment.
- Correct status: PostgreSQL persistence pilot implementation prepared and locally contract-tested; real non-production PostgreSQL infrastructure validation remains blocked. Vireon is not production-ready.
- Remaining warnings: 28 ESLint warnings, Node `ExperimentalWarning` for `--experimental-loader`, Node `MODULE_TYPELESS_PACKAGE_JSON` warnings for TypeScript test files, and existing Turbopack build warnings.

Model Orchestrator v1, validated on 2026-07-20:

- Added `src/lib/modelOrchestrator/` with canonical model task/result types, explicit provider capability registry, deterministic router, routing policy, executor, structured-output validator, fallback helper, circuit breaker, budget checks, in-memory run/audit repository, deterministic adapter, mock adapter and disabled-safe OpenAI/Anthropic/Gemini adapter stubs.
- Added API routes for `/api/model-orchestrator/execute`, `/api/model-orchestrator/estimate`, `/api/model-orchestrator/providers`, `/api/model-orchestrator/health`, `/api/model-orchestrator/runs/[runId]`, and `/api/model-orchestrator/runs/[runId]/cancel`.
- Added `/model-orchestrator` Developer Mode workspace showing provider cards, configured models, routing policy version, privacy defaults, blocked task classes, and a synthetic routing console.
- Added `npm run models:diagnose`. Current local diagnostics passed with `mode=local`, `policyVersion=model-routing-policy-v1`, deterministic and mock providers enabled/healthy, commercial OpenAI/Anthropic/Gemini providers disabled because no API keys are configured, raw prompt logging off, raw response storage off and cross-provider fallback off.
- Integrated AI CFO through `createAICfoModelTaskRequest`, which packages deterministic outputs, evidence, missing inputs and professional-review requirements without allowing model-side financial calculations.
- Integrated Autonomous Operations through `createAutonomousWorkerModelTaskRequest`, so workers declare task type, schema, capability, risk, sensitivity and approval requirements without naming providers or executing provider-native tools.
- Added `docs/MODEL_ORCHESTRATOR.md`, `docs/MODEL_ROUTING_POLICY.md`, `docs/MODEL_PROVIDER_SETUP.md`, and `docs/MODEL_EVALUATION.md`; updated AI Architecture, Data Ownership, Testing and Production Rollout docs.
- Added `__tests__/lib/modelOrchestrator.test.ts` covering deterministic routing, sensitivity filtering, prohibited-provider filtering, cost/latency ranking, provider health filtering, circuit breakers, structured validation, evidence-reference validation, claimed-calculation rejection, budget blocking, prompt hash persistence, no-provider mode, single-provider mode, user-isolated model runs, AI CFO request mapping and Autonomous Operations worker mapping.
- `npx tsx --test __tests__\lib\modelOrchestrator.test.ts` passed: 15/15 tests.
- `npm run lint` passed with 28 existing warnings and 0 errors.
- `npm run typecheck` passed.
- `npm run test` passed: 223/223 tests.
- `npm run build` passed with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npm run validate` passed in 48.9 seconds, including `npm run neven` in 9.6 seconds with `APP=OK`, `SUPERVISOR=OK`, `BROWSER=OK`, and `LAST_TASK=OK`.
- `npm run models:diagnose` passed and did not print API keys, raw prompts or raw responses.
- `/model-orchestrator`, `/api/model-orchestrator/health`, and `/api/model-orchestrator/providers` returned HTTP 200 locally.
- `npx playwright test` passed: 14/14 across Chromium and mobile Chrome.
- Targeted `/model-orchestrator` desktop smoke at 1440x900 and mobile smoke at 390x844 loaded the page and detected no horizontal overflow.
- Remaining warnings: 28 ESLint warnings, Node `ExperimentalWarning` for `--experimental-loader`, Node `MODULE_TYPELESS_PACKAGE_JSON` warnings for TypeScript test files and model-orchestrator index, and existing Turbopack build warnings.
- Scope note: locally validated with deterministic and mock adapters plus disabled-safe commercial adapter stubs. This is not autonomous multi-model production operation. Live provider execution, privacy approvals, provider evaluations, model promotion and production observability remain separate rollout work.

Production Data Integrity and Readiness v1, validated on 2026-07-19:

- Added `docs/PERSISTENCE_AUDIT.md`, `docs/DATA_OWNERSHIP.md`, `docs/BACKUP_AND_RECOVERY.md`, and `docs/PRODUCTION_ROLLOUT.md`.
- Added PostgreSQL target migration `migrations/0001_production_data_integrity.sql` covering users, financial profiles, facts, fact versions, documents, document extractions, evidence, calculation snapshots, Digital Twin scenarios, simulation runs, decisions, decision history, workflows, workflow steps, workflow evidence, workflow outcomes, timeline events, AI CFO questions/answers, daily reviews, goals, rule references, audit events, preferences, idempotency keys, background jobs, exports, deletion requests and migration runs.
- Added `src/lib/productionDataIntegrity.ts` with production repository interfaces, in-memory contract implementation, local-development repository boundary, PostgreSQL executor boundary, session-derived user scoping, unsafe client-field rejection, idempotency, optimistic concurrency, transaction rollback, audit hashing, snapshot metadata, data export, account deletion isolation, migration preview, log redaction, demo/live separation, job retry tracking and production configuration validation.
- Extended `/api/production-readiness` and added `/production-readiness` Developer Mode diagnostics. The page reports persistence mode, schema version, local record count, config status, production checks and persistence inventory without exposing secrets.
- Added `__tests__/lib/productionDataIntegrity.test.ts` covering repository contracts, cross-user access/update rejection, forged user/server-owned fields, unauthenticated and expired sessions, duplicate idempotent requests, concurrency conflicts, failed transaction rollback, verified outcome evidence/snapshot requirements, immutable audit history, demo/live separation, export secret omission, sensitive redaction, account deletion isolation, migration conflict protection, historical snapshot versions, production config fail-fast, safe database errors and bounded job retries.
- Targeted production data integrity tests passed: 20/20.
- `npm run lint` passed with 28 existing warnings and 0 errors.
- `npm run typecheck` passed.
- `npm run test` passed: 181/181 tests.
- `npm run build` passed with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npm run validate` passed in 47.7 seconds, including `npm run neven` in 8.8 seconds with `APP=OK`, `SUPERVISOR=OK`, `BROWSER=OK`, and `LAST_TASK=OK`.
- `npm run neven:diagnose` passed: app health OK, supervisor health OK, browser health OK, active lock none, stale running tasks 0. It still reports historical last-task failure metadata from the previously repaired stale task.
- `npx playwright test` passed: 14/14 across Chromium and mobile Chrome.
- `/production-readiness` route smoke passed with HTTP 200.
- `/api/production-readiness` route smoke passed with HTTP 200.
- `/production-readiness` desktop smoke passed at 1440x900 with `Production Readiness` and `Configuration Checks` visible and no horizontal overflow.
- `/production-readiness` mobile smoke passed at 390x844 with `Production Readiness` and `Configuration Checks` visible and no horizontal overflow.
- Migration dry-run, rollback, cross-user security, idempotency, concurrency, export, deletion, backup restore drill, demo/live separation and production configuration failure behaviours are covered by deterministic contract tests only. They have not yet been exercised against a real PostgreSQL database or production backup system.
- Remaining warnings: 28 ESLint warnings, Node `ExperimentalWarning` for `--experimental-loader`, Node `MODULE_TYPELESS_PACKAGE_JSON` warnings for TypeScript test files, and existing Turbopack build warnings.

Financial Timeline and Explainability v1, validated on 2026-07-19:

- Added `src/lib/financialTimeline.ts`, `src/lib/timelineEngine.ts`, and `src/lib/explainability.ts`.
- Timeline events now carry timestamp, category, title, summary, why, deterministic cause, evidence, calculation snapshot, confidence, related decisions/workflows/documents/scenarios, affected metrics, before values, after values, impact, and immutability.
- Timeline generation aggregates current Financial Vault documents, Balance Sheet position changes, Decision Centre recommendations, Action Workflow executions/evidence/outcomes, Daily Review findings, Digital Twin scenarios/simulations/future milestones, and TaxRuleReference provenance.
- Explainability supports recommendation explanations, contributing engines, facts used, assumptions, rules used, changed metrics, conditions that could change a recommendation, date comparisons, metric-cause explanations, and counterfactual summaries from recorded before/after values.
- `/timeline` now provides Timeline, Compare Dates, Explain Recommendation, Major Milestones, and Financial Journey views with category/confidence filters.
- Added regression tests for timeline ordering, immutable history, evidence linking, before/after values, deterministic compare dates, metric-cause explanations, recommendation explanations, historical rule versions, deleted/cancelled workflow visibility, yearly summaries, milestones, counterfactuals, and AI-summary invention prevention.
- `npm run lint` passed with 28 existing warnings and 0 errors.
- `npm run typecheck` passed.
- `npm run test` passed: 161/161 tests.
- `npm run build` passed with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npm run validate` passed in 50.8 seconds, including `npm run neven` in 8.9 seconds with `APP=OK`, `SUPERVISOR=OK`, `BROWSER=OK`, and `LAST_TASK=OK`.
- `npx playwright test` passed: 14/14 across Chromium and mobile Chrome.
- Timeline, Compare Dates, Explain Recommendation, Major Milestones, and Financial Journey route smokes passed at 1440 px desktop, 768 px tablet, and 390 px mobile widths with no horizontal overflow.
- Screenshot review artefacts captured: `.tmp-timeline-timeline-1440.png`, `.tmp-timeline-compare-1440.png`, and `.tmp-timeline-explain-1440.png`.
- Remaining warnings: 28 ESLint warnings, Node `ExperimentalWarning` for `--experimental-loader`, Node `MODULE_TYPELESS_PACKAGE_JSON` warnings for TypeScript test files, and existing Turbopack build warnings.

Workflow Execution and Outcome Verification v1 hardening, validated on 2026-07-19:

- Implemented compatibility-normalised `WorkflowExecution` fields: `workflowVersion`, `executionStatus`, `verificationDueAt`, `reopenedAt`, `currentStepId`, `nextBestAction`, `outcomeChecks`, step-level `requiredEvidence`, and richer evidence status/type metadata.
- Preserved the core guardrail: completing all checklist steps moves execution to `Awaiting Verification` or equivalent, but does not set `outcomeStatus=Verified`, `realisedImpact`, or Dashboard financial wins.
- Realised impact now requires verified post-action evidence. User attestation alone and unverified external evidence remain `Evidence Pending`; failed recalculation returns `Inconclusive`.
- Dashboard progress now uses only `verifiedFinancialImpact` from workflows with `outcomeStatus=Verified`, preventing expected savings from appearing as realised wins.
- Added `/action-workflows` views for Overview, Active, Waiting, Verification, Completed, and Templates while retaining one deterministic next action per workflow.
- `npm run lint` passed with 28 existing warnings and 0 errors.
- `npm run typecheck` passed.
- `npm run test` passed: 151/151 tests.
- `npm run build` passed with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npm run validate` passed in 44.3 seconds after the final workflow-view adjustment, including `npm run neven` in 9.0 seconds with `APP=OK`, `SUPERVISOR=OK`, `BROWSER=OK`, and `LAST_TASK=OK`.
- `npm run neven:diagnose` passed: app health OK, supervisor health OK, browser health OK, active lock none, stale running tasks 0. It still reports historical last-task failure metadata from the previously repaired stale task.
- `npx playwright test` passed: 14/14 across Chromium and mobile Chrome.
- `/action-workflows`, `/action-workflows?workflowId=workflow-subscription-review`, and `/api/action-workflows` returned HTTP 200.
- Desktop, tablet, mobile, workflow-detail, evidence/upload surface, outcome-verification surface, and no-horizontal-overflow smoke probes passed.
- Remaining warnings: 28 ESLint warnings, Node `ExperimentalWarning` for `--experimental-loader`, Node `MODULE_TYPELESS_PACKAGE_JSON` warnings for TypeScript test files, and existing Turbopack build warnings.

Fix Neven Supervisor Remediation Timeout v1, validated on 2026-07-19:

- Root cause identified: `tools/neven-supervisor/launch.ps1` used `Submit-Task` against supervisor `/task` inside `supervisor-remediation-task`, so validation remediation entered the full autonomous coding loop instead of a bounded repair. Evidence: `.ai-supervisor/actions.log` shows browser-health CSS/static failures queued as task `task-[redacted]`; the task later failed after roughly 34 minutes with `EBUSY: resource busy or locked, unlink 'C:\Users\summe\liberva\.tmp-vireon-start-3020.err.log'`. Supervisor status also contained stale running task `task-[redacted]`.
- `supervisor-remediation-task` was run independently through the new remediation probe at least three times. Runs completed in 2.2-2.3 seconds, reported substages `health-check`, `diagnosis`, `remediation`, and `post-remediation-verification`, and did not submit `/task`.
- Concurrent remediation probe validated the atomic lock: one run completed in 2.3 seconds; the competing run exited non-zero in 0.1 seconds with `LAST_ACTIVE_SUBSTAGE=lock-acquire` and an active lock owner diagnostic.
- `npm run neven:diagnose` passed unsandboxed in 8.9 seconds: app health OK, supervisor health OK, ports 3000 and 4010 owned by existing processes, active lock none, stale running tasks 0, browser health OK.
- `npm run neven` passed three consecutive times: 8.7 seconds, 8.8 seconds, 8.7 seconds. Remediation was not entered on healthy runs.
- After the final cleanup-diagnostics ordering adjustment, `npm run neven` passed again in 8.7 seconds.
- `npm run validate` passed three consecutive times: 46.2 seconds, 42.8 seconds, 42.9 seconds.
- `npm run typecheck` passed standalone.
- `npm run test` passed standalone: 147/147 tests.
- `npm run lint` passed standalone with 28 existing warnings and 0 errors.
- `npm run build` passed standalone with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- Remaining warnings: 28 ESLint warnings, Node `ExperimentalWarning` for `--experimental-loader`, Node `MODULE_TYPELESS_PACKAGE_JSON` warnings for TypeScript test files, and existing Turbopack build warnings.

Optimise Dashboard Density and Remove Duplication v1, validated on 2026-07-19:

- `npm run validate` did not pass. Lint, standalone TypeScript, tests, and build completed, then `npm run neven` failed at `supervisor-remediation-task` after the 120-second stage timeout.
- `npm run neven` was rerun separately and failed again at `supervisor-remediation-task`; last observed status was `queued`, `LAST_ACTIVE_STAGE=supervisor-task:task-[redacted]`.
- `npm run lint` passed with 28 existing warnings and 0 errors after fixing the unrelated `AppShell` React compiler lint error.
- `npm run typecheck` passed.
- `npm run test` passed: 138/138 tests, including Dashboard source-entity duplicate suppression regression coverage.
- `npm run build` passed with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npx playwright test` timed out once without useful progress output after final panel removal; rerunning the Dashboard/mobile smoke specs directly with one worker passed: 14/14 across Chromium and mobile Chrome.
- Dashboard smoke coverage includes compact Dashboard limits, no repeated impact/trend/workflow metadata, no horizontal overflow, mobile nav, and keyboard-focus smoke.
- Playwright emitted a hydration warning during the direct smoke run for a transient `style={{caret-color:"transparent"}}` attribute on the Developer Mode checkbox; tests still passed and no `Hydration failed` page error was detected by the mobile smoke.
- Production screenshot review captured `.tmp-dashboard-density-1440x900.png`, `.tmp-dashboard-density-1280x800.png`, `.tmp-dashboard-density-768x1024.png`, and `.tmp-dashboard-density-390x844.png`.
- Project screenshot script captured `screenshot/fullpage.png` and `screenshot/overview.png` at desktop width.
- Isolated Daily Review state smokes passed for `empty-demo`, `missing-document-demo`, and `partial-failure-demo` on port 3014 using a temporary Daily Review store.

Dashboard Financial Briefing redesign v1, validated on 2026-07-19:

- `npm run validate` passed in 41.1 seconds and covered lint, standalone TypeScript, tests, build, and Neven.
- `npm run lint` passed with 28 existing warnings and 0 errors.
- `npm run typecheck` passed.
- `npm run test` passed: 137/137 tests, including Dashboard presentation regression coverage.
- `npm run build` passed with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npm run neven` passed in 8.7 seconds: `APP=OK`, `SUPERVISOR=OK`, `BROWSER=OK`, `LAST_TASK=OK`, `LAST_ACTIVE_STAGE=browser-health-before`.
- `npx playwright test` passed: 10/10 across Chromium and mobile Chrome after updating stale Dashboard/mobile-nav smoke expectations.
- Production Dashboard smoke passed at 1440 px, 768 px, and 390 px widths with no detected horizontal overflow, no hydration errors, and no normal-dashboard System Health exposure above the fold.
- Screenshot review completed for `.tmp-dashboard-desktop-1440.png`, `.tmp-dashboard-tablet-768.png`, and `.tmp-dashboard-mobile-390.png`.

Polish Daily Review Design v1, validated on 2026-07-18:

- `npm run validate` passed in 44.4 seconds and covered lint, standalone TypeScript, tests, build, and Neven.
- `npm run lint` passed with 28 existing warnings and 0 errors.
- `npm run typecheck` passed.
- `npm run test` passed: 132/132 tests, including Daily Review presentation regression coverage.
- `npm run build` passed with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npm run neven` passed in 8.8 seconds: `APP=OK`, `SUPERVISOR=OK`, `BROWSER=OK`, `LAST_TASK=OK`, `LAST_ACTIVE_STAGE=browser-health-before`.
- Daily Review production route smoke passed at `/ai-cfo/daily-review` using an isolated temporary Daily Review store.
- Desktop, tablet, and mobile Playwright smoke passed at 1280 px, 1440 px, 768 px, and 390 px widths with no detected horizontal overflow.
- Keyboard smoke passed: focus reached actionable elements and System Health exposes `aria-expanded`.
- Partial-failure visual smoke passed: `Review partially complete` is shown and `No material changes` is not shown.
- Empty-state visual smoke passed: stable-position copy is shown without manufactured recommendations.
- Screenshot review completed for `.tmp-daily-review-desktop-1280.png`, `.tmp-daily-review-desktop-1440.png`, `.tmp-daily-review-tablet-768.png`, `.tmp-daily-review-mobile-390.png`, `.tmp-daily-review-partial-failure.png`, and `.tmp-daily-review-empty.png`.

Stabilise Project Validation v1, validated on 2026-07-18:

- `npm run lint` passed with 28 existing warnings and 0 errors.
- `npm run typecheck` passed: standalone `tsc --noEmit` is no longer blocked by `.ts` test import extensions.
- `npm run test` passed unsandboxed: 127/127 tests.
- `npm run build` passed with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npm run neven` passed in 9.4 seconds: `APP=OK`, `SUPERVISOR=OK`, `BROWSER=OK`, `LAST_TASK=OK`, `LAST_ACTIVE_STAGE=browser-health-before`.
- `npm run validate` passed in 46.6 seconds and now covers lint, standalone TypeScript, tests, build, and Neven.

Workflow Execution and Outcome Verification v1, validated on 2026-07-18:

- `npx tsx --test __tests__\**\*.test.ts` passed: 127/127.
- `npm run lint` passed with existing warnings only.
- `npm run build` passed with existing Turbopack warnings about workspace root inference and `next.config.ts` tracing from `api/runtime/screenshots`.
- `npm run neven` passed within a 120-second timeout: `APP=OK`, `SUPERVISOR=OK`, `BROWSER=OK`, `LAST_TASK=OK`.
- `/action-workflows` route smoke passed with HTTP 200.
- `/action-workflows?decisionId=refinance-mortgage-rate` workflow-detail smoke passed with HTTP 200.
- `/api/action-workflows` API smoke passed with HTTP 200.
- Outcome-verification API smoke passed: evidence upload HTTP 200, verified subscription outcome, artefact generation HTTP 200, failed recalculation produced `Inconclusive`.
- Desktop Playwright smoke passed for `/action-workflows?decisionId=refinance-mortgage-rate`; existing dev HMR WebSocket console errors appeared.
- Mobile Playwright smoke passed for `/action-workflows?decisionId=refinance-mortgage-rate`; existing dev HMR WebSocket console errors appeared.
- Template-version migration regression is covered by `WorkflowExecutionEngine` tests for ten templates at `workflow-execution-v1.0`.
Vireon Private Beta Pilot Operations v1, implemented on 2026-07-24:

- Added controlled founding cohort governance for `FOUNDING_BETA_01`: invite-only, manual approval, 10-user cap, priority support, deterministic features only.
- Added invitation lifecycle controls covering creation, send/open/accept, expiration, revocation, reuse prevention, email mismatch rejection and audit references.
- Added a privacy-safe support record model and operations dashboard that aggregate beta behaviour without balances, transaction text, income, debts, documents, goal amounts or account identifiers.
- Added deployment verification and daily operational checks for `PRIVATE_BETA`, database persistence, migrations, private storage, authentication, beta gate, critical errors, local fallback, Open Banking and live AI.
- Added incident plans, release manifest governance, initial-cohort change freeze, feedback prioritisation, first-cohort decision reporting and evidence-based expansion gates.
- Added documentation in `docs/PRIVATE_BETA_PILOT_OPERATIONS.md` and CLI coverage via `npm run beta:daily-check`.
- Open Banking remains inactive, live AI remains disabled, and no paid provider calls are part of the pilot-operations validation.

Vireon External Private Beta Deployment v1, prepared on 2026-07-24:

- Added `src/lib/externalPrivateBetaDeployment.ts` for the external `PRIVATE_BETA` architecture contract, environment-variable classification, startup fail-closed validation, deployment manifests, remote-readiness parsing, synthetic rehearsal evidence, backup/rollback evidence, monitoring evidence, first-user approval and log redaction.
- Added `npm run beta:verify-remote` to verify a real HTTPS deployment rather than local development readiness.
- Added `npm run beta:approve-first-user` to require remote verification, two-user rehearsal, negative security rehearsal, backup, rollback, monitoring, privacy/export/deletion/invitation/support evidence and explicit human approval before first-user readiness is recorded.
- Added external deployment visibility to `/production-readiness` and `/api/private-beta/operations`.
- Added `docs/EXTERNAL_PRIVATE_BETA_DEPLOYMENT.md` with deployment architecture, environment contract, database, storage, auth, email, TLS, pipeline, manifest, rehearsal, backup, rollback, monitoring, logging, privacy, owner runbook and first-user approval guidance.
- External deployment remains unverified until `npm run beta:verify-remote` passes against a real `PRIVATE_BETA` URL.
