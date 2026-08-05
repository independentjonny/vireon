import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCoreDecisioningPostgresService } from "../../src/server/services/coreDecisioningPostgresService.ts";
import { WorkflowExecutionEngine } from "../../src/lib/actionWorkflows.ts";
import { createDemoFinancialVaultState } from "../../src/lib/financialVaultEmptyState.ts";
import { buildFinancialPositionReadModel } from "../../src/server/services/financialPositionReadService.ts";
import type { PostgresPilotClient, QueryResult } from "../../src/lib/postgresPilotPersistence.ts";

type Call = { sql: string; params: unknown[] };

function clientForDecisionStatus(calls: Call[]): PostgresPilotClient {
  let transactionDepth = 0;
  return {
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      calls.push({ sql, params });
      if (sql.includes("set_config") && transactionDepth === 0) throw new Error("root set_config is forbidden in tests");
      if (sql.includes("select id, state, payload from decisions")) {
        return { rows: [{ id: "decision-row-1", state: "New", payload: {} }] as T[] };
      }
      if (sql.includes("select app_id as \"appId\", state, payload")) {
        return { rows: [{ appId: "decision-refinance", state: "Reviewed", payload: { clickedAt: "2026-07-31T00:00:00.000Z" } }] as T[] };
      }
      return { rows: [] };
    },
    async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
      transactionDepth += 1;
      try {
        return await operation(this);
      } finally {
        transactionDepth -= 1;
      }
    },
  };
}

test("core decisioning service scopes decision mutations by trusted user and writes history", async () => {
  const calls: Call[] = [];
  const service = createCoreDecisioningPostgresService(clientForDecisionStatus(calls));

  const states = await service.updateDecisionStatus(
    { userId: "user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-a" },
    "decision-refinance",
    "Reviewed",
  );

  assert.equal(states["decision-refinance"].status, "Reviewed");
  assert.ok(calls.some((call) => call.sql.includes("set_config") && call.sql.includes("app.current_user_id")));
  assert.ok(calls.some((call) => call.sql.includes("insert into decision_history")));
  assert.ok(calls.every((call) => !call.params.includes("user-b")));
});

test("core decisioning service rejects unauthenticated mutations before SQL state writes", async () => {
  const calls: Call[] = [];
  const service = createCoreDecisioningPostgresService(clientForDecisionStatus(calls));

  await assert.rejects(
    () => service.updateDecisionStatus({ userId: null, expiresAt: null }, "decision-refinance", "Reviewed"),
    /Sign in is required/,
  );
  assert.equal(calls.length, 0);
});

function clientForWorkflowPersistence(calls: Call[]): PostgresPilotClient {
  let evidenceIndex = 0;
  let snapshotIndex = 0;
  let transactionDepth = 0;
  return {
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      calls.push({ sql, params });
      if (sql.includes("set_config") && transactionDepth === 0) throw new Error("root set_config is forbidden in tests");
      if (sql.includes("select payload from workflows")) return { rows: [] };
      if (sql.includes("insert into workflows")) {
        return { rows: [{ id: "11111111-1111-4111-8111-111111111111" }] as T[] };
      }
      if (sql.includes("select id from workflow_steps")) return { rows: [] };
      if (sql.includes("select id from evidence")) return { rows: [] };
      if (sql.includes("insert into evidence")) {
        evidenceIndex += 1;
        return { rows: [{ id: `22222222-2222-4222-8222-${String(evidenceIndex).padStart(12, "0")}` }] as T[] };
      }
      if (sql.includes("insert into calculation_snapshots")) {
        snapshotIndex += 1;
        return { rows: [{ id: `33333333-3333-4333-8333-${String(snapshotIndex).padStart(12, "0")}` }] as T[] };
      }
      if (sql.includes("insert into ai_cfo_questions")) {
        return { rows: [{ id: "44444444-4444-4444-8444-444444444444" }] as T[] };
      }
      if (sql.includes("count(*)::text as count from ai_cfo_answers")) {
        return { rows: [{ count: "1" }] as T[] };
      }
      if (sql.includes("a.output_classification = 'legacy-copilot-history'") && sql.includes("order by a.created_at desc")) {
        return {
          rows: [{
            id: "legacy-copilot-row",
            question: "What next?",
            answer: { directAnswer: "Use persisted history." },
            askedAt: "2026-07-31T00:00:00.000Z",
            context: { source: "legacy-copilot-history", nonAuthoritative: true },
          }] as T[],
        };
      }
      if (sql.includes("select a.payload")) return { rows: [] };
      if (sql.includes("from goals where user_id")) return { rows: [] };
      if (sql.includes("from timeline_events where user_id") && sql.includes("goal_scenario")) return { rows: [] };
      return { rows: [] };
    },
    async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
      transactionDepth += 1;
      try {
        return await operation(this);
      } finally {
        transactionDepth -= 1;
      }
    },
  };
}

