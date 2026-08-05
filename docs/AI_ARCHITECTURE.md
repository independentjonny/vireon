# AI Architecture

Vireon's AI must be Vault-grounded, evidence-backed, and action-oriented. Generic financial chat is not acceptable when verified user context exists.

## Main AI Systems

- My AI CFO: conversational decision support using Financial Vault context.
- AI Decision Engine: ranks and explains opportunities by expected financial value.
- Document Intelligence Engine: extracts structured data, confidence, and citations from uploaded documents.
- Proactive AI: detects important changes and proposes workflows without waiting for the user.
- Digital Twin: simulates future financial scenarios.

## Context Pipeline

1. Identify the user's question or workflow.
2. Retrieve relevant Vault records.
3. Retrieve derived metrics from domain engines.
4. Retrieve timeline events and prior decisions.
5. Identify missing or stale data.
6. Generate an answer with evidence, assumptions, confidence, and next action.

## Model Orchestrator Boundary

All AI-facing business modules must use the provider-neutral Model Orchestrator described in `docs/MODEL_ORCHESTRATOR.md`. Modules submit typed `ModelTaskRequest` records and receive validated `ModelTaskResult` records.

Direct provider SDK calls from AI CFO, Daily Review, Autonomous Operations, Timeline, Workflows or future financial modules are not allowed. The orchestrator owns provider capability matching, sensitivity policy, cost limits, circuit-breaker state, fallback rules, structured-output validation and model-run audit records.

Deterministic Vireon engines remain authoritative. GPT and other model providers may explain, summarise, critique, draft and organise supplied results, but they must not calculate tax, borrowing, retirement, net worth, capital gains, realised impact, workflow verification or financial health scores.

## AI CFO Answer Template

Every answer should include:

- Direct answer.
- Expected financial impact.
- Evidence.
- Confidence.
- Assumptions.
- Risks.
- Alternative options.
- Next action.
- Missing data, if any.

## Confidence Scoring

Confidence should reflect:

- Source quality.
- Recency.
- Completeness.
- Agreement between sources.
- Model uncertainty.
- Sensitivity to assumptions.

## Evaluation and Trust

AI output quality is measured by the Evaluation & Trust Framework described in `docs/EVALUATION_TRUST_FRAMEWORK.md`. The framework evaluates model, prompt, routing-policy and worker changes using synthetic fixtures by default.

Evaluation must measure evidence grounding, deterministic-output fidelity, unsupported claims, safety, policy compliance, confidence calibration, professional-review handling, cost and latency. A model cannot become preferred merely because the writing is clearer if evidence grounding, deterministic fidelity or safety regresses.

Live Model Evaluation Pilot v1 validates one configured provider and model through the Model Orchestrator using a bounded synthetic fixture subset. It requires explicit live-evaluation flags, synthetic-only mode, an identified non-production environment, fixture and cost limits, raw prompt logging off, raw response storage off and human review before promotion. The pilot may evaluate provider behaviour; it cannot execute financial actions, change preferred-model state automatically, or use real-user financial data.

## Prompting Rules

- Do not answer from general knowledge when Vault data is needed.
- If context is missing, ask for or create the most valuable Vault completion action.
- Use conservative financial language.
- Do not imply lender approval, tax advice, legal advice, or guaranteed outcomes.
