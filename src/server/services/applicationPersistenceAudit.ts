export type PersistenceStatus =
  | "POSTGRES_BACKED"
  | "POSTGRES_FOUNDATION_READY"
  | "LOCAL_FILE_BACKED"
  | "IN_MEMORY"
  | "BROWSER_STORAGE"
  | "DEMO_OR_TEST_ONLY"
  | "OPERATIONAL_LOCAL";

export type ApiPersistenceMatrixRow = {
  route: string;
  status: PersistenceStatus;
  authoritativeState: boolean;
  target: string;
  phase2Action: string;
};

export type DomainPersistenceStageStatus =
  | "VERIFIED_COMPLETE"
  | "CORE_DOMAIN_CONVERTED"
  | "OPEN_GAP"
  | "REQUIRES_HUMAN_APPROVAL"
  | "OPERATIONAL_ONLY";

export type DomainPersistenceAuditRow = {
  domain: string;
  activeApis: string[];
  activeUi: string[];
  currentAuthority: string;
  targetAuthority: string;
  schemaAvailable: boolean;
  schemaGap: string;
  migrationRequired: boolean;
  localPathToRetire: string[];
  transactionBoundaries: string;
  idempotencyNeeds: string;
  concurrencyRisks: string;
  restartTests: string[];
  crossUserTests: string[];
  stageStatus: DomainPersistenceStageStatus;
  blocker: string | null;
};

export const STAGE_1_AUDIT_EVIDENCE = {
  refreshedAt: "2026-08-02",
  sourceBrief: ".ai/tasks/VIREON_SUPER_BIG_BANG.md",
  activeProgramManifest: ".ai-supervisor/engineer-program.json",
  routeCount: 111,
  pageCount: 33,
  appComponentCount: 33,
  serverServiceCount: 5,
  serverRepositoryCount: 1,
  sqlMigrationCount: 6,
  schemaChangesPerformed: true,
  migrationsExecuted: true,
  deploymentPerformed: false,
  financialActionsPerformed: false,
  independentReviewPath: "Product-mode Stage 10 only; no inter-stage Neven review required.",
} as const;