const readModel = {
  async read() {
    return buildFinancialPositionReadModel({
      userId: "60ff2833-26e9-581e-8b32-173e702847ea",
      vault: createDemoFinancialVaultState("2026-07-31T00:00:00.000Z"),
      canonical: [],
      ingestions: [],
      freshness: [],
      correlationId: "corr-workflow-test",
      generatedAt: "2026-07-31T00:00:00.000Z",
    });
  },
};

test("core decisioning service persists workflow outcomes as first-class PostgreSQL rows", async () => {
  const calls: Call[] = [];
  const service = createCoreDecisioningPostgresService(clientForWorkflowPersistence(calls), { readModel });

  const state = await service.readWorkflows({ userId: "workflow-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-workflow-a" });

  assert.ok(state.executions.length > 0);
  assert.ok(calls.some((call) => call.sql.includes("insert into workflow_outcomes")));
  assert.ok(calls.some((call) => call.sql.includes("set_config") && typeof call.params[0] === "string"));
  assert.ok(calls.every((call) => !call.params.includes("workflow-user-a")));
});

test("core decisioning service normalizes workflow evidence and links it to outcomes", async () => {
  const calls: Call[] = [];
  const service = createCoreDecisioningPostgresService(clientForWorkflowPersistence(calls), { readModel });
  const seeded = await service.readWorkflows({ userId: "workflow-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-workflow-a" });
  const target = seeded.executions.find((execution) => execution.outcomeStatus !== "Not Required") ?? seeded.executions[0];
  assert.ok(target);
  const workflowId = target.id.replace(/^execution-/, "workflow-");

  await service.addWorkflowEvidence(
    { userId: "workflow-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-workflow-a" },
    workflowId,
    {
      type: "provider confirmation",
      source: "Provider email",
      documentId: null,
      factId: null,
      uploadedAt: "2026-07-31T00:00:00.000Z",
      effectiveDate: "2026-07-31",
      verifiedAt: "2026-07-31T00:00:00.000Z",
      confidence: "Medium",
      notes: "Provider confirmed the workflow outcome.",
      satisfiesRequirementIds: ["outcome-verification"],
    },
  );

  assert.ok(calls.some((call) => call.sql.includes("insert into evidence")));
  assert.ok(calls.some((call) => call.sql.includes("insert into workflow_evidence")));
  assert.equal(
    calls.filter((call) => call.sql.includes("select id from evidence where user_id")).length,
    calls.filter((call) => call.sql.includes("insert into workflow_evidence")).length,
  );
  assert.ok(WorkflowExecutionEngine.normalise(target).outcomeVerifications.length > 0);
});

test("core decisioning service records Daily Review calculation snapshots before review history", async () => {
  const calls: Call[] = [];
  const service = createCoreDecisioningPostgresService(clientForWorkflowPersistence(calls), { readModel });

  await service.runAndPersistDailyReview(
    { userId: "daily-review-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-daily-review-a" },
    { mode: "empty-demo" },
  );

  const snapshotIndex = calls.findIndex((call) => call.sql.includes("insert into calculation_snapshots") && call.sql.includes("'Daily Review'"));
  const reviewIndex = calls.findIndex((call) => call.sql.includes("insert into daily_reviews"));
  assert.ok(snapshotIndex >= 0);
  assert.ok(reviewIndex > snapshotIndex);
  assert.ok(calls[snapshotIndex].sql.includes("returning id"));
  assert.ok(calls[reviewIndex].sql.includes("calculation_snapshot_id"));
  assert.ok(calls[reviewIndex].sql.includes("on conflict (user_id, app_id)"));
  assert.ok(!calls[reviewIndex].sql.includes("on conflict (user_id, review_date)"));
  assert.match(String(calls[reviewIndex].params[8]), /^33333333-3333-4333-8333-/);
  assert.ok(calls.every((call) => !call.params.includes("daily-review-user-a")));
});

