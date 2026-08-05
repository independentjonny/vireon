# AI CFO Persistence

Status: CORE DECISIONING DOMAIN COMPLETE

Target tables:

- `ai_cfo_questions`
- `ai_cfo_answers`
- `calculation_snapshots`
- `decisions`
- `evidence`
- `audit_events`

The AI CFO may explain deterministic outputs, but it must not invent forecast inputs, mutate deterministic values, overwrite facts or persist hidden chain-of-thought.

Persist only final answers, concise user-facing rationale, grounding references, warnings and structured orchestration metadata.

Implemented boundary:

- `/api/ai-cfo` persists each question in `ai_cfo_questions` and the final answer plus safe orchestration metadata in `ai_cfo_answers`, linked to an AI CFO `calculation_snapshots` row.
- AI CFO context is built from the PostgreSQL-backed Financial Vault read model and persisted decisioning service inputs.
- Material deterministic values remain owned by Financial Vault facts and calculation snapshots.
- Hidden chain-of-thought is not persisted.
- Active app/server code no longer imports `aiCfoStore`; that legacy module is retained only for test/demo isolation.

Grounding policy:

- Answer payloads retain user-visible evidence and calculation snapshot references supplied by the deterministic AI CFO orchestration layer; the answer row also links to the persisted grounding snapshot.
- AI-created decisions remain distinguishable from deterministic decisions by payload/source metadata and require explicit user action before workflow conversion.

Known limitation:

- Live AI remains disabled. The persistence layer stores deterministic/offline AI CFO outputs and safe metadata; it does not enable provider calls.
