# Neven local automation

This patched build adds local automation and full-page screenshot capture.

## Commands

```powershell
npm run dev
npm run screenshot
npm run automate
npm run daemon
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

## Notes

Supabase, database, and OpenAI keys remain optional for local mode. They are treated as production integrations, not hard local blockers.
