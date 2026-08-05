# Data Ownership

Each important Vireon entity has one canonical owner. Other modules may reference records by ID and version, but they must not independently mutate canonical facts.

| Entity | Canonical owner | May read | May request change | Mutation rule |
|---|---|---|---|---|
| Verified financial facts | Financial Vault | All deterministic engines | Document Intelligence, user confirmation, migration tooling | Only Financial Vault repositories create verified facts or change confidence. |
| Documents and extractions | Financial Vault | AI CFO, Daily Review, Decision Centre, Timeline, Workflows | Upload APIs and document jobs | Raw document payloads are stored in protected document storage; logs and audit events store hashes/metadata only. |
| Evidence | Financial Vault or Action Workflows depending on origin | Engines, Timeline, AI CFO | Upload/extraction/workflow verification | Evidence has verification status. User attestation alone cannot verify realised financial impact unless a workflow explicitly allows it. |
| Calculation snapshots | Owning deterministic engine | AI CFO, Timeline, Decisions, Workflows, Reports | Engines only | Snapshots are immutable and record engine version, input fact versions, rule versions, assumptions and output hash. |
| Digital Twin scenarios | Digital Twin | AI CFO, Housing, Goals, Reports, Timeline | User scenario editor and workflow outcomes | Scenario assumptions live in Digital Twin. Other modules reference scenario IDs and calculation snapshots. |
| Decisions | Decision Centre | AI CFO, Daily Review, Workflows, Dashboard, Timeline | Decision Engine and user lifecycle actions | Original expected impact and recommendation history are never overwritten. Revisions append history. |
| Workflow execution | Action Workflows | Dashboard, Daily Review, Decision Centre, Timeline | User actions, evidence validation, workflow engine | Execution status is separate from outcome verification status. |
| Verified workflow outcome | Action Workflows | Decision Centre, Digital Twin, Timeline, Dashboard | Outcome verification engine | Realised impact requires post-action evidence, before/after snapshots and deterministic comparison. |
| Timeline events | Timeline | All UI and AI explanation surfaces | Platform events and subsystem emitters | Timeline stores immutable historical references and before/after values, not mutable source-of-truth copies. |
| AI CFO questions and answers | AI CFO | User, Timeline, Decision Centre | AI CFO orchestrator | AI CFO owns grounded snapshots and briefs, not tax, borrowing, retirement or other deterministic calculations. |
| Daily Reviews | Daily Review | Dashboard, AI CFO, Decision Centre, Timeline | Daily Review engine | Findings are deterministic snapshots. GPT may summarise but cannot create, remove or alter findings. |
| Tax rule references | Rule Provenance | Structure Optimiser, AI CFO, Timeline | Rule ingestion/review process | GPT cannot create rules, change rates, remove stale-rule warnings or reclassify calculations. |
| Goals | Goals | Digital Twin, Daily Review, Dashboard, Timeline | User goal editor and verified workflow outcomes | Goal progress is calculated from Vault facts and scenario outputs; no duplicate progress owner. |
| User preferences | User Preferences | UI and notification systems | Authenticated user settings API | Preferences are not financial facts and must not alter verified data. |
| Model runs and routing decisions | Model Orchestrator | Developer diagnostics, AI CFO, Autonomous Operations audit surfaces | Model Orchestrator only | Stores hashes/references, routing reasons, validation reports, cost and latency. Raw prompts and responses are off by default. |
| Evaluation fixtures, runs and promotion decisions | Evaluation & Trust Framework | Developer diagnostics and approved reviewers | Evaluation runner and human review process | Uses synthetic or explicitly approved fixtures. Evaluation records cannot mutate model policy, preferred model config or financial facts directly. |
| Live model evaluation pilot records | Evaluation & Trust Framework | Model Orchestrator, Developer diagnostics, approved human reviewers | Live evaluation runner | Stores synthetic fixture references, prompt hashes, routing outcomes, validation reports, cost, latency, halt reasons and review queue items. It does not own financial facts, verified outcomes, model promotion state or production monitoring. |

## Mutation Boundary

- Business engines depend on repository interfaces, not browser storage, raw database clients or filesystem paths.
- API payload schemas reject server-owned fields such as `user_id`, `verified`, `realisedImpact`, calculation outputs, evidence approval, immutable audit fields and professional-review completion.
- Model outputs are treated as proposals or explanations. They cannot mutate verified facts, realised impact, audit history, timeline history, calculation snapshots or professional-review flags.
- User identity is derived from the authenticated server session, never from a client-provided user ID.
- Every mutable record uses optimistic concurrency through `version`.
- Immutable records are corrected by superseding events, never by destructive updates.

## Closed-Loop Ownership

The production loop is:

Fact -> insight -> decision -> workflow -> action -> evidence -> verified outcome -> updated Financial Vault -> recalculated Digital Twin -> revised decisions -> Timeline.

No module should skip this loop by mutating another module's canonical data directly.

## PostgreSQL Pilot Boundary

The PostgreSQL pilot repository boundary currently owns persistence only for:

- Financial Vault facts and evidence
- Decisions and decision history
- Action Workflow execution, evidence and outcome verification
- Timeline events
- Calculation snapshots

AI CFO, Daily Review, Digital Twin, Housing, Goals, Investments and Reports must continue using existing adapters until explicit migration work assigns PostgreSQL ownership and passes the pilot readiness gates. No module may use the PostgreSQL pilot as a backdoor to mutate another module's canonical data.

## Live Model Evaluation Boundary

Live model evaluation is not a production data owner. It may transmit only marked synthetic fixtures through the Model Orchestrator after preflight passes. It stores hashes and structured evaluation metadata, not raw prompts, raw responses, real-user financial data, credentials, calculation snapshots owned by other modules, or verified financial facts.
