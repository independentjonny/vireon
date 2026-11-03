# Vireon outcome verification

Applies to every task, including UI mockups and direct chats. Read AGENTS.md first.

## Workflow

1. Record the current request and corrections as observable criteria in `.ai/verification-task.json` before implementation. Do not overwrite another active task's plan: pass a separate path to `npm run verify:outcome -- path/to/plan.json` when tasks overlap.
2. Implement the task. Write checks that inspect behaviour or the final artifact, not checks that merely repeat the implementation. Plan commands are trusted local executable code: review them before running an unfamiliar plan.
3. Run `npm run verify:outcome`. The gate executes commands directly without a shell. Use `node` for scripts; on Windows invoke npm through its Node CLI if necessary. Each command must produce its evidence under ignored `.verification/`. Do not put secrets or production financial records in logs.
4. Inspect the final artifact. For UI, use checks with roles `render`, `visual-review`, `geometry`, and `interaction`. Render screenshots at desktop and mobile widths, review those exact screenshots, and measure relevant layout constraints. A visual-review command must actually review the screenshots and exit nonzero for failure/unavailable review; a success stub is not a review.
5. Run `npm run completion:check`. Reference `.verification/latest.json` and relevant screenshots/logs in the completion report. Any subsequent source or evidence change requires rerunning verification.

## Plan shape

```json
{
  "task": "Exact task goal",
  "kind": "code",
  "criteria": [{ "id": "C1", "description": "Observable expected behaviour" }],
  "checks": [{
    "id": "behaviour",
    "criteria": ["C1"],
    "role": "test",
    "program": "node",
    "args": ["scripts/task-specific-verification.mjs"],
    "evidence": [".verification/behaviour.json"]
  }]
}
```

This is a schema example, not a runnable or passing task. Use `ui` for UI tasks and `artifact` for other deliverables. Every criterion must be covered. Check IDs must be unique. Screenshots, assertion reports and review findings must be fresh files, not copied historical evidence.

## Enforcement and limits

The gate rejects missing plans/results, failed/timed-out commands, uncovered criteria, missing/stale/modified evidence, source edits after verification, and a receipt for a different supervisor goal. Its fingerprint covers Git-tracked and non-ignored untracked files, including deletions. It does not cover ignored runtime settings, external services or databases; include explicit task checks for those outcomes. Recheck the target environment when claiming deployment.

Both real Neven supervisor completion paths consult the gate; engineer dry-run/mock modes remain simulations. A skipped GPT implementation reviewer is no longer accepted by the UI supervisor. Existing reviewer requirements still apply.

This gate is not an independent authority over chat output. A direct chat can ignore instructions, an agent can write inadequate checks, and files can be forged. A passing receipt proves the configured checks ran against an unchanged source snapshot, not that every subjective design judgment is correct. No product-wide chat interception, refund, deployment, or account reset is part of this change.
