import { createHash, randomUUID } from "node:crypto";
import { buildAiDecisions, type AiDecision, type AiDecisionStatus } from "@/lib/aiDecisionCentre";
import { AICfoOrchestrator, type AICfoInputs, type AICfoRunResult } from "@/lib/aiCfo";
import {
  DEFAULT_DAILY_REVIEW_SETTINGS,
  DailyReviewEngine,
  type DailyReviewHistoryRecord,
  type DailyReviewMode,
  type DailyReviewSettings,
} from "@/lib/aiCfoDailyReview";
import {
  ActionWorkflowEngine,
  WorkflowExecutionEngine,
  type ActionWorkflow,
  type ActionWorkflowExecution,
  type ActionWorkflowStepStatus,
  type ActionWorkflowSummary,
  type WorkflowArtefact,
  type WorkflowEvidenceInput,
} from "@/lib/actionWorkflows";
import {
  FinancialDigitalTwinEngine,
  type TwinPersistedState,
  type TwinScenario,
  type TwinSimulationOutput,
  type TwinTimelineEvent,
} from "@/lib/financialDigitalTwin";
import {
  DEFAULT_RETIREMENT_GOAL_ID,
  GoalPlanningEngine,
  type FinancialGoal,
  type GoalPlanningSnapshot,
  type GoalPriority,
  type GoalScenarioVariant,
  type GoalStatus,
  type GoalType,
} from "@/lib/goalPlanning";
import {
  FINANCIAL_FORECAST_VERSION,
  FinancialForecastingEngine,
  type ForecastComparison,
  type ForecastHorizon,
  type ForecastInput,
  type ForecastScenario,
  type ForecastScenarioDelta,
  type ForecastSnapshot,
} from "@/lib/financialForecasting";
import { buildFinancialBalanceSheetFromReadModel } from "@/lib/financialBalanceSheet";
import {
  buildDefaultHousingAffordabilityState,
  createHousingAffordabilityScenarioState,
  generateHousingAffordabilityReportState,
  refreshHousingAffordabilityState,
} from "@/lib/housingAffordabilityState";
import type { HousingAffordabilityState, HousingScenarioInput } from "@/lib/housingAffordabilityTypes";
import { hashRecord, type AuthenticatedSession, type RepositoryContext } from "@/lib/productionDataIntegrity";
import { createRuntimeDatabaseConfigFromEnv, PsqlRuntimeClient, classifyDatabaseError } from "@/server/db/postgresRuntime";
import type { PostgresPilotClient } from "@/lib/postgresPilotPersistence";
import { createFinancialPositionReadServiceFromEnv, type FinancialPositionReadModel } from "@/server/services/financialPositionReadService";
import { buildAICfoInputsFromFinancialReadModel } from "@/server/services/persistedAICfoInputService";
import { uuidFromTrustedUserId } from "@/server/services/financialVaultPostgresService";

if (typeof window !== "undefined") {
  throw new Error("Core decisioning PostgreSQL service is server-only.");
}

const SOURCE = "core-decisioning-postgres";
const TWIN_ENGINE_VERSION = "financial-digital-twin-v1";
const DAILY_REVIEW_ENGINE_VERSION = "daily-review-v1";
const HOUSING_ENGINE_VERSION = "housing-affordability-v1";
const HOUSING_EVENT_TYPE = "housing_affordability";
const FINANCIAL_FORECAST_ENGINE_NAME = "Financial Forecast";
const FINANCIAL_FORECAST_SOURCE = "financial-forecast";

export type DecisionLifecycleState = {
  status: AiDecisionStatus;
  clickedAt?: string;
  actionedAt?: string;
};

export type ActionWorkflowState = {
  workflows: ActionWorkflow[];
  executions: ActionWorkflowExecution[];
  decisions: AiDecision[];
  summary: ActionWorkflowSummary;
  lastSyncedAt: string;
};

export type AICfoPersistedState = {
  history: AICfoRunResult[];
  decisions: AICfoRunResult["generatedDecision"][];
  timelineEvents: AICfoRunResult["timelineEvent"][];
  adviserBriefs: AICfoRunResult["adviserBrief"][];
};

export type PersistedCopilotHistoryEntry = {
  id: string;
  question: string;
  answer: string;
  askedAt: string;
  context: Record<string, unknown>;
};

export type DailyReviewPersistedState = {
  settings: DailyReviewSettings;
  reviews: DailyReviewHistoryRecord["review"][];
  history: DailyReviewHistoryRecord[];
  lastSuccessfulReviewAt: string | null;
};

export type FinancialForecastPersistedSummary = {
  snapshotCount: number;
  scenarioCount: number;
  archivedScenarioIds: string[];
};

export type FinancialForecastReadResult = {
  input: ForecastInput;
  snapshot: ForecastSnapshot;
  persisted: FinancialForecastPersistedSummary;
};

export type FinancialForecastScenarioResult = FinancialForecastReadResult & {
  baseline: ForecastSnapshot;
  scenario: ForecastScenario;
  comparison: ForecastComparison;
};

type ScopedRepositoryContext = RepositoryContext & {
  transactionClient?: PostgresPilotClient;
};

export class CoreDecisioningPersistenceError extends Error {
  public readonly code: "UNAUTHENTICATED" | "DATABASE_UNAVAILABLE" | "VALIDATION_FAILED" | "NOT_FOUND" | "CONFLICT";
  public readonly status: number;
  public readonly retryable: boolean;

