# AI Agent Rules

This file complements the root `AGENTS.md`. The root file remains authoritative for tooling, but this file explains how development agents should apply the product constitution.

## Before Writing Code

- Read `docs/README.md`.
- Read the domain-specific file for the task: `DECISION_ENGINE.md`, `DATA_MODEL.md`, `AI_ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, or `TESTING.md`.
- Read the relevant Next.js guide in `node_modules/next/dist/docs/` before changing Next.js app code.

## Product Decision Rules

- If a change does not improve net worth, cash flow, borrowing capacity, tax position, financial confidence, or time saved, challenge the change.
- If a page only displays data, redesign it as an AI workspace.
- If a recommendation has no evidence or confidence, it is not ready.
- If a feature duplicates calculations outside the Financial Vault, move the calculation into the Vault or a shared engine.
- If a workflow can be one click, avoid making the user manually interpret raw data.

## Implementation Rules

- Preserve existing app patterns unless there is a clear reason to introduce a new abstraction.
- Prefer typed contracts for financial data, evidence, and scoring.
- Keep UI dense but readable.
- Add or update tests when changing shared calculations, recommendation logic, or navigation.