test("goal scenario persistence does not update immutable timeline events", async () => {
  const calls: Call[] = [];
  const service = createCoreDecisioningPostgresService(clientForWorkflowPersistence(calls), { readModel });

  await service.saveGoalScenario(
    { userId: "goal-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-goal-scenario-a" },
    {
      id: "goal-scenario-accelerated",
      goalId: "goal-home",
      name: "accelerated",
      contributionAmount: 1800,
      oneOffDeposit: 0,
      startDelayMonths: 0,
      incomeChange: 0,
      expenseReduction: 0,
      createdAt: "2026-07-31T00:00:00.000Z",
      archived: false,
    },
  );

  const timelineInsert = calls.find((call) => call.sql.includes("insert into timeline_events") && call.params[2] === "accelerated");
  assert.ok(timelineInsert);
  assert.ok(timelineInsert.sql.includes("on conflict (user_id, app_id) do nothing"));
  assert.ok(!timelineInsert.sql.includes("do update"));
  assert.ok(calls.every((call) => !call.params.includes("goal-user-a")));
});

test("core decisioning service records AI CFO answers with grounding calculation snapshots", async () => {
  const calls: Call[] = [];
  const service = createCoreDecisioningPostgresService(clientForWorkflowPersistence(calls), { readModel });

  await service.runAndPersistAICfo(
    { userId: "ai-cfo-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-ai-cfo-a" },
    { userQuery: "What should I do next?", workspaceContext: "dashboard", selectedScenarioId: "current" },
  );

  const snapshotIndex = calls.findIndex((call) => call.sql.includes("insert into calculation_snapshots") && call.sql.includes("'AI CFO'"));
  const answerIndex = calls.findIndex((call) => call.sql.includes("insert into ai_cfo_answers"));
  assert.ok(snapshotIndex >= 0);
  assert.ok(answerIndex > snapshotIndex);
  assert.ok(calls[answerIndex].sql.includes("calculation_snapshot_id"));
  assert.match(String(calls[answerIndex].params[6]), /^33333333-3333-4333-8333-/);
  assert.ok(calls.every((call) => !call.params.includes("ai-cfo-user-a")));
});

test("AI CFO page hydrates conversation history from PostgreSQL state", () => {
  const page = readFileSync(join(process.cwd(), "src/app/ai-cfo/page.tsx"), "utf8");
  const client = readFileSync(join(process.cwd(), "src/app/components/AiCfoClient.tsx"), "utf8");

  assert.match(page, /readAICfoInputs\(session\)/);
  assert.match(page, /readAICfoState\(session\)/);
  assert.match(page, /persistedHistory=\{aiCfoState\.history\}/);
  assert.doesNotMatch(page, /createPersistedAICfoInputServiceFromEnv/);
  assert.match(client, /persistedHistory\?: AICfoRunResult\[\]/);
  assert.match(client, /persistedHistory\?\.length \? persistedHistory : \[\]/);
});

test("active AI CFO entrypoints use persisted core decisioning context instead of default Housing", () => {
  const page = readFileSync(join(process.cwd(), "src/app/ai-cfo/page.tsx"), "utf8");
  const route = readFileSync(join(process.cwd(), "src/app/api/ai-cfo/route.ts"), "utf8");
  const runtime = readFileSync(join(process.cwd(), "src/lib/aiCfoRuntime.ts"), "utf8");
  const dailyReviewRoute = readFileSync(join(process.cwd(), "src/app/api/ai-cfo/daily-review/route.ts"), "utf8");

  assert.match(page, /core\.readAICfoInputs\(session\)/);
  assert.match(route, /service\.runAndPersistAICfo\(current/);
  assert.doesNotMatch(route, /gatherAICfoInputs|getHousingAffordabilityState|housingAffordabilityStore/);
  assert.doesNotMatch(page, /aiCfoRuntime|gatherAICfoInputs|getHousingAffordabilityState|housingAffordabilityStore/);
  assert.doesNotMatch(dailyReviewRoute, /aiCfoRuntime|gatherAICfoInputs|getHousingAffordabilityState|housingAffordabilityStore/);
  assert.match(runtime, /buildDefaultHousingAffordabilityState/);
  assert.match(runtime, /VIREON_ALLOW_LEGACY_AI_CFO_RUNTIME/);
  assert.match(runtime, /Legacy AI CFO runtime input builder is disabled in production/);
  assert.doesNotMatch(runtime, /housingAffordabilityStore|getHousingAffordabilityState/);
});

test("core decisioning service persists legacy copilot history in PostgreSQL without local fallback", async () => {
  const calls: Call[] = [];
  const service = createCoreDecisioningPostgresService(clientForWorkflowPersistence(calls), { readModel });

  const entry = await service.appendCopilotHistory(
    { userId: "ai-cfo-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-ai-cfo-a" },
    { question: "What next?", answer: "Use persisted history." },
  );
  const history = await service.readCopilotHistory(
    { userId: "ai-cfo-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-ai-cfo-a" },
  );

  assert.match(entry.id, /^legacy-copilot-/);
  assert.equal(history.total, 1);
  assert.equal(history.history[0].answer, "Use persisted history.");
  assert.ok(calls.some((call) => call.sql.includes("insert into ai_cfo_questions")));
  assert.ok(calls.some((call) => call.sql.includes("insert into ai_cfo_answers")));
  assert.ok(calls.some((call) => call.sql.includes("legacy-copilot-history")));
  assert.ok(calls.every((call) => !call.params.includes("ai-cfo-user-a")));
});

test("Daily Review API rejects demo persistence unless explicitly enabled outside production", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/ai-cfo/daily-review/route.ts"), "utf8");

  assert.match(route, /VIREON_ALLOW_DAILY_REVIEW_DEMO_MODE/);
  assert.match(route, /mode !== "live" && !demoModeAllowed/);
  assert.match(route, /DEMO_MODE_DISABLED/);
  assert.doesNotMatch(route, /body\.mode === "partial-failure-demo" \? \[/);
});

test("active copilot history API route uses PostgreSQL service instead of localStore", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/copilot-history/route.ts"), "utf8");
  assert.match(route, /createCoreDecisioningServiceFromEnv/);
  assert.doesNotMatch(route, /localStore|getCopilotHistory/);
});