export const API_PERSISTENCE_MATRIX: ApiPersistenceMatrixRow[] = [
  { route: "/api/financial-vault", status: "POSTGRES_BACKED", authoritativeState: true, target: "financial_profiles, financial_facts, documents, document_extractions, evidence, idempotency_keys", phase2Action: "Converted in Slice 2; continue fact-history UI surfacing." },
  { route: "/api/financial-vault/imports", status: "POSTGRES_BACKED", authoritativeState: true, target: "financial_facts, fact_versions, evidence, documents, migration_runs, idempotency_keys", phase2Action: "Converted in Slice 2; preserve confirmed-only trust rules." },
  { route: "/api/financial-forecast", status: "POSTGRES_BACKED", authoritativeState: true, target: "digital_twin_scenarios, simulation_runs, calculation_snapshots", phase2Action: "Converted in private-beta activation hardening Stage A; deterministic forecasts use persisted Vault inputs and persist snapshots/scenarios without local fallback." },
  { route: "/api/digital-twin", status: "POSTGRES_BACKED", authoritativeState: true, target: "digital_twin_scenarios, simulation_runs, timeline_events, calculation_snapshots", phase2Action: "Converted in constrained core-domain program; scenarios and runs use persisted Vault facts." },
  { route: "/api/decisions", status: "POSTGRES_BACKED", authoritativeState: true, target: "decisions, decision_history, calculation_snapshots, evidence", phase2Action: "Converted in constrained core-domain program; lifecycle state and history are durable." },
  { route: "/api/goals", status: "POSTGRES_BACKED", authoritativeState: true, target: "goals, timeline_events, calculation_snapshots, decisions", phase2Action: "Converted in constrained core-domain program; goal state and scenarios are durable." },
  { route: "/api/action-workflows", status: "POSTGRES_BACKED", authoritativeState: true, target: "workflows, workflow_steps, workflow_evidence, workflow_outcomes, idempotency_keys", phase2Action: "Converted in constrained core-domain program; workflow lifecycle, evidence and outcomes are durable." },
  { route: "/api/ai-cfo", status: "POSTGRES_BACKED", authoritativeState: true, target: "ai_cfo_questions, ai_cfo_answers, calculation_snapshots, decisions, evidence", phase2Action: "Converted in constrained core-domain program; bounded conversation history and grounding metadata persist." },
  { route: "/api/ai-cfo/daily-review", status: "POSTGRES_BACKED", authoritativeState: true, target: "daily_reviews, calculation_snapshots, decisions, user_preferences", phase2Action: "Converted in constrained core-domain program; review rows link to deterministic calculation snapshots." },
  { route: "/api/private-beta/*", status: "POSTGRES_FOUNDATION_READY", authoritativeState: true, target: "private_beta_* tables", phase2Action: "Briefing/export Vault inputs converted to PostgreSQL read model in Slice 3; wire private-beta runtime repositories later." },
  { route: "/api/model-evaluation/*", status: "DEMO_OR_TEST_ONLY", authoritativeState: false, target: "Evaluation artifacts", phase2Action: "Leave frozen evaluation artifacts unchanged." },
  { route: "/api/runtime/*", status: "OPERATIONAL_LOCAL", authoritativeState: false, target: "Developer operations files", phase2Action: "Keep separate from user financial persistence." },
  { route: "/api/transactions", status: "POSTGRES_BACKED", authoritativeState: true, target: "user_transactions, user_transaction_imports", phase2Action: "Converted in application-wide completion program; no local transaction JSON fallback." },
  { route: "/api/ingest", status: "POSTGRES_BACKED", authoritativeState: true, target: "user_transaction_imports, user_transactions, user_subscriptions, idempotency_keys", phase2Action: "Converted in application-wide completion program; imports are idempotent and fail closed when PostgreSQL is unavailable." },
  { route: "/api/subscriptions", status: "POSTGRES_BACKED", authoritativeState: true, target: "user_subscriptions, idempotency_keys", phase2Action: "Converted in application-wide completion program; no local subscription JSON fallback." },
  { route: "/api/subscriptions/intelligence", status: "POSTGRES_BACKED", authoritativeState: true, target: "user_subscriptions", phase2Action: "Converted in application-wide completion program; intelligence is derived from persisted subscription rows." },
  { route: "/api/housing-scenarios", status: "POSTGRES_BACKED", authoritativeState: true, target: "timeline_events and calculation_snapshots", phase2Action: "Converted in final product remediation; local housing store retained only for legacy test/demo isolation." },
  { route: "/api/copilot-history", status: "POSTGRES_BACKED", authoritativeState: true, target: "ai_cfo_questions, ai_cfo_answers", phase2Action: "Legacy Copilot history is imported as non-authoritative AI CFO history in PostgreSQL; no copilot-history.json fallback." },
  { route: "/api/memory", status: "DEMO_OR_TEST_ONLY", authoritativeState: false, target: "Disabled legacy endpoint; user-visible AI CFO history remains PostgreSQL-backed", phase2Action: "Disabled in private-beta activation hardening Stage B to prevent hidden process-memory authority." },
  { route: "/api/telemetry", status: "OPERATIONAL_LOCAL", authoritativeState: false, target: "observability sink plus audit_events for regulated actions", phase2Action: "Open observability gap; retain as operational local until scoped." },
  { route: "/api/logs/ingest", status: "OPERATIONAL_LOCAL", authoritativeState: false, target: "observability sink", phase2Action: "Open observability gap; not product financial authority." },
  { route: "/api/local-data/status", status: "OPERATIONAL_LOCAL", authoritativeState: false, target: "diagnostics only", phase2Action: "Keep diagnostic-only; never expose as production authority." },
  { route: "/api/private-beta/export", status: "POSTGRES_BACKED", authoritativeState: true, target: "data_exports, background_jobs, audit_events", phase2Action: "Converted in private-beta activation hardening Stage E; export requests are durable lifecycle rows and no longer direct local JSON downloads." },
  { route: "/api/private-beta/deletion", status: "POSTGRES_BACKED", authoritativeState: true, target: "account_deletion_requests, background_jobs, audit_events", phase2Action: "Converted in private-beta activation hardening Stage F; deletion is durable synthetic lifecycle only and real deletion remains human-approved." },
  { route: "/api/backup/export", status: "OPERATIONAL_LOCAL", authoritativeState: false, target: "Disabled application route; PostgreSQL operator backup procedure only", phase2Action: "Disabled in private-beta activation hardening Stage C to separate operational backups from user data export." },
  { route: "/api/build-*", status: "OPERATIONAL_LOCAL", authoritativeState: false, target: "background_jobs only for product jobs", phase2Action: "Requires human approval before general background-worker platform work." },
  { route: "/api/autonomous-*", status: "OPERATIONAL_LOCAL", authoritativeState: false, target: "background_jobs only for product jobs", phase2Action: "Operational local; do not fold into product persistence without approval." },
];

