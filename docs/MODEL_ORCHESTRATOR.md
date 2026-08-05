# Model Orchestrator

Model Orchestrator v1 is Vireon's provider-neutral AI execution boundary. Business modules submit typed `ModelTaskRequest` records and receive validated `ModelTaskResult` records. They do not call OpenAI, Anthropic, Gemini or provider SDKs directly.

## Modules

- `src/lib/modelOrchestrator/types.ts`: canonical task, result, provider, routing and audit types.
- `src/lib/modelOrchestrator/registry.ts`: explicit provider/model capability registry from environment configuration.
- `src/lib/modelOrchestrator/router.ts`: deterministic routing decision with accepted and rejected candidates.
- `src/lib/modelOrchestrator/policy.ts`: sensitivity, deterministic-engine, fallback and review policy.
- `src/lib/modelOrchestrator/executor.ts`: prompt-envelope assembly, routing, budget enforcement, provider execution, validation and run persistence.
- `src/lib/modelOrchestrator/validator.ts`: JSON-schema-compatible output validation and financial guardrails.
- `src/lib/modelOrchestrator/providers/*`: normalized provider adapters. Commercial adapters are disabled-safe until live provider integration is explicitly enabled.

## Guardrails

- Deterministic calculations route only to the deterministic Vireon adapter.
- LLM output cannot alter verified facts, realised impact, audit history, timeline history or calculation snapshots.
- Non-conversational tasks require runtime validation against an internal schema.
- Financial-sensitive data may route only to models explicitly approved for that sensitivity.
- Raw prompts and raw responses are not stored by default.
- Cross-provider fallback is disabled by default and can never weaken sensitivity or deterministic requirements.

## Integrations

- AI CFO uses `createAICfoModelTaskRequest` to package deterministic outputs and evidence for explanation.
- Autonomous Operations uses `createAutonomousWorkerModelTaskRequest` so workers declare capability, sensitivity, risk, schema and approval requirements without naming providers.
- `/model-orchestrator` provides a developer-only diagnostics workspace with provider cards, routing matrix, recent policy status and synthetic task console.

## Current Scope

v1 is locally validated with deterministic and mock adapters. Live commercial-provider calls, independent live review, production privacy approvals and provider evaluations remain rollout work.

## Evaluation Boundary

Model Orchestrator outputs are evaluated by the provider-neutral Evaluation & Trust Framework in `src/lib/modelEvaluation/`. The evaluator submits `ModelTaskRequest` records through the orchestrator, scores the returned `ModelTaskResult`, and records routing-policy, evidence-grounding, deterministic-fidelity, cost, latency, hard-failure and calibration metrics.

Evaluation code must not import provider SDKs directly. Default evaluation uses mock and deterministic adapters only.