function clientForFinancialForecastPersistence(calls: Call[]): PostgresPilotClient {
  let transactionDepth = 0;
  return {
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      calls.push({ sql, params });
      if (sql.includes("set_config") && transactionDepth === 0) throw new Error("root set_config is forbidden in tests");
      if (sql.includes("select id from simulation_runs where user_id")) return { rows: [] };
      if (sql.includes("insert into digital_twin_scenarios")) return { rows: [{ id: "55555555-5555-4555-8555-555555555555" }] as T[] };
      if (sql.includes("insert into calculation_snapshots")) return { rows: [{ id: "66666666-6666-4666-8666-666666666666" }] as T[] };
      if (sql.includes("count(*)::text as count from simulation_runs")) return { rows: [{ count: "1" }] as T[] };
      if (sql.includes("payload ->> 'forecastDomain' = 'financial_forecast'") && sql.includes("count(*)::text as count")) return { rows: [{ count: "1" }] as T[] };
      if (sql.includes("payload ->> 'forecastDomain' = 'financial_forecast'") && sql.includes("archived_at is not null")) return { rows: [] };
      return { rows: [] };
    },
    async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
      transactionDepth += 1;
      try {
        return await operation(this);
      } finally {
        transactionDepth -= 1;
      }
    },
  };
}

test("financial forecast route persistence writes deterministic snapshots through PostgreSQL", async () => {
  const calls: Call[] = [];
  const service = createCoreDecisioningPostgresService(clientForFinancialForecastPersistence(calls), { readModel });

  const result = await service.runFinancialForecastScenario(
    { userId: "forecast-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-forecast-a" },
    { name: "Extra repayment", deltas: [{ kind: "increase-mortgage-repayment", amount: 400 }] },
    "12m",
  );

  assert.equal(result.snapshot.version, "financial-timeline-forecasting-v1");
  assert.equal(result.persisted.snapshotCount, 1);
  assert.ok(calls.some((call) => call.sql.includes("insert into calculation_snapshots") && call.params.includes("Financial Forecast")));
  assert.ok(calls.some((call) => call.sql.includes("insert into simulation_runs") && call.params.includes("financial-timeline-forecasting-v1")));
  assert.ok(calls.some((call) => call.sql.includes("insert into digital_twin_scenarios") && call.params.includes("Extra repayment")));
  assert.ok(calls.some((call) => call.sql.includes("set_config") && call.sql.includes("app.current_user_id")));
  assert.ok(calls.every((call) => !call.params.includes("forecast-user-a")));
});

test("financial forecast service rejects unsupported scenario deltas before writing snapshot rows", async () => {
  const calls: Call[] = [];
  const service = createCoreDecisioningPostgresService(clientForFinancialForecastPersistence(calls), { readModel });

  await assert.rejects(
    () => service.runFinancialForecastScenario(
      { userId: "forecast-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-forecast-a" },
      { name: "Bad scenario", deltas: [{ kind: "invent-income", amount: 999 }] },
    ),
    /Scenario changes must use supported forecast inputs/,
  );
  assert.equal(calls.some((call) => call.sql.includes("insert into calculation_snapshots")), false);
});

