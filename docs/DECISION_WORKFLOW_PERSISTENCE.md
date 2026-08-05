# Decision And Workflow Persistence

Status: CORE DECISIONING DOMAIN COMPLETE

Target tables:

- `decisions`
- `decision_history`
- `workflows`
- `workflow_steps`
- `workflow_evidence`
- `workflow_outcomes`
- `idempotency_keys`
- `calculation_snapshots`
- `audit_events`

Decision history and audit history are append-only. Workflow mutations must be idempotent where duplicate submissions could create duplicate workflows, steps or outcomes.

Decision Centre and Action Workflows must stay synchronized through transactions and explicit state transitions.

Implemented boundary:

- `/api/decisions` persists lifecycle state in `decisions` and writes append-only transition rows to `decision_history`.
- Decision Centre UI state is no longer stored in browser `localStorage`; updates are applied only after the PostgreSQL mutation succeeds.
- `/api/action-workflows` persists workflow executions, steps, evidence and outcomes in `workflows`, `workflow_steps`, `workflow_evidence` and `workflow_outcomes`.
- Workflow evidence is normalized into `evidence` once per save and linked to both `workflow_evidence` and outcome rows by persisted evidence IDs.
- Dashboard and Insights pages read decision/workflow state from the same PostgreSQL service as the dedicated pages.
- Active app/server code no longer imports `actionWorkflowStore`; that legacy module is retained only for test/demo isolation.

Transaction boundaries:

- decision status update plus history entry
- workflow save plus step reconciliation
- workflow evidence mutation plus refreshed workflow state
- outcome verification plus workflow outcome persistence with deterministic application IDs

Known limitation:

- Full workflow idempotency-key reservation is implemented at the service boundary where duplicate-prone APIs expose a key; legacy UI buttons currently rely on deterministic application IDs and upsert behavior.
