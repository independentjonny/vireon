import type { RetirementGoals } from "@/lib/retirementGoals";
import { createHash } from "node:crypto";
import type { PostgresPilotClient } from "@/lib/postgresPilotPersistence";
import type { AuthenticatedSession } from "@/lib/productionDataIntegrity";
import type { FinancialGoal } from "@/lib/goalPlanning";
import type { TrajectorySettings } from "@/lib/wealthTrajectory";
import { goalFundingFacts, initialFundingPlan } from "@/lib/goalFundingInputs";
import { validateFundingPlan, type FundingFacts, type FundingPlan } from "@/lib/goalFundingModel";
import { createRuntimeDatabaseConfigFromEnv, PsqlRuntimeClient } from "@/server/db/postgresRuntime";
import { createFinancialPositionReadServiceFromEnv, type FinancialPositionReadModel } from "@/server/services/financialPositionReadService";
import { createFinancialVaultServiceFromEnv, uuidFromTrustedUserId } from "@/server/services/financialVaultPostgresService";
if (typeof window !== "undefined") throw new Error("Goal funding PostgreSQL service is server-only.");

export type FundingWorkspace = { accountEmail?: string; facts: FundingFacts; plan: FundingPlan; revision: string; alternatives: Array<{ id: string; name: string; plan: FundingPlan }>; history: Array<{ id: string; name: string; plan: FundingPlan }> };
type Seed = { position: FinancialPositionReadModel; trajectory: TrajectorySettings | null; retirement?: RetirementGoals | null };
type GoalRow = { id: string; payload: FinancialGoal; version: number };
type Preference = { value: { assumptions: FundingPlan["assumptions"] }; version: number };
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export class GoalFundingError extends Error { readonly status: number; constructor(message: string, status = 422) { super(message); this.status = status; } }