test("active financial forecast route and page do not use filesystem forecast authority", () => {
  const route = readFileSync(join(process.cwd(), "src/app/api/financial-forecast/route.ts"), "utf8");
  const page = readFileSync(join(process.cwd(), "src/app/digital-twin/timeline/page.tsx"), "utf8");

  assert.match(route, /createCoreDecisioningServiceFromEnv/);
  assert.match(page, /readFinancialForecast/);
  assert.doesNotMatch(route, /FinancialForecastingEngine\.persist|FinancialForecastingEngine\.readState|readForecastState|writeForecastState/);
  assert.doesNotMatch(page, /FinancialForecastingEngine|createFinancialPositionReadServiceFromEnv/);
});

type HousingPersistenceBacking = {
  housingByUser: Map<string, unknown[]>;
  idempotency: Map<string, string>;
};

function createHousingPersistenceBacking(): HousingPersistenceBacking {
  return {
    housingByUser: new Map<string, unknown[]>(),
    idempotency: new Map<string, string>(),
  };
}

function clientForHousingPersistence(calls: Call[], backing: HousingPersistenceBacking = createHousingPersistenceBacking()): PostgresPilotClient {
  let transactionDepth = 0;
  let currentUser = "";
  let snapshotIndex = 0;
  return {
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
      calls.push({ sql, params });
      if (sql.includes("set_config")) {
        if (transactionDepth === 0) throw new Error("root set_config is forbidden in tests");
        currentUser = String(params[0]);
        return { rows: [] };
      }
      if (sql.includes("select before_values as payload") && params[1] === "housing_affordability") {
        const rows = backing.housingByUser.get(currentUser) ?? [];
        const latest = rows.at(-1);
        return { rows: latest ? [{ payload: latest }] as T[] : [] };
      }
      if (sql.includes("insert into calculation_snapshots")) {
        snapshotIndex += 1;
        return { rows: [{ id: `55555555-5555-4555-8555-${String(snapshotIndex).padStart(12, "0")}` }] as T[] };
      }
      if (sql.includes("insert into timeline_events") && params[3] === "housing_affordability") {
        backing.housingByUser.set(String(params[0]), [...(backing.housingByUser.get(String(params[0])) ?? []), JSON.parse(String(params[4]))]);
        return { rows: [] };
      }
      if (sql.includes("select response_hash as")) {
        const key = `${currentUser}:${params[1]}:${params[2]}`;
        return { rows: backing.idempotency.has(key) ? [{ responseHash: backing.idempotency.get(key) }] as T[] : [] };
      }
      if (sql.includes("insert into idempotency_keys")) {
        backing.idempotency.set(`${currentUser}:${params[1]}:${params[2]}`, String(params[3]));
        return { rows: [] };
      }
      return { rows: [] };
    },
    async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
      transactionDepth += 1;
      try {
        return await operation(this);
      } finally {
        currentUser = "";
        transactionDepth -= 1;
      }
    },
  };
}

test("housing scenarios persist through PostgreSQL timeline snapshots and reload without local fallback", async () => {
  const calls: Call[] = [];
  const backing = createHousingPersistenceBacking();
  const service = createCoreDecisioningPostgresService(clientForHousingPersistence(calls, backing), { readModel });
  const session = { userId: "housing-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-housing-a" };

  const saved = await service.createHousingScenario(session, {
    propertyPrice: 880000,
    deposit: 220000,
    purchaseState: "VIC",
    estimatedInterestRate: 6.1,
    loanTermYears: 30,
  });
  const freshCalls: Call[] = [];
  const freshService = createCoreDecisioningPostgresService(clientForHousingPersistence(freshCalls, backing), { readModel });
  const reloaded = await freshService.readHousingAffordability({ ...session, requestId: "req-housing-a-after-restart" });

  assert.equal(reloaded.housing_scenarios[0].propertyPrice, saved.housing_scenarios[0].propertyPrice);
  assert.ok(calls.some((call) => call.sql.includes("insert into timeline_events") && call.params[3] === "housing_affordability"));
  assert.ok(calls.some((call) => call.sql.includes("insert into calculation_snapshots") && call.sql.includes("'Housing Affordability'")));
  assert.ok(calls.some((call) => call.sql.includes("idempotency_keys")));
  assert.ok(freshCalls.some((call) => call.sql.includes("select before_values as payload") && call.params[1] === "housing_affordability"));
  assert.ok(freshCalls.every((call) => !call.sql.includes("insert into timeline_events")));
  assert.ok(calls.every((call) => !call.params.includes("housing-user-a")));
});

