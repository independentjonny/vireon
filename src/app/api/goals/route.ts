import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import {
  type FinancialGoal,
  type GoalPriority,
  type GoalScenarioVariant,
  type GoalType,
} from "@/lib/goalPlanning";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const current = auth.session;
  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    service = createCoreDecisioningServiceFromEnv();
    const state = await service.readGoalState(current);
    return Response.json({ ok: true, snapshot: state.snapshot, goals: state.goals.filter((goal) => goal.userId === state.snapshot.userId), scenarios: state.scenarios });
  } catch (error) {
    const safe = service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable.", code: "POSTGRES_UNAVAILABLE", status: 503 };
    return Response.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const current = auth.session;
  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    const body = (await request.json()) as {
      action?: "create-goal" | "save-scenario" | "pause-goal" | "archive-goal";
      goal?: Partial<FinancialGoal> & { type?: GoalType; priority?: GoalPriority };
      scenario?: Partial<GoalScenarioVariant>;
      goalId?: string;
    };
    service = createCoreDecisioningServiceFromEnv();
    let state;
    if (body.action === "create-goal") {
      if (!body.goal?.type || !body.goal?.title || body.goal.targetAmount == null) throw new Error("GOAL_FIELDS_REQUIRED");
      state = await service.createGoal(current, {
        type: body.goal.type,
        title: body.goal.title,
        description: body.goal.description,
        targetAmount: Number(body.goal.targetAmount),
        currentAmount: Number(body.goal.currentAmount ?? 0),
        targetDate: body.goal.targetDate ?? null,
        priority: body.goal.priority ?? "medium",
        contributionAmount: Number(body.goal.contributionAmount ?? 0),
        contributionFrequency: body.goal.contributionFrequency ?? "monthly",
      });
    }
    if (body.action === "save-scenario") {
      if (!body.scenario?.goalId) throw new Error("SCENARIO_GOAL_REQUIRED");
      state = await service.saveGoalScenario(current, {
        id: body.scenario.id ?? `goal-scenario-${Date.now()}`,
        goalId: body.scenario.goalId,
        name: body.scenario.name ?? "custom",
        contributionAmount: Number(body.scenario.contributionAmount ?? 0),
        oneOffDeposit: Number(body.scenario.oneOffDeposit ?? 0),
        startDelayMonths: Number(body.scenario.startDelayMonths ?? 0),
        incomeChange: Number(body.scenario.incomeChange ?? 0),
        expenseReduction: Number(body.scenario.expenseReduction ?? 0),
        createdAt: new Date().toISOString(),
        archived: false,
      });
    }
    if (body.action === "pause-goal") {
      if (!body.goalId) throw new Error("GOAL_NOT_FOUND");
      state = await service.updateGoalStatus(current, body.goalId, "PAUSED");
    }
    if (body.action === "archive-goal") {
      if (!body.goalId) throw new Error("GOAL_NOT_FOUND");
      state = await service.updateGoalStatus(current, body.goalId, "ARCHIVED");
    }
    state ??= await service.readGoalState(current);
    return Response.json({ ok: true, snapshot: state.snapshot, goals: state.goals.filter((goal) => goal.userId === state.snapshot.userId), scenarios: state.scenarios });
  } catch (error) {
    const safe = error instanceof Error && error.message.startsWith("GOAL_")
      ? { message: error.message, code: "GOAL_VALIDATION_ERROR", status: 422 }
      : service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable.", code: "POSTGRES_UNAVAILABLE", status: 503 };
    return Response.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}