export function createGoalFundingPostgresService(client: PostgresPilotClient, readSeed: (session: AuthenticatedSession) => Promise<Seed>) {
  function user(session: AuthenticatedSession) { if (!session.userId) throw new GoalFundingError("Sign in is required.", 401); return uuidFromTrustedUserId(session.userId); }
  async function scoped<T>(id: string, operation: (tx: PostgresPilotClient) => Promise<T>) {
    return client.transaction(async tx => { await tx.query("select set_config('app.current_user_id', $1, true)", [id]); return operation(tx); });
  }
  async function state(tx: PostgresPilotClient, id: string, seed: Seed, lock = false): Promise<FundingWorkspace & { rows: GoalRow[] }> {
    const rows = (await tx.query<GoalRow>(`select app_id as id, coalesce(payload,'{}'::jsonb) || jsonb_build_object('id',app_id,'userId',user_id,'title',title,'type',goal_type,'status',status,'targetAmount',target_value,'currentAmount',current_value,'targetDate',target_date,'priority',priority) as payload, version from goals where user_id = $1 order by app_id${lock ? " for update" : ""}`, [id])).rows;
    const preferences = (await tx.query<Preference>("select preference_value as value, version from user_preferences where user_id = $1 and preference_key = 'goal-funding-assumptions-v1'", [id])).rows[0];
    const facts = goalFundingFacts(seed.position), plan = initialFundingPlan(facts, rows.map(row => row.payload), seed.trajectory, seed.retirement);
    if (preferences) plan.assumptions = { ...preferences.value.assumptions, retirementDate: plan.assumptions.retirementDate, retirementIncome: plan.assumptions.retirementIncome, retirementSpending: plan.assumptions.retirementSpending, ...(seed.retirement ? { alreadyRetired: plan.assumptions.alreadyRetired } : {}) };
    const scenarios = (await tx.query<{ id: string; name: string; before: FundingPlan; after: { plan: FundingPlan }; type: string }>("select app_id as id, title as name, before_values as before, after_values as after, entity_type as type from timeline_events where user_id = $1 and entity_type in ('goal_funding_alternative','goal_funding_plan') and archived_at is null order by created_at desc limit 50", [id])).rows;
    return { rows, facts, plan, revision: hash({ rows, preferences: preferences ?? null, retirement: seed.retirement ?? null, facts }),
      alternatives: scenarios.filter(row => row.type === "goal_funding_alternative").map(row => ({ id: row.id, name: row.name, plan: row.after.plan })),
      history: scenarios.filter(row => row.type === "goal_funding_plan").map(row => ({ id: row.id, name: row.name, plan: row.before })) };
  }
  const publicState = ({ facts, plan, revision, alternatives, history }: FundingWorkspace & { rows: GoalRow[] }): FundingWorkspace => ({ facts, plan, revision, alternatives, history });
  return {
    async read(session: AuthenticatedSession, provided?: Seed): Promise<FundingWorkspace> {
      const id = user(session), seed = provided ?? await readSeed(session);
      if (uuidFromTrustedUserId(seed.position.userId) !== id) throw new GoalFundingError("Financial input ownership does not match the signed-in user.", 403);
      return scoped(id, async tx => publicState(await state(tx, id, seed)));
    },
    async save(session: AuthenticatedSession, input: { action: "alternative" | "adopt"; plan: FundingPlan; expectedRevision: string; requestId: string; name?: string }): Promise<FundingWorkspace> {
      const id = user(session);
      if (!["alternative", "adopt"].includes(input.action) || !/^[a-zA-Z0-9-]{8,100}$/.test(input.requestId) || typeof input.expectedRevision !== "string") throw new GoalFundingError("Invalid save request.");
      if (input.action === "alternative" && (typeof input.name !== "string" || !input.name.trim() || input.name.length > 120)) throw new GoalFundingError("Give this alternative a name of up to 120 characters.");
      // Read confirmed inputs before opening the mutation transaction: no nested pool acquisition.
      const seed = await readSeed(session), facts = goalFundingFacts(seed.position);
      if (uuidFromTrustedUserId(seed.position.userId) !== id) throw new GoalFundingError("Financial input ownership does not match the signed-in user.", 403);
      const goalSettings = initialFundingPlan(facts, [], seed.trajectory, seed.retirement).assumptions;
      for (const key of ["retirementDate", "retirementIncome", "retirementSpending"] as const) if (seed.retirement && input.plan.assumptions[key] !== goalSettings[key]) throw new GoalFundingError("Retirement settings changed in Goals. Reload the saved plan before continuing.", 409);
      try { validateFundingPlan(input.plan, facts); } catch (error) { throw new GoalFundingError(error instanceof Error ? error.message : "Invalid funding instructions."); }
      return scoped(id, async tx => {
        await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [`goal-funding:${id}`]);
        const eventId = `goal-funding-${input.action}-${input.requestId}`;
        const replay = (await tx.query<{ after: { requestHash: string } }>("select after_values as after from timeline_events where user_id = $1 and app_id = $2", [id, eventId])).rows[0];
        const requestHash = hash({ action: input.action, plan: input.plan, name: input.name });
        if (replay) { if (replay.after.requestHash !== requestHash) throw new GoalFundingError("This request ID was already used with different changes.", 409); return publicState(await state(tx, id, seed)); }
        const before = await state(tx, id, seed, true);
        if (before.revision !== input.expectedRevision) throw new GoalFundingError("The saved plan or financial records changed. Reload before saving your preview.", 409);
        if (input.action === "adopt") {
          const at = new Date().toISOString();
          const previous = new Map(before.rows.map(row => [row.id, row]));
          // Omitted existing goals are preserved. The editor cannot delete or archive unrelated goals.
          if (before.plan.goals.some(goal => !input.plan.goals.some(next => next.id === goal.id))) throw new GoalFundingError("Existing goals must remain in the plan. Use the Goals workspace for lifecycle changes.");
          for (const goal of input.plan.goals) {
            const existing = previous.get(goal.id);
            const payload: FinancialGoal = existing ? { ...existing.payload, title: goal.title, targetAmount: goal.cost, targetDate: goal.paymentDate, priority: goal.priority, funding: goal.funding, contributionAmount: goal.funding.surplus.useAllSurplus ? 0 : goal.funding.surplus.monthly, contributionFrequency: "monthly", updatedAt: at } : {
              id: goal.id, userId: id, type: "CUSTOM", title: goal.title, description: "Goal funding plan", targetAmount: goal.cost, currentAmount: 0,
              targetDate: goal.paymentDate, priority: goal.priority, status: "ACTIVE", linkedAccounts: [], linkedAssets: [], linkedLiabilities: [], linkedScenario: null,
              contributionAmount: goal.funding.surplus.useAllSurplus ? 0 : goal.funding.surplus.monthly, contributionFrequency: "monthly", assumptions: [], provenance: { source: "manual", sourceRecordIds: [], confidence: 100 }, createdAt: at, updatedAt: at, archivedAt: null, funding: goal.funding,
            };
            await tx.query(`insert into goals(user_id, app_id, title, goal_type, status, target_value, current_value, target_date, priority, payload, source, correlation_id)
              values ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10::jsonb,'goal-funding', $11)
              on conflict (user_id, app_id) do update set title=excluded.title, target_value=excluded.target_value, target_date=excluded.target_date, priority=excluded.priority, payload=excluded.payload, version=goals.version+1, updated_at=now(), source='goal-funding', correlation_id=excluded.correlation_id`,
              [id, goal.id, payload.title, payload.type, payload.status, goal.cost, payload.currentAmount, goal.paymentDate, goal.priority, JSON.stringify(payload), input.requestId]);
          }
          await tx.query(`insert into user_preferences(user_id,preference_key,preference_value,source,correlation_id) values($1,'goal-funding-assumptions-v1',$2::jsonb,'goal-funding',$3)
            on conflict(user_id,preference_key) do update set preference_value=excluded.preference_value,version=user_preferences.version+1,updated_at=now(),source='goal-funding',correlation_id=excluded.correlation_id`, [id, JSON.stringify({ assumptions: input.plan.assumptions }), input.requestId]);
        }
        await tx.query(`insert into timeline_events(user_id,app_id,event_time,category,title,summary,entity_type,entity_id,before_values,after_values,evidence_ids,source,correlation_id)
          values($1,$2,now(),'Goals',$3,$4,$5,null,$6::jsonb,$7::jsonb,'{}'::uuid[],'goal-funding',$8)`,
          [id, eventId, input.action === "alternative" ? input.name!.trim() : `Active funding plan before ${new Date().toISOString()}`, input.action === "alternative" ? "Named funding alternative; active goals unchanged." : "Funding plan adopted. Confirmed balances and transactions unchanged.", input.action === "alternative" ? "goal_funding_alternative" : "goal_funding_plan", JSON.stringify(before.plan), JSON.stringify({ plan: input.plan, requestHash }), input.requestId]);
        return publicState(await state(tx, id, seed));
      });
    },
  };
}
export function createGoalFundingServiceFromEnv() {
  const client = new PsqlRuntimeClient(createRuntimeDatabaseConfigFromEnv());
  return createGoalFundingPostgresService(client, async session => {
    const [position, trajectory, retirement] = await Promise.all([createFinancialPositionReadServiceFromEnv().read(session), createFinancialVaultServiceFromEnv().getTrajectory(session), createFinancialVaultServiceFromEnv().getRetirementGoals(session)]);
    return { position, trajectory, retirement };
  });
}
