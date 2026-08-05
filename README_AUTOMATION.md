# Vireon local automation

This patched build adds local automation and full-page screenshot capture.

## Commands

```powershell
npm run dev
npm run screenshot
npm run automate
npm run daemon
npm run engineer -- "Task"
```

## Screenshot output

Full-page screenshots are saved to both:

- `screenshot/`
- `.ai/screenshots/`

The app also exposes a screenshot status panel and `/api/runtime/screenshots`.

## Automation

`npm run automate` runs:

1. lint
2. build
3. Playwright smoke tests
4. full-page screenshot capture
5. report writing to `.ai/claude-report.json` and `.ai/final-green-report.json`

`npm run daemon` watches `.ai/tasks/current-task.md`, prevents duplicate processing, limits retry attempts, handles quota/rate-limit pauses safely, and writes status into `.ai/daemon-state.json`.

## Engineering supervisor

`npm run engineer -- "Task"` is the supported bridge from one high-level engineering request to Codex implementation, validation, independent review and bounded remediation.

Useful modes:

```powershell
npm run engineer -- --dry-run --mock-openai "Task"
npm run engineer -- --review-only --mock-openai "Task"
npm run engineer -- --resume
npm run engineer -- --status
npm run engineer -- --show-report
npm run engineer -- --show-evidence
npm run engineer -- --validate-evidence
npm run engineer -- --require-human-review "High-risk task"
```

Reports are written to `.ai-supervisor/engineer-latest-report.json` and `.ai-supervisor/engineer-latest-report.md`. Engineering memory is stored in `.ai-supervisor/engineering-memory/index.json`.

Each engineer task also writes a review evidence package to `.ai-supervisor/evidence/<task-id>/`. The package includes baseline worktree state, changed-file provenance, targeted diffs, command-level validation output, named test evidence, persistence audit, production-integrity evidence, secret-scan evidence, migration evidence, stage gates, endpoint smoke inventory and the canonical `reviewer-input.json`. Normal runs attach this package automatically; `--evidence` is only for special manual review cases.

The bridge does not commit, push, deploy, run migrations, perform financial actions, or execute reviewer-supplied commands. It requires a reviewer `PASS` with sufficient confidence before marking a task complete.

## Notes

Supabase, database, and OpenAI keys remain optional for local mode. They are treated as production integrations, not hard local blockers.