test("AI CFO inputs use persisted Housing state through a fresh PostgreSQL-backed context", async () => {
  const backing = createHousingPersistenceBacking();
  const service = createCoreDecisioningPostgresService(clientForHousingPersistence([], backing), { readModel });
  const session = { userId: "ai-cfo-housing-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-ai-housing-a" };

  await service.createHousingScenario(session, {
    propertyPrice: 915000,
    deposit: 230000,
    purchaseState: "VIC",
    estimatedInterestRate: 5.9,
    loanTermYears: 30,
  });

  const freshCalls: Call[] = [];
  const freshService = createCoreDecisioningPostgresService(clientForHousingPersistence(freshCalls, backing), { readModel });
  const inputs = await freshService.readAICfoInputs({ ...session, requestId: "req-ai-housing-a-after-restart" });

  assert.equal(inputs.housing.housing_scenarios[0].propertyPrice, 915000);
  assert.ok(freshCalls.some((call) => call.sql.includes("select before_values as payload") && call.params[1] === "housing_affordability"));
  assert.ok(freshCalls.every((call) => !call.sql.includes("insert into timeline_events")));
});

test("housing scenarios are user scoped and active route code does not import the local housing store", async () => {
  const calls: Call[] = [];
  const service = createCoreDecisioningPostgresService(clientForHousingPersistence(calls), { readModel });

  await service.createHousingScenario(
    { userId: "housing-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-housing-a" },
    {
      propertyPrice: 880000,
      deposit: 220000,
      purchaseState: "VIC",
      estimatedInterestRate: 6.1,
      loanTermYears: 30,
    },
  );
  const otherUser = await service.readHousingAffordability({ userId: "housing-user-b", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-housing-b" });
  const route = readFileSync(join(process.cwd(), "src/app/api/housing-scenarios/route.ts"), "utf8");
  const page = readFileSync(join(process.cwd(), "src/app/housing-scenarios/page.tsx"), "utf8");
  const dashboard = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");

  assert.notEqual(otherUser.housing_scenarios[0].propertyPrice, 880000);
  assert.doesNotMatch(route, /housingAffordabilityStore|getHousingAffordabilityState/);
  assert.doesNotMatch(page, /housingAffordabilityStore|getHousingAffordabilityState/);
  assert.doesNotMatch(dashboard, /housingAffordabilityStore|getHousingAffordabilityState/);
});

test("legacy local Housing store is production-disabled and isolated from active product imports", () => {
  const store = readFileSync(join(process.cwd(), "src/lib/housingAffordabilityStore.ts"), "utf8");
  const core = readFileSync(join(process.cwd(), "src/server/services/coreDecisioningPostgresService.ts"), "utf8");
  const inputs = readFileSync(join(process.cwd(), "src/server/services/persistedAICfoInputService.ts"), "utf8");

  assert.match(store, /VIREON_ALLOW_LEGACY_LOCAL_HOUSING_STORE/);
  assert.match(store, /Legacy local Housing store is disabled in production/);
  assert.doesNotMatch(core, /housingAffordabilityStore/);
  assert.doesNotMatch(inputs, /housingAffordabilityStore/);
});

test("core decisioning service persists Goals state in user-scoped PostgreSQL rows", async () => {
  const calls: Call[] = [];
  const service = createCoreDecisioningPostgresService(clientForWorkflowPersistence(calls), { readModel });

  await service.createGoal(
    { userId: "goals-user-a", expiresAt: "2027-01-01T00:00:00.000Z", requestId: "req-goals-a" },
    {
      type: "EMERGENCY_FUND",
      title: "Emergency fund",
      targetAmount: 30000,
      currentAmount: 5000,
      targetDate: "2027-08-01",
      priority: "high",
      idempotencyKey: "goal-create-test",
    },
  );

  assert.ok(calls.some((call) => call.sql.includes("insert into goals")));
  assert.ok(calls.some((call) => call.sql.includes("insert into calculation_snapshots") && call.sql.includes("'Goals'")));
  assert.ok(calls.some((call) => call.sql.includes("idempotency_keys")));
  assert.ok(calls.every((call) => !call.params.includes("goals-user-a")));
});
