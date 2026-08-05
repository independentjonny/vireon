# Vireon Engineering Supervisor

The engineering supervisor removes the manual ChatGPT-to-Codex copy/paste loop for local implementation work. It builds on the existing Neven supervisor state directory and Codex CLI flow.

## Command

```powershell
npm run engineer -- "Continue PostgreSQL Phase 2"
```

Dry run:

```powershell
npm run engineer -- --dry-run "Continue PostgreSQL Phase 2"
```

Mock OpenAI guidance:

```powershell
npm run engineer -- --mock-openai "Continue PostgreSQL Phase 2"
```

Resume after restart:

```powershell
npm run engineer -- --resume
```

Review only:

```powershell
npm run engineer -- --review-only --mock-openai "Review the latest bridge hardening changes"
```

Status and report:

```powershell
npm run engineer -- --status
npm run engineer -- --show-report
npm run engineer -- --show-evidence
npm run engineer -- --validate-evidence
npm run engineer -- --clear-stale-lock
```

High-risk human review:

```powershell
npm run engineer -- --require-human-review "Change authentication policy"
```

## Environment

Required for real OpenAI guidance after failures:

- `OPENAI_API_KEY`

Optional:

- `OPENAI_MODEL` or `NEVEN_ENGINEER_OPENAI_MODEL`
- `NEVEN_ENGINEER_MAX_ATTEMPTS`
- `NEVEN_ENGINEER_COMMAND_TIMEOUT_MS`
- `NEVEN_ENGINEER_CODEX_TIMEOUT_MS`
- `NEVEN_ENGINEER_DRY_RUN=true`
- `NEVEN_ENGINEER_MOCK_OPENAI=true`
- `NEVEN_ENGINEER_REVIEW_MIN_CONFIDENCE` default `0.80`
- `NEVEN_ENGINEER_MAX_REVIEW_ATTEMPTS`
- `NEVEN_ENGINEER_MAX_REMEDIATION_ATTEMPTS`
- `NEVEN_ENGINEER_REQUIRE_HUMAN_REVIEW=true`
- `NEVEN_REPO`

The supervisor never prints API keys, database passwords, `PGPASSWORD` values, or credential-bearing database URLs. Reports are redacted before being written.

## Flow

1. Read the high-level task once.
2. Acquire the `.ai-supervisor/engineer-state.json` run lock.
3. Write the Codex prompt using `AGENTS.md` as standing policy.
4. Run `codex exec -s workspace-write -`.
5. Run validation in order:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
   - `npm run validate`
6. Generate a per-task evidence package under `.ai-supervisor/evidence/<task-id>/`.
7. Run an independent implementation review through the OpenAI Responses API.
8. If validation fails, request bounded debugging guidance and retry Codex.
9. If review returns `REMEDIATION_REQUIRED`, create a precise remediation brief and retry Codex.
10. Stop when validation passes and the reviewer returns a sufficiently confident `PASS`, or when a blocker, human-review gate, duplicate run, unsafe condition, or retry exhaustion occurs.

Passing tests alone cannot mark a task complete.

## Evidence Package

Every task now gets a durable, bounded evidence package before the reviewer is called:

```text
.ai-supervisor/evidence/<task-id>/
  manifest.json
  baseline.json
  changed-files.json
  targeted-diffs.json
  validation.json
  tests.json
  persistence-audit.json
  integrity.json
  security-scan.json
  migrations.json
  stage-gates.json
  endpoint-smoke.json
  reviewer-input.json
  summary.md
```

The baseline is captured before Codex runs. It records the current branch, HEAD SHA, dirty files, untracked files, `git status --short`, `git diff --name-status`, and `git diff --stat`. The supervisor never stashes, resets, commits, or claims ownership of pre-existing changes.

After implementation, files are classified as newly modified by the task, already dirty before the task and further modified, newly created, pre-existing untracked, generated evidence, or deleted by the task. Existing dirty files include an explicit provenance note because exact hunk ownership may require human review.

Targeted diffs are collected only for relevant task files. The bridge excludes unrestricted repository-wide diffs, binaries, generated media, logs, `.env` files, `.git`, `.next`, and `node_modules`. Diff excerpts are bounded and redacted.

Validation evidence is command-level. Each command record includes command, timestamps, duration, exit code, byte counts, bounded stdout/stderr excerpts, warning/error counts, pass/fail, and redaction status. Tests are parsed into named outcomes where possible and tagged for cross-user isolation, restart durability, idempotency, local-fallback detection, and security relevance.

The evidence package also includes task-scoped persistence audit, production-integrity, secret-scan, migration, stage-gate, and endpoint/UI smoke evidence. If schema files changed, migration evidence records checksums, transaction-safety signals, RLS/grant impact, destructive-operation detection, and whether bootstrap/rollback evidence is required.