export const DOMAIN_PERSISTENCE_AUDIT: DomainPersistenceAuditRow[] = [
  {
    domain: "Financial Vault",
    activeApis: ["/api/financial-vault", "/api/financial-vault/imports"],
    activeUi: ["/financial-vault", "/financial-vault/imports", "dashboard/status/briefing read-model consumers"],
    currentAuthority: "PostgreSQL via financialVaultPostgresService and financialPositionReadService",
    targetAuthority: "PostgreSQL",
    schemaAvailable: true,
    schemaGap: "No Stage 1 authority gap; fact-history UI surfacing remains product work.",
    migrationRequired: false,
    localPathToRetire: [".ai/local-data/financial-vault.json"],
    transactionBoundaries: "Document/import/fact writes use PostgreSQL transactions and append-only fact versions.",
    idempotencyNeeds: "Existing idempotency_keys operations must remain per-user and per-operation.",
    concurrencyRisks: "Fact update version conflicts must preserve verified facts.",
    restartTests: ["financialVaultPostgresService.test.ts", "financialPositionReadService.test.ts"],
    crossUserTests: ["postgresPhase2Persistence.test.ts", "productionDataIntegrity.test.ts"],
    stageStatus: "VERIFIED_COMPLETE",
    blocker: null,
  },
  {
    domain: "Digital Twin",
    activeApis: ["/api/digital-twin"],
    activeUi: ["/digital-twin", "/digital-twin/timeline", "DigitalTwinClient"],
    currentAuthority: "PostgreSQL via coreDecisioningPostgresService",
    targetAuthority: "PostgreSQL",
    schemaAvailable: true,
    schemaGap: "No core route gap; Housing state is persisted as timeline events plus calculation snapshots.",
    migrationRequired: false,
    localPathToRetire: [".ai/local-data/financial-digital-twin.json", "src/lib/financialDigitalTwinStore.ts"],
    transactionBoundaries: "Scenario save, simulation run, calculation snapshot and timeline rows must stay user-scoped.",
    idempotencyNeeds: "Scenario save idempotency and simulation app-id uniqueness.",
    concurrencyRisks: "Repeated simulations should not duplicate immutable timeline events.",
    restartTests: ["coreDecisioningPostgresService.test.ts", "financialDigitalTwin.test.ts"],
    crossUserTests: ["coreDecisioningPostgresService.test.ts"],
    stageStatus: "CORE_DOMAIN_CONVERTED",
    blocker: null,
  },
  {
    domain: "Decision Centre",
    activeApis: ["/api/decisions"],
    activeUi: ["AiDecisionCentre", "/insights", "dashboard decision cards"],
    currentAuthority: "PostgreSQL decisions and decision_history",
    targetAuthority: "PostgreSQL",
    schemaAvailable: true,
    schemaGap: "No Stage 1 schema gap.",
    migrationRequired: false,
    localPathToRetire: ["localStorage:vireon-decision-action-state compatibility fallback"],
    transactionBoundaries: "Decision upsert and transition history append must stay atomic by user/app ID.",
    idempotencyNeeds: "Generated decisions deduplicate by user/app ID.",
    concurrencyRisks: "Concurrent status updates need transition history clarity.",
    restartTests: ["coreDecisioningPostgresService.test.ts"],
    crossUserTests: ["coreDecisioningPostgresService.test.ts"],
    stageStatus: "CORE_DOMAIN_CONVERTED",
    blocker: null,
  },
  {
    domain: "Action Workflows",
    activeApis: ["/api/action-workflows", "/api/workflow-status"],
    activeUi: ["/action-workflows", "ActionWorkflowsClient"],
    currentAuthority: "PostgreSQL workflows, workflow_steps, workflow_evidence and workflow_outcomes",
    targetAuthority: "PostgreSQL",
    schemaAvailable: true,
    schemaGap: "No Stage 1 schema gap.",
    migrationRequired: false,
    localPathToRetire: [".ai/local-data/action-workflows.json", "src/lib/actionWorkflowStore.ts"],
    transactionBoundaries: "Workflow state, steps, evidence and outcome reconciliation must remain one logical save.",
    idempotencyNeeds: "Evidence reconciliation by persisted evidence IDs; outcome upsert by app ID.",
    concurrencyRisks: "Concurrent step and outcome updates can race on payload/version.",
    restartTests: ["coreDecisioningPostgresService.test.ts", "actionWorkflows.test.ts"],
    crossUserTests: ["coreDecisioningPostgresService.test.ts"],
    stageStatus: "CORE_DOMAIN_CONVERTED",
    blocker: null,
  },
  {
    domain: "AI CFO history",
    activeApis: ["/api/ai-cfo", "/api/copilot-history"],
    activeUi: ["/ai-cfo", "/my-ai-cfo", "/ask-vireon", "AiCfoClient"],
    currentAuthority: "Grounded AI CFO and legacy Copilot history are PostgreSQL via coreDecisioningPostgresService.",
    targetAuthority: "PostgreSQL for grounded AI CFO history and grounding metadata",
    schemaAvailable: true,
    schemaGap: "No active AI CFO history schema gap; legacy Copilot answers are classified as non-authoritative imported history.",
    migrationRequired: false,
    localPathToRetire: [".ai/local-data/ai-cfo.json", ".ai/local-data/copilot-history.json", "src/lib/aiCfoStore.ts"],
    transactionBoundaries: "Question, answer and calculation snapshot linkage must remain ordered.",
    idempotencyNeeds: "Bounded history should avoid duplicate answer app IDs.",
    concurrencyRisks: "Repeated prompts can race on answer app IDs.",
    restartTests: ["coreDecisioningPostgresService.test.ts", "aiCfo.test.ts"],
    crossUserTests: ["coreDecisioningPostgresService.test.ts"],
    stageStatus: "CORE_DOMAIN_CONVERTED",
    blocker: null,
  },
  {
    domain: "Daily Review",
    activeApis: ["/api/ai-cfo/daily-review"],
    activeUi: ["/ai-cfo/daily-review", "DailyReviewClient", "DailyReviewCard"],
    currentAuthority: "PostgreSQL daily_reviews, calculation_snapshots and user_preferences",
    targetAuthority: "PostgreSQL",
    schemaAvailable: true,
    schemaGap: "No Stage 1 schema gap; 0005 removes same-day uniqueness for append-only history.",
    migrationRequired: false,
    localPathToRetire: [".ai/local-data/ai-cfo-daily-review.json", "src/lib/aiCfoDailyReviewStore.ts"],
    transactionBoundaries: "Calculation snapshot must be recorded before review history row.",
    idempotencyNeeds: "Review app IDs must stay unique while same-day history remains append-only.",
    concurrencyRisks: "Concurrent setting update and review generation can produce stale settings.",
    restartTests: ["coreDecisioningPostgresService.test.ts", "aiCfoDailyReview.test.ts"],
    crossUserTests: ["coreDecisioningPostgresService.test.ts"],
    stageStatus: "CORE_DOMAIN_CONVERTED",
    blocker: null,
  },
  {
    domain: "Goals",
    activeApis: ["/api/goals", "/api/financial-forecast"],
    activeUi: ["/goals", "GoalsPlanningClient"],
    currentAuthority: "PostgreSQL for active goals; forecast scenario/snapshot route remains hybrid/local.",
    targetAuthority: "PostgreSQL",
    schemaAvailable: true,
    schemaGap: "Financial forecast scenario persistence remains outside the core Goals route.",
    migrationRequired: false,
    localPathToRetire: [".vireon/goal-planning", "financial forecast local scenario/snapshot state"],
    transactionBoundaries: "Goal create/update, scenario timeline event and calculation snapshot should stay ordered.",
    idempotencyNeeds: "Goal create idempotency and scenario app IDs.",
    concurrencyRisks: "Status update lacks explicit expected-version input at route boundary.",
    restartTests: ["coreDecisioningPostgresService.test.ts", "goalPlanning.test.ts"],
    crossUserTests: ["coreDecisioningPostgresService.test.ts"],
    stageStatus: "CORE_DOMAIN_CONVERTED",
    blocker: null,
  },
  {
    domain: "Transactions and subscriptions",
    activeApis: ["/api/transactions", "/api/ingest", "/api/subscriptions", "/api/subscriptions/intelligence"],
    activeUi: ["/transactions", "/subscriptions", "TransactionsSection", "SubscriptionsSection", "ImportWorkflow"],
    currentAuthority: "PostgreSQL via transactionsSubscriptionsPostgresService",
    targetAuthority: "PostgreSQL transaction/subscription persistence with Financial Vault ownership boundaries",
    schemaAvailable: true,
    schemaGap: "0006 adds user_transaction_imports, user_transactions and user_subscriptions with RLS and runtime grants.",
    migrationRequired: true,
    localPathToRetire: [".ai/local-data/transactions.json", ".ai/local-data/subscriptions.json", ".ai/local-data/imports.json"],
    transactionBoundaries: "Import metadata, transaction rows, subscription derivation and idempotency records are written in one PostgreSQL transaction.",
    idempotencyNeeds: "Import checksum/idempotency key and subscription upsert keys are enforced per user.",
    concurrencyRisks: "Duplicate import attempts are suppressed by user/source checksum and idempotency keys.",
    restartTests: ["transactionsSubscriptionsPostgresService.test.ts"],
    crossUserTests: ["transactionsSubscriptionsPostgresService.test.ts"],
    stageStatus: "CORE_DOMAIN_CONVERTED",
    blocker: null,
  },
  {
    domain: "Background jobs, exports, account deletion, operational telemetry",
    activeApis: ["/api/runtime/*", "/api/build-*", "/api/private-beta/export", "/api/private-beta/deletion", "/api/telemetry", "/api/logs/ingest"],
    activeUi: ["/autonomous-operations", "/production-readiness", "/privacy", "SupervisorInbox"],
    currentAuthority: "PostgreSQL for private-beta export/deletion lifecycle and product jobs; .ai/operations, .ai/builds and local telemetry remain operational tooling",
    targetAuthority: "background_jobs, data_exports, account_deletion_requests and audit_events where product-scoped",
    schemaAvailable: true,
    schemaGap: "0009 adds additive private-beta job/export/deletion lifecycle metadata. General operational tooling remains excluded.",
    migrationRequired: true,
    localPathToRetire: [".ai/operations/* for product jobs", ".ai/builds/* for product jobs", ".ai/local-data/telemetry.json"],
    transactionBoundaries: "Export/deletion requests enqueue background jobs and audit events in one PostgreSQL transaction.",
    idempotencyNeeds: "Export/deletion request IDs and background job enqueue keys.",
    concurrencyRisks: "Operational queues use local/process state and can lose updates on restart.",
    restartTests: ["privateBetaLifecyclePostgresService.test.ts", "runtimeControl.test.ts", "systemHealth.test.ts"],
    crossUserTests: ["privateBetaLifecyclePostgresService.test.ts"],
    stageStatus: "CORE_DOMAIN_CONVERTED",
    blocker: "Real destructive account deletion and private-beta activation remain human approval gates.",
  },
];
