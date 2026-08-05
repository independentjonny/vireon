# Testing

## PostgreSQL Phase 2 Slice 2

Financial Vault API persistence is covered by `__tests__/lib/financialVaultPostgresService.test.ts`.

The tests verify:

- import lifecycle state is stored through PostgreSQL-shaped `migration_runs` rows
- user B cannot list user A imports
- reused idempotency keys with different payloads are rejected
- confirmed imports create `financial_facts` and append-only `fact_versions`
- duplicate document registration does not create duplicate documents
- active Vault API routes no longer import the local JSON repository modules

These are service-boundary tests with a fake `PostgresPilotClient`; they do not connect to a live database or execute migrations.

## PostgreSQL Phase 2 Core Decisioning Domains

Core decisioning persistence is covered by `__tests__/lib/coreDecisioningPostgresService.test.ts` and production-integrity regression coverage in `__tests__/lib/productionDataIntegrity.test.ts`.

The tests verify:

- trusted server user identity is used before decision mutations
- decision status changes write PostgreSQL history instead of browser/local state
- unauthenticated mutations are rejected before SQL state writes
- active production modules are prevented from importing retired Digital Twin, Action Workflow, AI CFO, Daily Review and Goals local stores
- browser storage cannot become authoritative for converted decisioning state

These tests use fake clients and synthetic records only. They do not connect to a live database or execute migrations.

Testing should protect financial correctness, recommendation quality, and core navigation.

## Test Types

- Unit tests for calculations, scoring, parsing, and data transformations.
- Integration tests for API routes and domain engines.
- Browser smoke tests for navigation and key user workflows.
- Screenshot checks for layout regressions on dense dashboards.

## Required Coverage Areas

- Financial Vault imports and derived data.
- Decision Engine scoring and sorting.
- Evidence references.
- AI CFO missing-data behavior.
- Timeline ordering and linking.
- Digital Twin scenario calculations.
- Action Workflow execution states, outcome verification states, immutable evidence, template versioning, and realised-impact guardrails.
- Production data integrity: repository contracts, user isolation, idempotency, optimistic concurrency, audit immutability, migration safety, export/deletion boundaries, demo/live separation, production configuration fail-fast, and sensitive-log redaction.
- Private beta hardening: launch gate status, privacy-safe analytics allowlist, funnel metrics, deterministic golden fixtures, cross-engine consistency, explainability, claims wording, recovery references, performance baseline, cohort controls, feedback triage, live-AI block and Open Banking block.
- Model evaluation: synthetic fixture governance, deterministic scorers, hard-failure separation, evidence grounding, deterministic fidelity, confidence calibration, regression baselines, promotion gates and human-review requirements.
- Health score calculations.
- Navigation and mobile menu.

## Verification Before Shipping

Run the canonical validation pipeline:

```bash
npm run validate
```