  constructor(
    code: CoreDecisioningPersistenceError["code"],
    message: string,
    status = 500,
    retryable = false,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function sha(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function ctxFromSession(session: AuthenticatedSession, correlationId = randomUUID()): RepositoryContext {
  if (!session.userId) throw new CoreDecisioningPersistenceError("UNAUTHENTICATED", "Sign in is required.", 401);
  const userId = uuidFromTrustedUserId(session.userId);
  return {
    session: { ...session, userId, requestId: session.requestId ?? correlationId },
    correlationId,
    source: SOURCE,
    dataMode: "live",
  };
}

function toSafeError(error: unknown): CoreDecisioningPersistenceError {
  if (error instanceof CoreDecisioningPersistenceError) return error;
  const kind = classifyDatabaseError(error);
  if (kind === "CONNECTION" || kind === "QUERY_TIMEOUT") {
    return new CoreDecisioningPersistenceError("DATABASE_UNAVAILABLE", "PostgreSQL persistence is unavailable. No local fallback was used.", 503, true);
  }
  if (kind === "UNIQUE_CONSTRAINT") return new CoreDecisioningPersistenceError("CONFLICT", "The record already exists.", 409);
  return new CoreDecisioningPersistenceError("VALIDATION_FAILED", "The persisted domain request could not be completed.", 422);
}

function expectedImpactNumber(value: string): number | null {
  const match = value.match(/-?\$?([0-9][0-9,]*)/);
  return match ? Number(match[1].replaceAll(",", "")) : null;
}

function workflowConfidenceNumber(confidence: "High" | "Medium" | "Low"): number {
  if (confidence === "High") return 1;
  if (confidence === "Medium") return 0.7;
  return 0.4;
}

function numericImpact(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const match = value.match(/-?\$?([0-9][0-9,]*)/);
  if (!match) return null;
  const sign = value.trim().startsWith("-") ? -1 : 1;
  return sign * Number(match[1].replaceAll(",", ""));
}

function mergeDailySettings(settings?: Partial<DailyReviewSettings>): DailyReviewSettings {
  return {
    ...DEFAULT_DAILY_REVIEW_SETTINGS,
    ...settings,
    quiet: { ...DEFAULT_DAILY_REVIEW_SETTINGS.quiet, ...settings?.quiet },
    thresholds: { ...DEFAULT_DAILY_REVIEW_SETTINGS.thresholds, ...settings?.thresholds },
  };
}

function normalizeGoalRow(row: {
  appId: string;
  userId: string;
  title: string;
  goalType: GoalType;
  status: GoalStatus;
  targetValue: string | number | null;
  currentValue: string | number | null;
  targetDate: string | null;
  priority: GoalPriority;
  payload: Partial<FinancialGoal> | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}): FinancialGoal {
  const payload = row.payload ?? {};
  return {
    id: row.appId,
    userId: row.userId,
    type: row.goalType,
    title: row.title,
    description: payload.description ?? "",
    targetAmount: Number(row.targetValue ?? payload.targetAmount ?? 0),
    currentAmount: Number(row.currentValue ?? payload.currentAmount ?? 0),
    targetDate: row.targetDate ?? payload.targetDate ?? null,
    priority: row.priority ?? payload.priority ?? "medium",
    status: row.status,
    linkedAccounts: payload.linkedAccounts ?? [],
    linkedAssets: payload.linkedAssets ?? [],
    linkedLiabilities: payload.linkedLiabilities ?? [],
    linkedScenario: payload.linkedScenario ?? null,
    contributionAmount: payload.contributionAmount ?? 0,
    contributionFrequency: payload.contributionFrequency ?? "monthly",
    assumptions: payload.assumptions ?? [],
    provenance: payload.provenance ?? { source: "manual", sourceRecordIds: [], confidence: 1 },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt ?? payload.archivedAt ?? null,
  };
}

function countText(row: { count?: string | number } | undefined): number {
  if (!row) return 0;
  const value = typeof row.count === "number" ? row.count : Number(row.count ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function validateForecastHorizon(value: unknown): ForecastHorizon {
  const allowed: ForecastHorizon[] = ["30d", "90d", "12m", "3y", "5y", "custom"];
  return allowed.includes(value as ForecastHorizon) ? (value as ForecastHorizon) : "12m";
}

function normalizeForecastDelta(input: unknown): ForecastScenarioDelta | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const allowedKinds: ForecastScenarioDelta["kind"][] = [
    "increase-mortgage-repayment",
    "reduce-discretionary-spending",
    "change-salary",
    "lose-income-temporarily",
    "refinance-mortgage",
    "buy-vehicle",
    "increase-super-contribution",
    "add-recurring-expense",
    "add-one-off-expense",
    "change-investment-contribution",
  ];
  const kind = allowedKinds.includes(item.kind as ForecastScenarioDelta["kind"]) ? (item.kind as ForecastScenarioDelta["kind"]) : null;
  const amount = typeof item.amount === "number" ? item.amount : Number(item.amount);
  if (!kind || !Number.isFinite(amount) || Math.abs(amount) > 10_000_000) return null;
  const next: ForecastScenarioDelta = { kind, amount };
  const startMonth = typeof item.startMonth === "number" ? item.startMonth : Number(item.startMonth);
  if (Number.isInteger(startMonth) && startMonth >= 0 && startMonth <= 600) next.startMonth = startMonth;
  const durationMonths = typeof item.durationMonths === "number" ? item.durationMonths : Number(item.durationMonths);
  if (Number.isInteger(durationMonths) && durationMonths > 0 && durationMonths <= 600) next.durationMonths = durationMonths;
  const rate = typeof item.rate === "number" ? item.rate : Number(item.rate);
  if (Number.isFinite(rate) && rate >= 0 && rate <= 100) next.rate = rate;
  return next;
}

function normalizeForecastScenario(input: unknown, horizon: ForecastHorizon): ForecastScenario {
  const payload = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const rawName = typeof payload.name === "string" ? payload.name.trim() : "Scenario";
  const name = rawName.slice(0, 80) || "Scenario";
  const rawDeltas = Array.isArray(payload.deltas) ? payload.deltas.slice(0, 12) : [];
  const deltas = rawDeltas.map(normalizeForecastDelta).filter((item): item is ForecastScenarioDelta => Boolean(item));
  if (rawDeltas.length !== deltas.length) {
    throw new CoreDecisioningPersistenceError("VALIDATION_FAILED", "Scenario changes must use supported forecast inputs.", 400);
  }
  const idSeed = sha({ name, deltas, horizon }).slice(0, 24);
  const rawId = typeof payload.id === "string" ? payload.id.trim() : "";
  const id = /^[a-zA-Z0-9:_-]{1,120}$/.test(rawId) ? rawId : `forecast-scenario-${idSeed}`;
  return {
    id,
    name,
    createdAt: nowIso(),
    archived: false,
    deltas,
  };
}

export function createCoreDecisioningServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const client = new PsqlRuntimeClient(createRuntimeDatabaseConfigFromEnv(env));
  return createCoreDecisioningPostgresService(client, {
    readModel: createFinancialPositionReadServiceFromEnv(env),
  });
}

export function createCoreDecisioningPostgresService(client: PostgresPilotClient, deps?: { readModel?: { read(session: AuthenticatedSession): Promise<FinancialPositionReadModel> } }) {
  function scopedDb(ctx: RepositoryContext): PostgresPilotClient {
    const db = (ctx as ScopedRepositoryContext).transactionClient;
    if (!db) throw new CoreDecisioningPersistenceError("DATABASE_UNAVAILABLE", "Core decisioning database scope requires a transaction-local client.", 503, true);
    return db;
  }

  async function withScopedTransaction<T>(ctx: RepositoryContext, operation: (ctx: ScopedRepositoryContext) => Promise<T>): Promise<T> {
    return client.transaction(async (tx) => {
      const scopedCtx: ScopedRepositoryContext = { ...ctx, transactionClient: tx };
      await scope(scopedCtx);
      return operation(scopedCtx);
    });
  }

  async function scope(ctx: RepositoryContext): Promise<string> {
    const userId = ctx.session.userId;
    if (!userId) throw new CoreDecisioningPersistenceError("UNAUTHENTICATED", "Sign in is required.", 401);
    await scopedDb(ctx).query("select set_config('app.current_user_id', $1, true)", [userId]);
    return userId;
  }

  async function ensureUser(ctx: RepositoryContext): Promise<string> {
    const userId = await scope(ctx);
    await scopedDb(ctx).query(
      `insert into users(id, email, display_name, source, correlation_id)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update set updated_at = now(), correlation_id = excluded.correlation_id`,
      [userId, `${userId}@users.vireon.local`, "Vireon user", ctx.source, ctx.correlationId],
    );
    return userId;
  }

  async function idempotency(ctx: RepositoryContext, operation: string, key: string, payload: unknown): Promise<"new" | "replay"> {
    const userId = await scope(ctx);
    const responseHash = hashRecord(payload);
    const existing = await scopedDb(ctx).query<{ responseHash: string }>(
      `select response_hash as "responseHash" from idempotency_keys where user_id = $1 and operation = $2 and idempotency_key = $3`,
      [userId, operation, key],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].responseHash !== responseHash) {
        throw new CoreDecisioningPersistenceError("CONFLICT", "Idempotency key was reused with a different payload.", 409);
      }
      return "replay";
    }
    await scopedDb(ctx).query(
      `insert into idempotency_keys(user_id, idempotency_key, operation, response_hash, source, correlation_id)
       values ($1, $2, $3, $4, $5, $6)`,
      [userId, key, operation, responseHash, ctx.source, ctx.correlationId],
    );
    return "new";
  }

  async function readModel(session: AuthenticatedSession): Promise<FinancialPositionReadModel> {
    if (!deps?.readModel) throw new CoreDecisioningPersistenceError("DATABASE_UNAVAILABLE", "Financial read model is unavailable.", 503, true);
    return deps.readModel.read(session);
  }

  async function persistedAiInputs(session: AuthenticatedSession): Promise<AICfoInputs> {
    const model = await readModel(session);
    const housing = await withScopedTransaction(ctxFromSession(session), async (ctx) => {
      await ensureUser(ctx);
      return readHousingState(ctx, model);
    });
    return buildAICfoInputsFromFinancialReadModel(model, undefined, housing);
  }

  async function generatedDecisions(session: AuthenticatedSession): Promise<AiDecision[]> {
    const model = await readModel(session);
    const housing = await withScopedTransaction(ctxFromSession(session), async (ctx) => {
      await ensureUser(ctx);
      return readHousingState(ctx, model);
    });
    return buildAiDecisions({
      vault: model.vault,
      housing,
      balanceSheet: buildFinancialBalanceSheetFromReadModel(model),
    });
  }

  async function readHousingState(ctx: ScopedRepositoryContext, model: FinancialPositionReadModel): Promise<HousingAffordabilityState> {
    const userId = await scope(ctx);
    const current = await scopedDb(ctx).query<{ payload: HousingAffordabilityState }>(
      `select before_values as payload
         from timeline_events
        where user_id = $1 and entity_type = $2 and archived_at is null
        order by created_at desc
        limit 1`,
      [userId, HOUSING_EVENT_TYPE],
    );
    if (current.rows[0]?.payload) return refreshHousingAffordabilityState(current.rows[0].payload, model.vault);
    const seeded = buildDefaultHousingAffordabilityState(model.vault);
    await persistHousingState(ctx, seeded, "Initial persisted housing affordability state");
    return seeded;
  }

  async function persistHousingState(ctx: ScopedRepositoryContext, state: HousingAffordabilityState, summary: string): Promise<void> {
    const userId = await scope(ctx);
    const outputHash = hashRecord(state);
    const snapshot = await scopedDb(ctx).query<{ id: string }>(
      `insert into calculation_snapshots(user_id, engine_name, engine_version, input_fact_versions, rule_versions, assumptions, output_hash, source, correlation_id)
       values ($1, 'Housing Affordability', $2, '[]'::jsonb, '[]'::jsonb, $3::jsonb, $4, $5, $6)
       returning id`,
      [
        userId,
        HOUSING_ENGINE_VERSION,
        JSON.stringify({
          scenarioCount: state.housing_scenarios.length,
          readinessBand: state.house_readiness_score.band,
          reportScenarioId: state.purchase_readiness_report?.scenarioId ?? null,
        }),
        outputHash,
        ctx.source,
        ctx.correlationId,
      ],
    );
    await scopedDb(ctx).query(
      `insert into timeline_events(user_id, app_id, event_time, category, title, summary, entity_type, entity_id, before_values, after_values, evidence_ids, calculation_snapshot_id, source, correlation_id)
       values ($1, $2, now(), 'Housing', 'Housing affordability state persisted', $3, $4, null, $5::jsonb, '{}'::jsonb, '{}'::uuid[], $6, $7, $8)`,
      [
        userId,
        `housing:${outputHash.slice(0, 16)}:${Date.now()}`,
        summary,
        HOUSING_EVENT_TYPE,
        JSON.stringify(state),
        snapshot.rows[0]?.id ?? null,
        ctx.source,
        ctx.correlationId,
      ],
    );
  }

  async function financialForecastCounts(ctx: ScopedRepositoryContext): Promise<FinancialForecastPersistedSummary> {
    const userId = await scope(ctx);
    const snapshots = await scopedDb(ctx).query<{ count: string }>(
      `select count(*)::text as count from simulation_runs where user_id = $1 and engine_version = $2`,
      [userId, FINANCIAL_FORECAST_VERSION],
    );
    const scenarios = await scopedDb(ctx).query<{ count: string }>(
      `select count(*)::text as count
         from digital_twin_scenarios
        where user_id = $1
          and archived_at is null
          and payload ->> 'forecastDomain' = 'financial_forecast'`,
      [userId],
    );
    const archived = await scopedDb(ctx).query<{ appId: string }>(
      `select app_id as "appId"
         from digital_twin_scenarios
        where user_id = $1
          and archived_at is not null
          and payload ->> 'forecastDomain' = 'financial_forecast'
        order by updated_at desc
        limit 100`,
      [userId],
    );
    return {
      snapshotCount: countText(snapshots.rows[0]),
      scenarioCount: countText(scenarios.rows[0]),
      archivedScenarioIds: archived.rows.map((row) => row.appId),
    };
  }

  async function persistFinancialForecastSnapshot(ctx: ScopedRepositoryContext, input: ForecastInput, snapshot: ForecastSnapshot, scenario?: ForecastScenario): Promise<FinancialForecastPersistedSummary> {
    const userId = await ensureUser(ctx);
    const runAppId = `financial-forecast:${scenario?.id ?? "baseline"}:${snapshot.hash.slice(0, 24)}`;
    const existingRun = await scopedDb(ctx).query<{ id: string }>(
      `select id from simulation_runs where user_id = $1 and app_id = $2 limit 1`,
      [userId, runAppId],
    );
    if (existingRun.rows[0]) return financialForecastCounts(ctx);

    let scenarioDbId: string | null = null;
    if (scenario) {
      const scenarioRow = await scopedDb(ctx).query<{ id: string }>(
        `insert into digital_twin_scenarios(user_id, app_id, title, assumptions, active, payload, baseline, source, correlation_id)
         values ($1, $2, $3, $4::jsonb, false, $5::jsonb, false, $6, $7)
         on conflict (user_id, app_id) do update
           set title = excluded.title,
               assumptions = excluded.assumptions,
               payload = excluded.payload,
               updated_at = now(),
               version = digital_twin_scenarios.version + 1,
               source = excluded.source,
               correlation_id = excluded.correlation_id
         returning id`,
        [
          userId,
          scenario.id,
          scenario.name,
          JSON.stringify({ forecastDomain: "financial_forecast", deltas: scenario.deltas, horizon: input.horizon }),
          JSON.stringify({ forecastDomain: "financial_forecast", scenario }),
          FINANCIAL_FORECAST_SOURCE,
          ctx.correlationId,
        ],
      );
      scenarioDbId = scenarioRow.rows[0]?.id ?? null;
    }

    const calculation = await scopedDb(ctx).query<{ id: string }>(
      `insert into calculation_snapshots(user_id, engine_name, engine_version, input_fact_versions, rule_versions, assumptions, output_hash, source, correlation_id)
       values ($1, $2, $3, $4::jsonb, '[]'::jsonb, $5::jsonb, $6, $7, $8)
       returning id`,
      [
        userId,
        FINANCIAL_FORECAST_ENGINE_NAME,
        FINANCIAL_FORECAST_VERSION,
        JSON.stringify(input.sourceRecordIds),
        JSON.stringify({
          input,
          scenario: scenario ?? null,
          outputSummary: {
            monthCount: snapshot.months.length,
            eventCount: snapshot.events.length,
            decisionCount: snapshot.decisions.length,
            quality: snapshot.quality.class,
          },
        }),
        snapshot.hash,
        FINANCIAL_FORECAST_SOURCE,
        ctx.correlationId,
      ],
    );

    await scopedDb(ctx).query(
      `insert into simulation_runs(user_id, app_id, scenario_id, calculation_snapshot_id, result, confidence, engine_version, input_fingerprint, warnings, source, correlation_id)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb, $10, $11)
       on conflict (user_id, app_id) do nothing`,
      [
        userId,
        runAppId,
        scenarioDbId,
        calculation.rows[0]?.id ?? null,
        JSON.stringify({ forecastDomain: "financial_forecast", input, snapshot, scenario: scenario ?? null }),
        snapshot.quality.class,
        FINANCIAL_FORECAST_VERSION,
        sha({ input, scenario: scenario ?? null }),
        JSON.stringify(snapshot.quality.warnings),
        FINANCIAL_FORECAST_SOURCE,
        ctx.correlationId,
      ],
    );

    return financialForecastCounts(ctx);
  }

  async function latestDecisionStateMap(ctx: RepositoryContext): Promise<Record<string, DecisionLifecycleState>> {
    const userId = await scope(ctx);
    const rows = await scopedDb(ctx).query<{ appId: string; state: AiDecisionStatus; payload: { clickedAt?: string; actionedAt?: string } }>(
      `select app_id as "appId", state, payload
       from decisions
       where user_id = $1 and archived_at is null`,
      [userId],
    );
    return Object.fromEntries(rows.rows.map((row) => [row.appId, { status: row.state, clickedAt: row.payload?.clickedAt, actionedAt: row.payload?.actionedAt }]));
  }

  async function upsertDecision(ctx: RepositoryContext, decision: AiDecision, state: AiDecisionStatus = "New", extra: Record<string, unknown> = {}): Promise<void> {
    const userId = await scope(ctx);
    const payload = { decision, ...extra };
    const expectedImpact = expectedImpactNumber(decision.expectedImpact);
    await scopedDb(ctx).query(
      `with upserted as (
        insert into decisions(user_id, app_id, title, category, state, original_expected_impact, confidence, professional_review_required, payload, source_module, urgency, source, correlation_id)
        values ($1, $2, $3, $4, $5, $6, $7, false, $8::jsonb, $9, $10, $11, $12)
        on conflict (user_id, app_id) do update
          set title = excluded.title,
              category = excluded.category,
              original_expected_impact = coalesce(decisions.original_expected_impact, excluded.original_expected_impact),
              confidence = excluded.confidence,
              payload = decisions.payload || excluded.payload,
              updated_at = now(),
              source = excluded.source,
              correlation_id = excluded.correlation_id
        returning id
      )
      insert into decision_history(user_id, decision_id, event_type, before_state, after_state, source, correlation_id)
      select $1, id, 'generated-or-refreshed', null, $8::jsonb, $11, $12 from upserted
      where not exists (
        select 1 from decision_history dh where dh.user_id = $1 and dh.decision_id = upserted.id and dh.event_type = 'generated-or-refreshed'
      )`,
      [userId, decision.id, decision.title, decision.category, state, expectedImpact, decision.confidence, JSON.stringify(payload), decision.source, decision.priority, ctx.source, ctx.correlationId],
    );
  }

  async function updateDecisionStatus(ctx: RepositoryContext, appId: string, status: AiDecisionStatus): Promise<Record<string, DecisionLifecycleState>> {
    const userId = await scope(ctx);
    const current = await scopedDb(ctx).query<{ id: string; state: AiDecisionStatus; payload: Record<string, unknown> }>(
      `select id, state, payload from decisions where user_id = $1 and app_id = $2`,
      [userId, appId],
    );
    if (!current.rows[0]) throw new CoreDecisioningPersistenceError("NOT_FOUND", "Decision was not found.", 404);
    const at = nowIso();
    const nextPayload = {
      ...current.rows[0].payload,
      ...(status === "Reviewed" ? { clickedAt: String(current.rows[0].payload.clickedAt ?? at) } : {}),
      ...(status === "Actioned" ? { clickedAt: String(current.rows[0].payload.clickedAt ?? at), actionedAt: at } : {}),
    };
    await scopedDb(ctx).query(
      `with updated as (
        update decisions
        set state = $1, payload = $2::jsonb, version = version + 1, updated_at = now(), source = $3, correlation_id = $4
        where user_id = $5 and app_id = $6
        returning id
      )
      insert into decision_history(user_id, decision_id, event_type, before_state, after_state, source, correlation_id)
      select $5, id, 'state-transition', $7::jsonb, $8::jsonb, $3, $4 from updated`,
      [status, JSON.stringify(nextPayload), ctx.source, ctx.correlationId, userId, appId, JSON.stringify({ state: current.rows[0].state }), JSON.stringify({ state: status, appId })],
    );
    return latestDecisionStateMap(ctx);
  }

  async function workflowRows(ctx: RepositoryContext): Promise<ActionWorkflowExecution[]> {
    const userId = await scope(ctx);
    const rows = await scopedDb(ctx).query<{ payload: { execution?: ActionWorkflowExecution } }>(
      `select payload from workflows where user_id = $1 and archived_at is null order by updated_at desc`,
      [userId],
    );
    return rows.rows.flatMap((row) => row.payload?.execution ? [WorkflowExecutionEngine.normalise(row.payload.execution)] : []);
  }

  async function upsertExecution(ctx: RepositoryContext, execution: ActionWorkflowExecution): Promise<void> {
    const userId = await scope(ctx);
    const workflow = WorkflowExecutionEngine.toWorkflow(execution);
    const row = await scopedDb(ctx).query<{ id: string }>(
      `insert into workflows(user_id, app_id, workflow_definition_id, workflow_version, title, execution_status, outcome_status, expected_impact, realised_impact, payload, source, correlation_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
       on conflict (user_id, app_id) do update
         set execution_status = excluded.execution_status,
             outcome_status = excluded.outcome_status,
             realised_impact = excluded.realised_impact,
             payload = excluded.payload,
             version = workflows.version + 1,
             updated_at = now(),
             source = excluded.source,
             correlation_id = excluded.correlation_id
       returning id`,
      [
        userId,
        workflow.id,
        execution.workflowDefinitionId,
        execution.workflowVersion,
        workflow.title,
        execution.executionStatus,
        execution.outcomeStatus,
        Number.parseFloat(String(execution.expectedImpact).replace(/[^0-9.-]/g, "")) || null,
        typeof execution.realisedImpact === "number" ? execution.realisedImpact : null,
        JSON.stringify({ workflow, execution }),
        ctx.source,
        ctx.correlationId,
      ],
    );
    const workflowDbId = row.rows[0]?.id;
    if (!workflowDbId) throw new CoreDecisioningPersistenceError("VALIDATION_FAILED", "Workflow persistence failed.", 422);
    for (const [index, step] of execution.steps.entries()) {
      await scopedDb(ctx).query(
        `insert into workflow_steps(user_id, workflow_id, app_id, title, step_type, status, step_order, required, validation_rules, payload, source, correlation_id)
         values ($1, $2, $3, $4, $5, $6, $7, true, $8::jsonb, $9::jsonb, $10, $11)
         on conflict (user_id, workflow_id, app_id) do update
           set title = excluded.title,
               status = excluded.status,
               step_order = excluded.step_order,
               validation_rules = excluded.validation_rules,
               payload = excluded.payload,
               updated_at = now(),
               source = excluded.source,
               correlation_id = excluded.correlation_id`,
        [userId, workflowDbId, step.id, step.title, step.type, step.status, index + 1, JSON.stringify(step.validationRules ?? []), JSON.stringify(step), ctx.source, ctx.correlationId],
      );
    }
    const evidenceIdsByAppId = await reconcileWorkflowEvidence(ctx, workflowDbId, execution);
    await reconcileWorkflowOutcomes(ctx, workflowDbId, execution, evidenceIdsByAppId);
  }

  async function reconcileWorkflowEvidence(ctx: RepositoryContext, workflowDbId: string, execution: ActionWorkflowExecution): Promise<Map<string, string>> {
    const userId = await scope(ctx);
    const evidenceIdsByAppId = new Map<string, string>();
    for (const evidence of execution.evidence) {
      const step = evidence.stepId
        ? await scopedDb(ctx).query<{ id: string }>(
            `select id from workflow_steps where user_id = $1 and workflow_id = $2 and app_id = $3`,
            [userId, workflowDbId, evidence.stepId],
          )
        : { rows: [] };
      const existing = await scopedDb(ctx).query<{ id: string }>(
        `select id from evidence where user_id = $1 and source_ref = $2 and evidence_type = 'workflow_evidence' order by created_at asc limit 1`,
        [userId, evidence.id],
      );
      const evidenceRow = existing.rows[0] ?? (await scopedDb(ctx).query<{ id: string }>(
        `insert into evidence(user_id, evidence_type, source_ref, document_id, fact_id, verification_status, confidence, immutable, source, correlation_id)
         values ($1, 'workflow_evidence', $2, null, null, $3, $4, true, $5, $6)
         returning id`,
        [userId, evidence.id, evidence.verificationStatus, workflowConfidenceNumber(evidence.confidence), ctx.source, ctx.correlationId],
      )).rows[0];
      if (!evidenceRow?.id) throw new CoreDecisioningPersistenceError("VALIDATION_FAILED", "Workflow evidence persistence failed.", 422);
      evidenceIdsByAppId.set(evidence.id, evidenceRow.id);
      await scopedDb(ctx).query(
        `insert into workflow_evidence(user_id, workflow_id, step_id, evidence_id, satisfies_requirement_ids, source, correlation_id)
         select $1, $2, $3, $4, $5::text[], $6, $7
         where not exists (
           select 1 from workflow_evidence where user_id = $1 and workflow_id = $2 and evidence_id = $4
         )`,
        [userId, workflowDbId, step.rows[0]?.id ?? null, evidenceRow.id, evidence.satisfiesRequirementIds, ctx.source, ctx.correlationId],
      );
    }
    return evidenceIdsByAppId;
  }

  async function reconcileWorkflowOutcomes(ctx: RepositoryContext, workflowDbId: string, execution: ActionWorkflowExecution, evidenceIdsByAppId: Map<string, string>): Promise<void> {
    const userId = await scope(ctx);
    for (const outcome of execution.outcomeVerifications) {
      const linkedEvidenceIds = outcome.evidenceIds.flatMap((id) => evidenceIdsByAppId.get(id) ?? []);
      await scopedDb(ctx).query(
        `insert into workflow_outcomes(user_id, workflow_id, app_id, metric, baseline_value, expected_value, actual_value, result, variance, evidence_ids, calculation_snapshot_id, payload, source, correlation_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::uuid[], null, $11::jsonb, $12, $13)
         on conflict (user_id, app_id) do update
           set actual_value = excluded.actual_value,
               result = excluded.result,
               variance = excluded.variance,
               evidence_ids = excluded.evidence_ids,
               payload = excluded.payload,
               updated_at = now(),
               version = workflow_outcomes.version + 1,
               source = excluded.source,
               correlation_id = excluded.correlation_id`,
        [
          userId,
          workflowDbId,
          outcome.id,
          outcome.metric,
          outcome.baselineValue,
          outcome.expectedValue,
          outcome.actualValue,
          outcome.result,
          outcome.variance,
          linkedEvidenceIds,
          JSON.stringify({ outcome, executionId: execution.id, realisedImpact: numericImpact(execution.realisedImpact), impactVariance: numericImpact(execution.impactVariance) }),
          ctx.source,
          ctx.correlationId,
        ],
      );
    }
  }

  async function buildWorkflowState(session: AuthenticatedSession, providedDecisions?: AiDecision[], scopedCtx?: ScopedRepositoryContext): Promise<ActionWorkflowState> {
    const ctx = scopedCtx ?? ctxFromSession(session);
    await ensureUser(ctx);
    const decisions = providedDecisions ?? await generatedDecisions(session);
    for (const decision of decisions) await upsertDecision(ctx, decision);
    const existing = await workflowRows(ctx);
    const byDecision = new Map(existing.map((execution) => [execution.sourceDecisionId, execution]));
    const executions = decisions.map((decision) => byDecision.get(decision.id) ?? WorkflowExecutionEngine.createFromDecision(decision, nowIso()));
    for (const execution of executions) {
      if (!byDecision.has(execution.sourceDecisionId)) await upsertExecution(ctx, execution);
    }
    const workflows = executions.map(WorkflowExecutionEngine.toWorkflow);
    return {
      workflows,
      executions,
      decisions,
      summary: ActionWorkflowEngine.summarise(workflows, decisions),
      lastSyncedAt: nowIso(),
    };
  }

  async function persistDailyReviewRecord(ctx: RepositoryContext, record: DailyReviewHistoryRecord): Promise<void> {
    const userId = await scope(ctx);
    const snapshot = await scopedDb(ctx).query<{ id: string }>(
      `insert into calculation_snapshots(user_id, engine_name, engine_version, input_fact_versions, rule_versions, assumptions, output_hash, source, correlation_id)
       values ($1, 'Daily Review', $2, $3::jsonb, '[]'::jsonb, $4::jsonb, $5, $6, $7)
       returning id`,
      [
        userId,
        DAILY_REVIEW_ENGINE_VERSION,
        JSON.stringify([]),
        JSON.stringify({
          reviewId: record.review.id,
          previousSnapshotId: record.previousSnapshot.id,
          currentSnapshotId: record.currentSnapshot.id,
          reviewDate: record.review.reviewDate,
          status: record.review.status,
        }),
        sha(record),
        ctx.source,
        ctx.correlationId,
      ],
    );
    await scopedDb(ctx).query(
      `insert into daily_reviews(user_id, app_id, review_date, status, findings, generated_decision_ids, payload, engine_version, input_fingerprint, calculation_snapshot_id, source, correlation_id)
       values ($1, $2, $3::date, $4, $5::jsonb, '{}'::uuid[], $6::jsonb, $7, $8, $9, $10, $11)
       on conflict (user_id, app_id) do update
         set status = excluded.status,
             findings = excluded.findings,
             payload = excluded.payload,
             engine_version = excluded.engine_version,
             input_fingerprint = excluded.input_fingerprint,
             calculation_snapshot_id = excluded.calculation_snapshot_id,
             updated_at = now(),
             source = excluded.source,
             correlation_id = excluded.correlation_id`,
      [
        userId,
        record.review.id,
        record.review.reviewDate,
        record.review.status,
        JSON.stringify(record.review.findings),
        JSON.stringify(record),
        DAILY_REVIEW_ENGINE_VERSION,
        sha({ current: record.currentSnapshot.id, previous: record.previousSnapshot.id }),
        snapshot.rows[0]?.id ?? null,
        ctx.source,
        ctx.correlationId,
      ],
    );
  }

  return {
    toSafeError,
    async readFinancialForecast(session: AuthenticatedSession, horizonInput: ForecastHorizon = "12m"): Promise<FinancialForecastReadResult> {
      try {
        const horizon = validateForecastHorizon(horizonInput);
        const model = await readModel(session);
        return await withScopedTransaction(ctxFromSession(session), async (ctx) => {
          const input = FinancialForecastingEngine.buildInput({
            userId: model.userId,
            records: model.confirmedFacts,
            horizon,
            startDate: "2026-08-01",
          });
          const snapshot = FinancialForecastingEngine.generate(input);
          const persisted = await persistFinancialForecastSnapshot(ctx, input, snapshot);
          return { input, snapshot, persisted };
        });
      } catch (error) {
        throw toSafeError(error);
      }
    },
    async runFinancialForecastScenario(session: AuthenticatedSession, scenarioInput: unknown, horizonInput: ForecastHorizon = "12m"): Promise<FinancialForecastScenarioResult> {
      try {
        const horizon = validateForecastHorizon(horizonInput);
        const scenario = normalizeForecastScenario(scenarioInput, horizon);
        const model = await readModel(session);
        return await withScopedTransaction(ctxFromSession(session), async (ctx) => {
          const input = FinancialForecastingEngine.buildInput({
            userId: model.userId,
            records: model.confirmedFacts,
            horizon,
            startDate: "2026-08-01",
          });
          const baseline = FinancialForecastingEngine.generate(input);
          const snapshot = FinancialForecastingEngine.generate(input, scenario);
          const comparison = FinancialForecastingEngine.compare(baseline, snapshot, scenario.name);
          const persisted = await persistFinancialForecastSnapshot(ctx, input, snapshot, scenario);
          return { input, baseline, scenario, snapshot, comparison, persisted };
        });
      } catch (error) {
        throw toSafeError(error);
      }
    },
    async readDigitalTwin(session: AuthenticatedSession): Promise<TwinPersistedState> {
      try {
        return await withScopedTransaction(ctxFromSession(session), async (ctx) => {
          const model = await readModel(session);
          await ensureUser(ctx);
          const twin = FinancialDigitalTwinEngine.buildFromVault(model.vault);
          let scenarioRows = await scopedDb(ctx).query<{ appId: string; payload: TwinScenario; active: boolean }>(
            `select app_id as "appId", payload, active from digital_twin_scenarios where user_id = $1 and archived_at is null order by active desc, created_at asc`,
            [ctx.session.userId],
          );
          if (scenarioRows.rows.length === 0) {
            for (const scenario of FinancialDigitalTwinEngine.defaultScenarios(twin)) {
              await scopedDb(ctx).query(
                `insert into digital_twin_scenarios(user_id, app_id, title, assumptions, active, payload, baseline, source, correlation_id)
                 values ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8, $9)
                 on conflict (user_id, app_id) do nothing`,
                [ctx.session.userId, scenario.id, scenario.name, JSON.stringify({ events: scenario.events, horizonYears: scenario.horizonYears, probability: scenario.probability }), scenario.id === "current", JSON.stringify(scenario), scenario.id === "current", ctx.source, ctx.correlationId],
              );
            }
            scenarioRows = await scopedDb(ctx).query<{ appId: string; payload: TwinScenario; active: boolean }>(
              `select app_id as "appId", payload, active from digital_twin_scenarios where user_id = $1 and archived_at is null order by active desc, created_at asc`,
              [ctx.session.userId],
            );
          }
          const scenarios = scenarioRows.rows.map((row) => ({ ...row.payload, id: row.appId }));
          const runs = await scopedDb(ctx).query<{ result: TwinSimulationOutput }>(
            `select result from simulation_runs where user_id = $1 order by created_at desc limit 50`,
            [ctx.session.userId],
          );
          const timelineRows = await scopedDb(ctx).query<{ payload: TwinTimelineEvent | null }>(
            `select before_values as payload from timeline_events where user_id = $1 and entity_type = 'digital_twin' and archived_at is null order by event_time desc limit 150`,
            [ctx.session.userId],
          );
          const simulationHistory = runs.rows.map((row) => row.result);
          return {
            twin,
            scenarios,
            simulationHistory,
            decisionHistory: simulationHistory.flatMap((run) => run.decisions),
            timelineEvents: timelineRows.rows.flatMap((row) => row.payload ? [row.payload] : []),
            calculationSnapshots: simulationHistory.map((run) => run.yearly),
          };
        });
      } catch (error) {
        throw toSafeError(error);
      }
    },
    async saveTwinScenario(session: AuthenticatedSession, scenario: TwinScenario): Promise<TwinPersistedState> {
      await withScopedTransaction(ctxFromSession(session), async (ctx) => {
        await ensureUser(ctx);
        const userId = await scope(ctx);
        await idempotency(ctx, "digital-twin.scenario.save", `digital-twin:scenario:${scenario.id}:${hashRecord(scenario)}`, scenario);
        await scopedDb(ctx).query(
          `insert into digital_twin_scenarios(user_id, app_id, title, assumptions, active, payload, baseline, source, correlation_id)
           values ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8, $9)
           on conflict (user_id, app_id) do update
             set title = excluded.title,
                 assumptions = excluded.assumptions,
                 active = excluded.active,
                 payload = excluded.payload,
                 baseline = excluded.baseline,
                 version = digital_twin_scenarios.version + 1,
                 updated_at = now(),
                 source = excluded.source,
                 correlation_id = excluded.correlation_id`,
          [userId, scenario.id, scenario.name, JSON.stringify({ events: scenario.events, horizonYears: scenario.horizonYears, probability: scenario.probability }), scenario.id === "current", JSON.stringify(scenario), scenario.id === "current", ctx.source, ctx.correlationId],
        );
      });
      return this.readDigitalTwin(session);
    },
    async runTwinScenario(session: AuthenticatedSession, scenarioId: string): Promise<TwinPersistedState> {
      const state = await this.readDigitalTwin(session);
      const scenario = state.scenarios.find((item) => item.id === scenarioId) ?? state.scenarios[0];
      if (!scenario) throw new CoreDecisioningPersistenceError("NOT_FOUND", "Scenario was not found.", 404);
      const output = FinancialDigitalTwinEngine.simulate(state.twin, scenario);
      await withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const userId = await scope(ctx);
        const scenarioDb = await scopedDb(ctx).query<{ id: string }>(
          `select id from digital_twin_scenarios where user_id = $1 and app_id = $2`,
          [userId, scenario.id],
        );
        const outputHash = hashRecord(output);
        const snapshot = await scopedDb(ctx).query<{ id: string }>(
          `insert into calculation_snapshots(user_id, engine_name, engine_version, input_fact_versions, rule_versions, assumptions, output_hash, source, correlation_id)
           values ($1, 'Digital Twin', $2, $3::jsonb, '[]'::jsonb, $4::jsonb, $5, $6, $7)
           returning id`,
          [userId, TWIN_ENGINE_VERSION, JSON.stringify([]), JSON.stringify({ scenarioId: scenario.id, output }), outputHash, ctx.source, ctx.correlationId],
        );
        await scopedDb(ctx).query(
          `insert into simulation_runs(user_id, app_id, scenario_id, calculation_snapshot_id, result, confidence, engine_version, input_fingerprint, warnings, source, correlation_id)
           values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb, $10, $11)
           on conflict (user_id, app_id) do nothing`,
          [userId, `simulation:${scenario.id}:${outputHash.slice(0, 12)}`, scenarioDb.rows[0]?.id ?? null, snapshot.rows[0]?.id ?? null, JSON.stringify(output), output.confidence, TWIN_ENGINE_VERSION, sha({ scenario, twin: state.twin }), JSON.stringify(output.assumptions.filter((item) => /warning/i.test(item))), ctx.source, ctx.correlationId],
        );
        for (const event of output.futureTimelineEvents) {
          await scopedDb(ctx).query(
            `insert into timeline_events(user_id, app_id, event_time, category, title, summary, entity_type, entity_id, before_values, after_values, evidence_ids, calculation_snapshot_id, source, correlation_id)
             values ($1, $2, make_timestamptz($3, 1, 1, 0, 0, 0), 'Digital Twin', $4, $5, 'digital_twin', $6, $7::jsonb, '{}'::jsonb, '{}'::uuid[], $8, $9, $10)
             on conflict (user_id, app_id) do nothing`,
            [userId, event.id, event.year, event.title, event.description, scenarioDb.rows[0]?.id ?? null, JSON.stringify(event), snapshot.rows[0]?.id ?? null, ctx.source, ctx.correlationId],
          );
        }
      });
      return this.readDigitalTwin(session);
    },
    async readHousingAffordability(session: AuthenticatedSession): Promise<HousingAffordabilityState> {
      const model = await readModel(session);
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        await ensureUser(ctx);
        return readHousingState(ctx, model);
      });
    },
    async createHousingScenario(session: AuthenticatedSession, input: HousingScenarioInput): Promise<HousingAffordabilityState> {
      const model = await readModel(session);
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        await ensureUser(ctx);
        const current = await readHousingState(ctx, model);
        await idempotency(ctx, "housing.scenario.create", `housing:${hashRecord({ userId: ctx.session.userId, input })}`, input);
        const next = await createHousingAffordabilityScenarioState(input, model.vault, current);
        await persistHousingState(ctx, next, "Housing scenario generated from persisted Financial Vault inputs");
        return next;
      });
    },
    async generateHousingReport(session: AuthenticatedSession, scenarioId: string): Promise<HousingAffordabilityState> {
      const model = await readModel(session);
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        await ensureUser(ctx);
        const current = await readHousingState(ctx, model);
        const next = generateHousingAffordabilityReportState(scenarioId, model.vault, current);
        await persistHousingState(ctx, next, "Housing purchase-readiness report generated");
        return next;
      });
    },
    async readAICfoInputs(session: AuthenticatedSession): Promise<AICfoInputs> {
      return persistedAiInputs(session);
    },
    async readDecisionCentre(session: AuthenticatedSession): Promise<{ decisions: AiDecision[]; states: Record<string, DecisionLifecycleState> }> {
      const decisions = await generatedDecisions(session);
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        await ensureUser(ctx);
        for (const decision of decisions) await upsertDecision(ctx, decision);
        return { decisions, states: await latestDecisionStateMap(ctx) };
      });
    },
    async updateDecisionStatus(session: AuthenticatedSession, decisionId: string, status: AiDecisionStatus): Promise<Record<string, DecisionLifecycleState>> {
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        await ensureUser(ctx);
        return updateDecisionStatus(ctx, decisionId, status);
      });
    },
    async readWorkflows(session: AuthenticatedSession, decisions?: AiDecision[]): Promise<ActionWorkflowState> {
      return withScopedTransaction(ctxFromSession(session), (ctx) => buildWorkflowState(session, decisions, ctx));
    },
    async updateWorkflowStep(session: AuthenticatedSession, workflowId: string, stepId: string, status: ActionWorkflowStepStatus): Promise<ActionWorkflowState> {
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const state = await buildWorkflowState(session, undefined, ctx);
        const executionId = workflowId.replace(/^workflow-/, "execution-");
        const current = state.executions.find((item) => item.id === executionId);
        if (!current) throw new CoreDecisioningPersistenceError("NOT_FOUND", "Workflow was not found.", 404);
        const next = WorkflowExecutionEngine.transitionStep(current, stepId, status, "user", nowIso()).execution;
        await upsertExecution(ctx, next);
        return buildWorkflowState(session, undefined, ctx);
      });
    },
    async dismissWorkflow(session: AuthenticatedSession, workflowId: string): Promise<ActionWorkflowState> {
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const state = await buildWorkflowState(session, undefined, ctx);
        const executionId = workflowId.replace(/^workflow-/, "execution-");
        const current = state.executions.find((item) => item.id === executionId);
        if (!current) throw new CoreDecisioningPersistenceError("NOT_FOUND", "Workflow was not found.", 404);
        const at = nowIso();
        await upsertExecution(ctx, WorkflowExecutionEngine.normalise({
          ...current,
          status: "Cancelled",
          executionStatus: "Cancelled",
          lastUpdatedAt: at,
          auditEvents: [{ id: `audit-cancelled-${at.replace(/[^0-9]/g, "").slice(0, 14)}`, at, eventType: "cancelled", summary: "Workflow cancelled by user.", immutable: true, supersedesEventId: null }, ...current.auditEvents],
        }));
        return buildWorkflowState(session, undefined, ctx);
      });
    },
    async addWorkflowEvidence(session: AuthenticatedSession, workflowId: string, evidence: WorkflowEvidenceInput): Promise<ActionWorkflowState> {
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const state = await buildWorkflowState(session, undefined, ctx);
        const current = state.executions.find((item) => item.id === workflowId.replace(/^workflow-/, "execution-"));
        if (!current) throw new CoreDecisioningPersistenceError("NOT_FOUND", "Workflow was not found.", 404);
        const next = WorkflowExecutionEngine.addEvidence(current, evidence, "user", nowIso()).execution;
        await upsertExecution(ctx, next);
        return buildWorkflowState(session, undefined, ctx);
      });
    },
    async verifyWorkflowOutcome(session: AuthenticatedSession, workflowId: string, actualValue: number | null, evidenceIds: string[], recalculationSucceeded = true): Promise<ActionWorkflowState> {
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const state = await buildWorkflowState(session, undefined, ctx);
        const current = state.executions.find((item) => item.id === workflowId.replace(/^workflow-/, "execution-"));
        if (!current) throw new CoreDecisioningPersistenceError("NOT_FOUND", "Workflow was not found.", 404);
        const next = WorkflowExecutionEngine.evaluateOutcome(current, actualValue, evidenceIds, recalculationSucceeded, nowIso());
        await upsertExecution(ctx, next);
        return buildWorkflowState(session, undefined, ctx);
      });
    },
    async generateWorkflowArtefact(session: AuthenticatedSession, workflowId: string, type: WorkflowArtefact["type"]): Promise<ActionWorkflowState> {
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const state = await buildWorkflowState(session, undefined, ctx);
        const current = state.executions.find((item) => item.id === workflowId.replace(/^workflow-/, "execution-"));
        if (!current) throw new CoreDecisioningPersistenceError("NOT_FOUND", "Workflow was not found.", 404);
        const next = WorkflowExecutionEngine.generateArtefact(current, type, nowIso());
        await upsertExecution(ctx, next);
        return buildWorkflowState(session, undefined, ctx);
      });
    },
    async readAICfoState(session: AuthenticatedSession): Promise<AICfoPersistedState> {
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const userId = await scope(ctx);
        const rows = await scopedDb(ctx).query<{ payload: AICfoRunResult }>(
          `select a.payload
           from ai_cfo_answers a
           join ai_cfo_questions q on q.id = a.question_id and q.user_id = a.user_id
           where a.user_id = $1
           order by a.created_at desc
           limit 100`,
          [userId],
        );
        const history = rows.rows.map((row) => row.payload);
        return {
          history,
          decisions: history.map((item) => item.generatedDecision),
          timelineEvents: history.map((item) => item.timelineEvent),
          adviserBriefs: history.map((item) => item.adviserBrief),
        };
      });
    },
    async readCopilotHistory(session: AuthenticatedSession, limit = 20): Promise<{ history: PersistedCopilotHistoryEntry[]; total: number }> {
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const userId = await scope(ctx);
        const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
        const total = await scopedDb(ctx).query<{ count: string }>(
          `select count(*)::text as count from ai_cfo_answers where user_id = $1 and output_classification = 'legacy-copilot-history'`,
          [userId],
        );
        const rows = await scopedDb(ctx).query<{
          id: string;
          question: string;
          answer: { directAnswer?: string } | string | null;
          askedAt: string;
          context: Record<string, unknown> | null;
        }>(
          `select a.app_id as id,
                  q.user_query as question,
                  a.answer,
                  a.created_at as "askedAt",
                  a.payload as context
           from ai_cfo_answers a
           join ai_cfo_questions q on q.id = a.question_id and q.user_id = a.user_id
           where a.user_id = $1 and a.output_classification = 'legacy-copilot-history'
           order by a.created_at desc
           limit $2`,
          [userId, boundedLimit],
        );
        return {
          total: Number(total.rows[0]?.count ?? 0),
          history: rows.rows.map((row) => ({
            id: row.id,
            question: row.question,
            answer: typeof row.answer === "string" ? row.answer : row.answer?.directAnswer ?? "",
            askedAt: row.askedAt,
            context: row.context ?? {},
          })),
        };
      });
    },
    async appendCopilotHistory(session: AuthenticatedSession, input: { question: string; answer: string }): Promise<PersistedCopilotHistoryEntry> {
      const question = input.question.trim().slice(0, 4000);
      const answer = input.answer.trim().slice(0, 8000);
      if (!question || !answer) throw new CoreDecisioningPersistenceError("VALIDATION_FAILED", "question and answer required", 400);
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const userId = await scope(ctx);
        const askedAt = nowIso();
        const appId = `legacy-copilot-${randomUUID()}`;
        const context = {
          source: "legacy-copilot-history",
          nonAuthoritative: true,
          importedAt: askedAt,
        };
        const q = await scopedDb(ctx).query<{ id: string }>(
          `insert into ai_cfo_questions(user_id, app_id, conversation_id, prompt_version, user_query, workspace_context, source, correlation_id)
           values ($1, $2, 'legacy-copilot-history', 'legacy-copilot-history-v1', $3, $4::jsonb, $5, $6)
           returning id`,
          [userId, appId, question, JSON.stringify(context), ctx.source, ctx.correlationId],
        );
        await scopedDb(ctx).query(
          `insert into ai_cfo_answers(user_id, app_id, question_id, answer, payload, provider, model, output_classification, source, correlation_id)
           values ($1, $2, $3, $4::jsonb, $5::jsonb, 'legacy-copilot-import', 'none-approved', 'legacy-copilot-history', $6, $7)`,
          [userId, appId, q.rows[0].id, JSON.stringify({ directAnswer: answer }), JSON.stringify(context), ctx.source, ctx.correlationId],
        );
        return { id: appId, question, answer, askedAt, context };
      });
    },
    async runAndPersistAICfo(session: AuthenticatedSession, request: { userQuery: string; workspaceContext: string; selectedScenarioId: string; riskTolerance?: "low" | "medium" | "high"; timeHorizon?: number }): Promise<{ result: AICfoRunResult; state: AICfoPersistedState }> {
      const inputs = await persistedAiInputs(session);
      const result = AICfoOrchestrator.run(inputs, {
        ...request,
        riskTolerance: request.riskTolerance ?? "medium",
        timeHorizon: request.timeHorizon ?? 30,
      });
      await withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const userId = await scope(ctx);
        const outputHash = hashRecord({ request: result.request, answer: result.answer, context: result.context });
        const snapshot = await scopedDb(ctx).query<{ id: string }>(
          `insert into calculation_snapshots(user_id, engine_name, engine_version, input_fact_versions, rule_versions, assumptions, output_hash, source, correlation_id)
           values ($1, 'AI CFO', 'deterministic-ai-cfo-v1', $2::jsonb, '[]'::jsonb, $3::jsonb, $4, $5, $6)
           returning id`,
          [
            userId,
            JSON.stringify([]),
            JSON.stringify({
              requestId: result.request.id,
              selectedScenarioId: result.request.selectedScenarioId,
              enginesConsulted: result.enginesConsulted,
              evidenceCount: result.answer.evidence.length,
            }),
            outputHash,
            ctx.source,
            ctx.correlationId,
          ],
        );
        const q = await scopedDb(ctx).query<{ id: string }>(
          `insert into ai_cfo_questions(user_id, app_id, conversation_id, prompt_version, user_query, workspace_context, source, correlation_id)
           values ($1, $2, $3, 'deterministic-ai-cfo-v1', $4, $5::jsonb, $6, $7)
           returning id`,
          [userId, result.request.id, result.request.workspaceContext, result.request.userQuery, JSON.stringify(result.request), ctx.source, ctx.correlationId],
        );
        await scopedDb(ctx).query(
          `insert into ai_cfo_answers(user_id, app_id, question_id, answer, payload, provider, model, output_classification, calculation_snapshot_id, source, correlation_id)
           values ($1, $2, $3, $4::jsonb, $5::jsonb, 'deterministic-disabled-live-ai', 'none-approved', $6, $7, $8, $9)
           on conflict (user_id, app_id) do nothing`,
          [userId, result.answer.calculationSnapshotId || result.request.id, q.rows[0].id, JSON.stringify(result.answer), JSON.stringify(result), "ai_interpretation", snapshot.rows[0]?.id ?? null, ctx.source, ctx.correlationId],
        );
      });
      return { result, state: await this.readAICfoState(session) };
    },
    async readDailyReviews(session: AuthenticatedSession): Promise<DailyReviewPersistedState> {
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const userId = await scope(ctx);
        const settingsRows = await scopedDb(ctx).query<{ value: DailyReviewSettings }>(
          `select preference_value as value from user_preferences where user_id = $1 and preference_key = 'daily-review.settings'`,
          [userId],
        );
        const rows = await scopedDb(ctx).query<{ payload: DailyReviewHistoryRecord; status: string }>(
          `select payload, status from daily_reviews where user_id = $1 order by review_date desc, created_at desc limit 120`,
          [userId],
        );
        const history = rows.rows.flatMap((row) => row.payload?.review ? [row.payload] : []);
        return {
          settings: mergeDailySettings(settingsRows.rows[0]?.value),
          reviews: history.map((record) => record.review),
          history,
          lastSuccessfulReviewAt: history.find((record) => record.review.status !== "Failed Safely")?.review.createdAt ?? null,
        };
      });
    },
    async updateDailyReviewSettings(session: AuthenticatedSession, settings: Partial<DailyReviewSettings>): Promise<DailyReviewPersistedState> {
      const current = await this.readDailyReviews(session);
      const next = mergeDailySettings({ ...current.settings, ...settings });
      await withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const userId = await scope(ctx);
        await scopedDb(ctx).query(
          `insert into user_preferences(user_id, preference_key, preference_value, source, correlation_id)
           values ($1, 'daily-review.settings', $2::jsonb, $3, $4)
           on conflict (user_id, preference_key) do update
             set preference_value = excluded.preference_value, updated_at = now(), source = excluded.source, correlation_id = excluded.correlation_id`,
          [userId, JSON.stringify(next), ctx.source, ctx.correlationId],
        );
      });
      return this.readDailyReviews(session);
    },
    async runAndPersistDailyReview(session: AuthenticatedSession, input: { mode?: DailyReviewMode; settings?: Partial<DailyReviewSettings>; gptSummaryDraft?: string | null; engineFailures?: Parameters<typeof DailyReviewEngine.run>[0]["engineFailures"] } = {}): Promise<{ record: DailyReviewHistoryRecord; state: DailyReviewPersistedState }> {
      if (input.settings) await this.updateDailyReviewSettings(session, input.settings);
      const current = await this.readDailyReviews(session);
      const record = DailyReviewEngine.run({
        mode: input.mode ?? "live",
        inputs: await persistedAiInputs(session),
        settings: input.settings ? mergeDailySettings({ ...current.settings, ...input.settings }) : current.settings,
        now: nowIso(),
        gptSummaryDraft: input.gptSummaryDraft ?? null,
        engineFailures: input.engineFailures,
      });
      await withScopedTransaction(ctxFromSession(session), (ctx) => persistDailyReviewRecord(ctx, record));
      return { record, state: await this.readDailyReviews(session) };
    },
    async getLatestDailyReview(session: AuthenticatedSession): Promise<DailyReviewHistoryRecord> {
      const state = await this.readDailyReviews(session);
      if (state.history[0]) return state.history[0];
      return (await this.runAndPersistDailyReview(session, { mode: "live" })).record;
    },
    async readGoalState(session: AuthenticatedSession, horizon: ForecastHorizon = "12m", persistSnapshot = false): Promise<{ snapshot: GoalPlanningSnapshot; goals: FinancialGoal[]; scenarios: GoalScenarioVariant[] }> {
      const model = await readModel(session);
      return withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const userId = await scope(ctx);
        const forecast = FinancialForecastingEngine.generate(FinancialForecastingEngine.buildInput({ userId: model.userId, records: model.confirmedFacts, horizon, startDate: "2026-08-01" }));
        const goalRows = await scopedDb(ctx).query<{
          appId: string; userId: string; title: string; goalType: GoalType; status: GoalStatus; targetValue: string | number | null; currentValue: string | number | null; targetDate: string | null; priority: GoalPriority; payload: Partial<FinancialGoal> | null; createdAt: string; updatedAt: string; archivedAt: string | null;
        }>(
          `select app_id as "appId", user_id as "userId", title, goal_type as "goalType", status, target_value as "targetValue", current_value as "currentValue", target_date as "targetDate", priority, payload, created_at as "createdAt", updated_at as "updatedAt", archived_at as "archivedAt"
           from goals where user_id = $1 order by updated_at desc`,
          [userId],
        );
        const persistedGoals = goalRows.rows.map(normalizeGoalRow);
        const confirmedGoals = model.confirmedFacts.filter((record) => record.kind === "goal").map(GoalPlanningEngine.goalFromRecord);
        const goals = [...new Map([...confirmedGoals, ...persistedGoals].map((goal) => [goal.id, goal])).values()];
        const scenarioRows = await scopedDb(ctx).query<{ payload: GoalScenarioVariant }>(
          `select before_values as payload from timeline_events where user_id = $1 and entity_type = 'goal_scenario' and archived_at is null order by created_at desc`,
          [userId],
        );
        const scenarios = scenarioRows.rows.map((row) => row.payload);
        const snapshot = GoalPlanningEngine.buildSnapshot({ userId: model.userId, goals, scenarios, forecast });
        // Read-only requests must not create financial records. Goal mutations
        // explicitly opt in so their resulting calculation remains reproducible.
        if (persistSnapshot) {
          await scopedDb(ctx).query(
            `insert into calculation_snapshots(user_id, engine_name, engine_version, input_fact_versions, rule_versions, assumptions, output_hash, source, correlation_id)
             values ($1, 'Goals', $2, $3::jsonb, '[]'::jsonb, $4::jsonb, $5, $6, $7)`,
            [userId, snapshot.version, JSON.stringify([]), JSON.stringify({ snapshot }), snapshot.hash, ctx.source, ctx.correlationId],
          );
        }
        return { snapshot, goals: persistedGoals, scenarios };
      });
    },
    async ensureDefaultRetirementGoal(session: AuthenticatedSession): Promise<void> {
      await withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const userId = await scope(ctx);
        const goal = GoalPlanningEngine.createDefaultRetirementGoal(userId, nowIso());
        await scopedDb(ctx).query(
          `insert into goals(user_id, app_id, title, goal_type, status, target_value, current_value, target_date, priority, payload, source, correlation_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10::jsonb, $11, $12)
           on conflict (user_id, app_id) do nothing`,
          [userId, goal.id, goal.title, goal.type, goal.status, goal.targetAmount, goal.currentAmount, goal.targetDate, goal.priority, JSON.stringify(goal), ctx.source, ctx.correlationId],
        );
      });
    },
    async createGoal(session: AuthenticatedSession, input: { type: GoalType; title: string; description?: string; targetAmount: number; currentAmount?: number; targetDate?: string | null; priority?: GoalPriority; contributionAmount?: number; contributionFrequency?: FinancialGoal["contributionFrequency"]; idempotencyKey?: string }): Promise<{ snapshot: GoalPlanningSnapshot; goals: FinancialGoal[]; scenarios: GoalScenarioVariant[] }> {
      await withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const userId = await scope(ctx);
        const goal = GoalPlanningEngine.createGoal({ ...input, userId });
        await idempotency(ctx, "goals.create", input.idempotencyKey ?? `goal:${hashRecord({ ...input, userId })}`, input);
        await scopedDb(ctx).query(
          `insert into goals(user_id, app_id, title, goal_type, status, target_value, current_value, target_date, priority, payload, source, correlation_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10::jsonb, $11, $12)
           on conflict (user_id, app_id) do nothing`,
          [userId, goal.id, goal.title, goal.type, goal.status, goal.targetAmount, goal.currentAmount, goal.targetDate, goal.priority, JSON.stringify(goal), ctx.source, ctx.correlationId],
        );
      });
      return this.readGoalState(session, "12m", true);
    },
    async saveGoalScenario(session: AuthenticatedSession, scenario: GoalScenarioVariant): Promise<{ snapshot: GoalPlanningSnapshot; goals: FinancialGoal[]; scenarios: GoalScenarioVariant[] }> {
      await withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const userId = await scope(ctx);
        await scopedDb(ctx).query(
          `insert into timeline_events(user_id, app_id, event_time, category, title, summary, entity_type, entity_id, before_values, after_values, evidence_ids, source, correlation_id)
           values ($1, $2, now(), 'Goals', $3, 'Goal scenario saved.', 'goal_scenario', null, $4::jsonb, '{}'::jsonb, '{}'::uuid[], $5, $6)
           on conflict (user_id, app_id) do nothing`,
          [userId, scenario.id, scenario.name, JSON.stringify(scenario), ctx.source, ctx.correlationId],
        );
      });
      return this.readGoalState(session, "12m", true);
    },
    async updateGoalStatus(session: AuthenticatedSession, goalId: string, status: GoalStatus): Promise<{ snapshot: GoalPlanningSnapshot; goals: FinancialGoal[]; scenarios: GoalScenarioVariant[] }> {
      if (goalId === DEFAULT_RETIREMENT_GOAL_ID && ["PAUSED", "ARCHIVED"].includes(status)) {
        throw new CoreDecisioningPersistenceError("VALIDATION_FAILED", "The default retirement goal remains active. Update its assumptions instead.", 422);
      }
      await withScopedTransaction(ctxFromSession(session), async (ctx) => {
        const userId = await scope(ctx);
        const current = await scopedDb(ctx).query<{ payload: FinancialGoal }>(`select payload from goals where user_id = $1 and app_id = $2`, [userId, goalId]);
        if (!current.rows[0]) throw new CoreDecisioningPersistenceError("NOT_FOUND", "Goal was not found.", 404);
        const at = nowIso();
        const goal = { ...current.rows[0].payload, status, updatedAt: at, archivedAt: status === "ARCHIVED" ? at : current.rows[0].payload.archivedAt };
        await scopedDb(ctx).query(
          `update goals set status = $1, payload = $2::jsonb, archived_at = $3, updated_at = now(), version = version + 1, source = $4, correlation_id = $5 where user_id = $6 and app_id = $7`,
          [status, JSON.stringify(goal), status === "ARCHIVED" ? at : null, ctx.source, ctx.correlationId, userId, goalId],
        );
      });
      return this.readGoalState(session, "12m", true);
    },
  };
}