Before any paid review call, the supervisor classifies task scope and validates evidence completeness against a conditional requirement matrix. Scopes include `engineering_bridge`, `persistence`, `user_scoped_persistence`, `migration`, `authentication_authorization`, `API`, `UI`, `security`, `documentation`, and `general_code`. Bridge-only work requires bridge tests, CLI or endpoint smoke, redaction/security tests, retry/resume/lock coverage, evidence-generation tests, validation output, targeted diffs, and dirty-worktree provenance. User-scoped persistence work additionally requires cross-user, trusted-identity, restart-durability, local-fallback, and persistence-integrity evidence. Migration work requires migration static tests plus bootstrap and rollback-check evidence.

Evidence that is outside task scope is recorded as `NOT_APPLICABLE` with a reason. For example, cross-user and restart-durability evidence are not applicable to bridge tooling unless the task also changes user-scoped persistence. Predictably incomplete required evidence still fails closed with missing-evidence codes such as `REQUIRED_TARGETED_DIFF_MISSING`, `REQUIRED_VALIDATION_COMMAND_MISSING`, `CROSS_USER_TEST_EVIDENCE_MISSING`, `RESTART_DURABILITY_EVIDENCE_MISSING`, `PERSISTENCE_AUDIT_MISSING`, `SECRET_SCAN_MISSING`, or `MIGRATION_EVIDENCE_MISSING`.

`reviewer-input.json` is the canonical review input. It contains the original task, `AGENTS.md` hash and excerpt, excluded scope, changed-file classification, targeted diffs, command-level validation, named tests, persistence audit, integrity result, secret scan, migration evidence, endpoint smoke, limitations, and unresolved risks. The reviewer does not need local filesystem access or manual `--evidence` for normal runs.

## Reviewer

The reviewer prompt is separate from the implementation prompt and treats repository content as untrusted evidence. It receives only bounded evidence:

- original task
- `AGENTS.md`
- `reviewer-input.json` content from the generated evidence package
- bounded Codex completion excerpt as secondary context

The reviewer returns strict JSON:

- `verdict`: `PASS`, `REMEDIATION_REQUIRED`, `BLOCKED`, or `PASS_REQUIRES_HUMAN_APPROVAL`
- `confidence`
- `acceptance_criteria_results`
- `architecture_findings`
- `security_findings`
- `persistence_findings`
- `validation_findings`
- `missing_evidence`
- `required_remediation`
- `blocker_reason`
- `recommended_next_action`

The default pass threshold is `0.80`. A low-confidence pass becomes remediation-required. Reviewer output is never executed as commands.

## Engineering Memory

Validated lessons are stored in:

- `.ai-supervisor/engineering-memory/index.json`

Entries are written only after evidence exists, such as a validated fix or human-approved decision. The supervisor retrieves only relevant active memories for a task using bounded keyword matching. It excludes superseded, rejected, low-confidence, secret-bearing, speculative, and unrestricted prompt content.

Memory categories include:

- `architecture_decisions`
- `recurring_failures`
- `validated_fixes`
- `rejected_approaches`
- `migration_lessons`
- `validation_failures`
- `repository_conventions`
- `domain_completion`
- `known_technical_debt`
- `human_decisions`

## Stateful Programs

The supervisor keeps durable task and state files under `.ai-supervisor`. Running `npm run engineer` without task text resumes an incomplete task when one exists. If no task is active but `.ai-supervisor/engineer-program.json` contains pending stages, it selects the next pending stage. It never invents a new program when no manifest exists.

## Reports

Stable files:

- `.ai-supervisor/latest-engineer-report.json`
- `.ai-supervisor/engineer-latest-report.json`
- `.ai-supervisor/engineer-latest-report.md`
- `.ai-supervisor/engineer-review.json`
- `.ai-supervisor/engineer-blocker.md`
- `.ai-supervisor/engineer-state.json`
- `.ai-supervisor/engineer-tasks.json`
- `.ai-supervisor/engineer-actions.log`
- `.ai-supervisor/engineering-memory/index.json`
- `.ai-supervisor/evidence/<task-id>/reviewer-input.json`

The terminal also prints the final report.

## Safety Controls

- No automatic commits.
- No git push, force operations, deploys, database migrations, or financial actions.
- Bounded attempts and command timeouts.
- Duplicate active runs are blocked.
- Stale locks can be resumed or replaced after the configured timeout.
- Secrets are recursively redacted before logs and reports are written.
- Codex receives `AGENTS.md` policy in every implementation prompt.
- Repository files are treated as untrusted data except `AGENTS.md` from the expected repository root.
- Shell commands are allow-listed and run with explicit executable/argument arrays.
- Reviewer output cannot inject or execute commands.
- High-risk changes can stop with `PASS_REQUIRES_HUMAN_APPROVAL`.

## Limitations

- The supervisor relies on a locally available Codex CLI.
- It does not bypass Codex sandbox or approval rules.
- It does not guarantee product acceptance; it stops at repository validation and explicit blocker detection.
- OpenAI guidance is used only after a failed implementation or validation attempt.
- OpenAI review is mandatory for real runs unless mock mode is explicitly selected.