`npm run validate` runs, in order:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run neven`

Run targeted browser smoke tests for changed UI flows when the change touches routing, layout, or interaction. Broaden test scope when changing shared financial calculations or navigation.

For private-beta launch readiness, run:

```bash
npm run private-beta:readiness
npm run beta:gate
```

`beta:gate` uses synthetic golden fixtures and exits non-zero when any critical private-beta gate is blocked. In `PRIVATE_BETA`, database persistence and server auth are mandatory; local JSON fallback, live AI and Open Banking block launch.

For workflow execution changes, tests must prove that checklist completion and outcome verification remain separate. Realised financial impact must be backed by verified post-action evidence, before-and-after snapshots, and deterministic recalculation. User attestation alone, unverified evidence, or a failed recalculation must not produce a `Verified` outcome.

For production data changes, tests must prove that one user cannot read or update another user's records, client payloads cannot set server-owned fields, repeated idempotent writes do not duplicate records, concurrent edits surface conflicts, failed multi-record writes roll back or persist an explicit retry-safe state, demo records never enter live repositories, exports omit secrets, account deletion is user-scoped, and production mode cannot start with unsafe local persistence fallback.

## Production Data Integrity

Repository contract tests should cover both the in-memory implementation and any PostgreSQL implementation before production rollout. The in-memory repository is the deterministic contract reference; PostgreSQL repositories must preserve the same behaviours while using server-side session-derived user identity and row-level security.

Production write endpoints require:

- authenticated server session
- idempotency key for duplicate-safe operations
- optimistic concurrency version for mutable records
- validated request schema that rejects server-owned fields
- correlation ID propagated to repository, calculation, audit and timeline records
- append-only audit event for material changes

Migration tests must include preview, schema validation, conflict detection, unsupported-field reporting, record-count/hash verification, rollback metadata, and the guardrail that lower-confidence imported facts cannot overwrite higher-confidence verified Vault facts.

Backup and recovery drills must use non-production data. A local test pass is not proof of production recovery readiness unless backup creation, restore, checksum verification and rollback have been exercised.

## PostgreSQL Pilot v1

PostgreSQL Pilot v1 is complete and frozen as Vireon's migration safety platform. It validates Supabase PostgreSQL target separation, restricted runtime-role provisioning, migration ordering/checksums, post-migration runtime access, public-schema-only backup and disposable restore rehearsal.

Required validation for any new migration:

- repository contract suite against in-memory, local and PostgreSQL adapter/harness where the application surface is implemented
- migration checksum verification
- migration apply and rerun/idempotency test against the pilot database
- application scoping and PostgreSQL RLS isolation tests after migration
- static Supabase private-beta security migration checks for `0003_supabase_private_beta_security.sql`
- transaction rollback injection suite
- concurrency tests for facts, workflows, decisions and verified outcomes
- dual-run comparison between local and PostgreSQL outputs
- database outage smoke
- JSON export verification
- synthetic account deletion
- backup creation and restore into a clean database
- post-restore repository tests

The pilot itself is no longer blocked. If a future environment lacks a separate disposable restore target or PostgreSQL client tooling, record that environment as blocked; do not treat local mocks as rollback evidence.

Canonical operator commands:

```powershell
npm run postgres:pilot:validate-targets
npm run postgres:pilot:bootstrap
npm run postgres:pilot:execute:preflight
$env:VIREON_PILOT_EXECUTE_CONFIRM = "APPLY_MIGRATIONS_TO_PILOT"
npm run postgres:pilot:execute
npm run postgres:pilot:rollback-check
```

`postgres:pilot:validate-targets` verifies that migration and restore URLs parse correctly, require SSL, derive different Supabase project references, are reachable, and that the restore target is empty or explicitly disposable. It prints only redacted metadata and exits non-zero for same-project restore targets, malformed URLs, missing SSL, unreachable targets or non-disposable restore databases. `postgres:pilot:bootstrap` verifies PostgreSQL client tools, repairs PATH for the default Windows PostgreSQL 18 location when possible, validates environment and URLs, derives the restricted application connection URL, checks DNS/connectivity, validates the restore target, provisions and verifies `vireon_app`, runs preflight and prints a PostgreSQL Pilot Health Report. `postgres:pilot:execute:preflight` is non-mutating and verifies target refs, restore disposability, migration ordering/checksums, synthetic-only mode and the restricted-role login without requiring the final execute confirmation. `postgres:pilot:execute` requires bootstrap/preflight and typed operator confirmation before applying migrations sequentially, records real checksums, reconciles runtime grants, verifies post-migration restricted-role access and runs backup/restore rehearsal. `postgres:pilot:rollback-check` verifies public-schema-only backup, managed-schema exclusion, schema_migrations preservation, restore into the separate disposable Supabase project and restricted runtime-role verification after restore.

Bootstrap is intentionally pre-migration safe. `postgres:pilot:verify-role` must not query migration-created runtime tables and must pass on an empty database when the restricted `vireon_app` role can log in, uses SSL, has safe role flags and cannot perform administrative operations. A fresh database should report `migrationStatus: MIGRATIONS_PENDING` and `postMigrationRuntimeVerification: NOT_RUN`. `postgres:pilot:execute` runs `postgres:pilot:verify-runtime-access` after migrations and must fail if required runtime objects, schema migration checksums, runtime grants, RLS ownership, append-only protections or feature-flag restrictions are missing.

Static role-provisioning tests are in `__tests__/lib/postgresPilotRoleProvisioning.test.ts`. They verify idempotent role SQL, absence of committed role passwords, restricted administrative flags, required runtime grants, prohibited grants, runtime object probes and Supabase session-pooler username expectations. They do not connect to PostgreSQL and do not apply migrations.

`__tests__/lib/supabasePrivateBetaSecurityMigration.test.ts` verifies that the additive `0003` migration enables RLS on private-beta operational tables, uses `app.current_user_id` ownership checks, keeps feature flags non-user-mutable, protects private-beta audit events as append-only, hardens the `financial-documents` storage bucket as private, and intentionally avoids browser-facing `storage.objects` policies while financial-document storage remains server-only.

Phase 2 application persistence foundation tests are in `__tests__/lib/postgresPhase2Persistence.test.ts`. They cover restricted runtime URL validation, administrative-role rejection, SSL enforcement, passwordless application URL derivation, SQL parameter binding, PostgreSQL error classification, nested diagnostic redaction, user-scoped profile writes and transactionally recorded fact versions. They use fake clients and synthetic credentials only.

## Standalone TypeScript

Use:

```bash
npm run typecheck
```

The project permits `.ts` import extensions in tests through `allowImportingTsExtensions` because `tsconfig.json` is configured with `noEmit`. This keeps standalone `tsc --noEmit` aligned with the existing test import convention.

## Unit Tests

Use:

```bash
npm run test
```

The test command uses Node's native test runner with TypeScript stripping and a local `@/*` alias loader at `scripts/ts-paths-loader.mjs`. It does not depend on `tsx` or npm registry access. In restricted Codex sandboxes, Node's per-file test worker spawning can require an unsandboxed run; treat `spawn EPERM` as a sandbox execution issue, not a product test failure.

## Model Orchestrator Validation

Use:

```bash
npm run models:diagnose
```

The diagnostics command is safe for local troubleshooting. It reports provider configuration, missing keys, registered model capabilities, policy version, circuit-breaker state and blocked task classes without printing API keys, raw prompts or raw provider responses.

The default test suite uses deterministic and mock adapters only. Paid live-provider tests must remain opt-in and must not run during normal `npm run test` or `npm run validate`.

Model Orchestrator tests should cover:

- deterministic calculations never routing to LLM providers
- sensitivity filtering
- prohibited-provider filtering
- cost and latency routing
- circuit-breaker behavior
- structured-output validation
- evidence-reference validation
- budget blocking
- no-provider and single-provider modes
- AI CFO and Autonomous Operations request mapping

## Evaluation & Trust Framework Validation

Use:

```bash
npm run models:evaluate:mock
npm run models:evaluate:regression
npm run models:evaluate:report
npm run models:evaluate:promote
npm run models:evaluate:calibration
```

Default evaluation commands use synthetic fixtures and mock/deterministic adapters only. They must not make paid provider calls or read production user data.

Live-pilot remediation review commands:

```bash
npm run models:evaluate:review:report -- --run-id=live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80
npm run models:evaluate:failures -- --run-id=live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80
npm run models:evaluate:rerun:preflight -- --run-id=live-eval-a36a09b2-704b-4871-ae12-df3f9bcb0c80
```

The rerun preflight must remain blocked until offline regression commands pass and the live OpenAI preflight is ready. A fresh paid rerun requires explicit budget and environment confirmation and must keep the same 12-fixture cap unless expansion gates pass after a clean rerun.

Live-provider evaluation is opt-in only and requires:

```bash
VIREON_LIVE_MODEL_EVALUATION=true
VIREON_SYNTHETIC_DATA_ONLY=true
VIREON_MODEL_ORCHESTRATOR_MODE=live-evaluation
```

Preflight and live-pilot commands:

```bash
npm run models:evaluate:live:preflight
npm run models:evaluate:live -- --provider=openai --model=<configured-model> --fixture-limit=12 --budget-confirmed=true
```

`models:evaluate:live:preflight` exits non-zero with `LIVE MODEL EVALUATION BLOCKED` until a non-production environment, provider key, model identifier, synthetic-only mode, fixture limit and budget limits are configured. `models:evaluate:live` also requires explicit provider, model, fixture limit and budget confirmation arguments. The initial live subset is capped at 12 fixtures and must not be presented as full benchmark validation.

On 2026-07-22 the bounded OpenAI live pilot was executed with `gpt-5.2` and 12 synthetic fixtures. The original run completed execution but is not eligible for expansion or promotion: 6 fixtures passed and 6 failed. Human review and hard-failure investigation are complete for the original run. Redacted artifacts are stored under `.vireon/model-evaluation/live/`.

Rerun v2 `live-eval-8ae0c0c2-475d-4f8a-bf1f-ec24758655f7` used `prompt-eval-live-v2` and `deterministic-scorer-v2` against the same 12 fixture versions. It completed 12 paid OpenAI requests with cost `$0.009415`, but only 4/12 fixtures passed and 9 hard failures were recorded. Human review is complete for all 12 rerun results. Full-suite expansion remains blocked.

Failure decomposition commands are offline-only:

- `npm run models:evaluate:decompose`
- `npm run models:evaluate:claims:audit`
- `npm run models:evaluate:confidence:audit`
- `npm run models:evaluate:counterfactual`
- `npm run models:evaluate:prompt:lint`
- `npm run models:evaluate:restrictions`
- `npm run models:evaluate:v3:preflight`

The v3 preflight is expected to remain blocked until hard failures, regressions and reviewer approval are resolved. It must not trigger paid provider calls.

V3 offline resolution and Stage-A readiness commands are also offline-only:

- `npm run models:evaluate:v3:failures`
- `npm run models:evaluate:v3:claims`
- `npm run models:evaluate:v3:confidence`
- `npm run models:evaluate:v3:ablation`
- `npm run models:evaluate:v3:stage-a`
- `npm run models:evaluate:v3:review`
- `npm run models:evaluate:v3:stage-a:preflight`
- `npm run models:evaluate:v3:report`

Expected current result:

- all nine v2 hard failures have final offline classifications
- all three regressions have causal traces
- prohibited-claim scorer-v3 offline corpus meets thresholds
- deterministic confidence invariants pass
- Stage-A contains exactly six fixtures
- Stage-A preflight reports `READY FOR BUDGET APPROVAL`
- paid execution remains unauthorised

Evaluation regression tests should prove:

- unmarked or real-user data is rejected
- hard failures cannot be hidden by aggregate scores
- deterministic values are mechanically checked
- LLM judges cannot override deterministic failures
- unsupported evidence references fail
- high-risk fixtures require professional-review classification
- approved prompt versions are immutable
- promotion requires human review
- confidence calibration is tracked separately from accuracy
- routing-policy errors are scored separately from output quality
- live runs cannot start without synthetic-only mode, budget limits and fixture limits
- halted live runs cannot report success
- live results cannot automatically promote a model

## Stage-A Live Validation Tests

Stage-A live validation is covered by `__tests__/lib/liveModelEvaluation.test.ts`.

The tests prove:

- Stage-A selects exactly six approved fixtures.
- Stage-A blocks without explicit budget approval.
- Stage-A requires `stage-a-task-specific-v3`.
- Stage-A requires `deterministic-scorer-v3-structured-claims-candidate`.
- Fixture cap must be exactly six.
- All executed Stage-A fixtures enter human review.
- Test execution remains synthetic and does not call a paid provider.
- Stage-A dry-runs all six budget reservations before creating a live run.
- `BUDGET_EXCEEDED` maps to `budget-exceeded`, not provider mismatch.
- Provider mismatch requires actual provider identity evidence.
- Unknown local block errors map to `internal-evaluation-error`.
- Budget-blocked records are operational records and do not count as model-quality results, calibration samples or human model-output reviews.

Use:

```bash
npm run models:evaluate:stage-a
```

In an unconfigured local shell this command must block before provider execution and write a blocked artifact under `.vireon/model-evaluation/stage-a/`.

## Neven Validation

Use:

```bash
npm run neven
```

Neven validation prints stage-level progress and timing for:

- app health
- supervisor health
- browser health before remediation
- supervisor remediation task, only when needed
- browser health after remediation, only when needed

The launcher has explicit timeouts for each stage and an overall timeout. On timeout or incomplete validation it prints `LAST_ACTIVE_STAGE`, `LAST_ACTIVE_SUBSTAGE`, elapsed time, latest successful checkpoint, remediation attempts, started child processes, port listeners where available, recent supervisor log lines, cleanup status, and `RECOMMENDED_NEXT_DIAGNOSTIC=npm run neven:diagnose`.

### Neven Remediation Architecture

The validation remediation stage is not allowed to submit a normal supervisor `/task`. A normal supervisor task can run Codex, screenshots, GPT review, build health, retries, and external model calls, so it is too broad for validation remediation.

`supervisor-remediation-task` is now bounded into four substages:

- Health check: read supervisor status, queue depth, active task and stale running tasks.
- Diagnosis: classify the browser-health failure as recoverable or fail-fast.
- Remediation: call bounded supervisor `/repair` only when there is a recoverable stale/transient condition.
- Post-remediation verification: confirm supervisor state is clean before rerunning browser health.

Recoverable examples include stale supervisor running tasks and transient server/resource failures. Unrecoverable examples include Playwright runtime unavailability, React hydration errors, malformed task definitions, missing executables, or app source errors that require code changes. Unrecoverable failures exit quickly with diagnostics instead of consuming the full stage timeout.

### Locks and Cleanup

Neven validation uses `.ai-supervisor/validation.lock.json` with:

- run ID
- owner PID
- creation time
- repo root
- stage at acquisition

The lock prevents concurrent validation and recursive remediation for the same project. A stale lock is replaced only when the owner process is gone or the lock age exceeds the configured stale threshold. Lock acquisition is atomic, so simultaneous launches do not pass through the same validation section.

Cleanup stops only child processes started by the current run. It does not kill unrelated Node, browser or PowerShell processes already running on the machine.

### Diagnostics

Use:

```bash
npm run neven:diagnose
```

This command is safe to run during troubleshooting. It reports app health, supervisor health, relevant ports, active lock state, stale task state, last task status, browser health, recent supervisor logs, and a recommended next action. It does not enqueue or modify supervisor tasks.

In restricted Codex sandboxes, Playwright browser launch may report `spawn EPERM`. Rerun `npm run neven:diagnose` or `npm run neven` with normal local process permissions before treating that as a product failure.

### Common Failure Modes

- Browser runtime unavailable: fail fast with `unrecoverable-browser-runtime`.
- React hydration mismatch: fail fast with `unrecoverable-app-hydration`; fix the app source.
- Stale supervisor task: bounded `/repair` marks stale running tasks failed and rechecks supervisor state.
- Concurrent validation: second run exits with the active lock owner and recommended diagnostic command.
- Previous CSS/static chunk 500: diagnosed as a transient browser/app resource failure, but validation no longer enqueues a coding task to fix it.
## Private Beta Pilot Operations

Use:

```bash
npm run beta:daily-check
```

The daily check is synthetic and makes no provider calls. It evaluates application health, database and migration readiness, storage/auth boundaries, beta gate status, critical errors, cross-user alerts, deletion health, local fallback, Open Banking, live AI and critical security findings.

Pilot operations regression tests are in `__tests__/lib/betaPilotOperations.test.ts`. They cover:

- invitation creation, expiration, revocation, reuse prevention, cohort assignment and capacity
- forced Open Banking and live AI restrictions
- synthetic desktop/mobile rehearsal and recovery flows
- privacy-safe support records and operations metrics
- daily-check success and critical failure conditions
- incident severity, SEV-1 cohort suspension, release manifests and rollback state
- feedback prioritisation, beta decision reporting and expansion gates
- synthetic-only fixtures, cross-user isolation, scoped export and deletion tracking

## External Private Beta Deployment

Use:

```bash
npm run beta:verify-remote -- --url=https://your-beta-domain.example
```

This command verifies the hosted app, not local development. It fails when the URL is missing, non-HTTPS, unreachable, not `PRIVATE_BETA`, using local JSON persistence, missing remote operations health, or reporting Open Banking/live AI enabled.

First real-user readiness is recorded separately:

```bash
npm run beta:approve-first-user
```

This command requires evidence files supplied through environment variables:

- `VIREON_REMOTE_VERIFICATION_REPORT`
- `VIREON_TWO_USER_REHEARSAL_REPORT`
- `VIREON_NEGATIVE_SECURITY_REHEARSAL_REPORT`
- `VIREON_BACKUP_RESTORE_REPORT`
- `VIREON_ROLLBACK_REHEARSAL_REPORT`
- `VIREON_MONITORING_REPORT`

It also requires explicit deployment facts such as privacy page deployed, export tested, deletion request tested, invitation delivery tested, support ready and `VIREON_FIRST_USER_APPROVER`.

External deployment regression tests are in `__tests__/lib/externalPrivateBetaDeployment.test.ts`. They cover required and forbidden environment variables, startup fail-closed behaviour, SSL and private-storage requirements, remote readiness success/failure, invitation email configuration, deployment manifests, two-user rehearsal evidence, negative security rehearsal evidence, backup and rollback reports, monitoring/log redaction, first-user approval gates, no real financial fixtures and no paid provider calls.
## PostgreSQL Phase 2 Slice 3

Financial Vault read-model regression coverage now includes:

- `__tests__/lib/financialPositionReadService.test.ts` for persisted read-model mapping, missing-data semantics, stale summaries and cross-user exclusion.
- `__tests__/lib/productionDataIntegrity.test.ts` checks that active production code cannot import retired Financial Vault local repositories.

The Slice 3 validation target is the standard suite:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run validate
```

No PostgreSQL Pilot bootstrap or rollback rehearsal is required for Slice 3 unless a schema migration is added.
