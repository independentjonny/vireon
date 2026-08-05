import { requireSession, type Session } from "@/lib/auth/middleware";
import { FinancialForecastingEngine } from "@/lib/financialForecasting";
import { buildFinancialHealthSnapshot } from "@/lib/financialHealthEngine";
import { GoalPlanningEngine } from "@/lib/goalPlanning";
import type { CanonicalFinancialRecord } from "@/lib/manualFinancialDataPlatform";
import {
  PrivateBetaFoundation,
  type BetaSession,
  type DeterministicBriefing,
  type PrivateBetaReadinessReport,
  type ProvenanceView,
} from "@/lib/privateBetaFoundation";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export type PrivateBetaContext = {
  session: BetaSession;
  records: CanonicalFinancialRecord[];
  health: ReturnType<typeof buildFinancialHealthSnapshot>;
  forecast: ReturnType<typeof FinancialForecastingEngine.generate>;
  goals: ReturnType<typeof GoalPlanningEngine.buildSnapshot>;
  briefing: DeterministicBriefing;
  provenance: ProvenanceView[];
  readiness: PrivateBetaReadinessReport;
};

export async function getRequestSession(request: Request): Promise<Session | null> {
  const auth = await requireSession(request);
  return auth.ok ? auth.session : null;
}

export function toBetaSession(session: Session): BetaSession {
  return {
    userId: session.userId,
    householdId: session.workspaceId,
    email: session.email,
    role: session.role === "owner" ? "admin" : "user",
    expiresAt: session.expiresAt,
  };
}

export async function buildPrivateBetaContext(session: BetaSession): Promise<PrivateBetaContext> {
  if (!session.userId || !session.householdId) throw new Error("UNAUTHENTICATED");
  const runtimeConfig = PrivateBetaFoundation.configFromEnv();
  const persistence = PrivateBetaFoundation.evaluatePersistenceBoundary(runtimeConfig);
  if (!persistence.ok) throw new Error("PRIVATE_BETA_PERSISTENCE_BLOCKED");
  const readModel = await createFinancialPositionReadServiceFromEnv().read({ userId: session.userId, expiresAt: session.expiresAt ?? null });
  const records = readModel.confirmedFacts;
  const health = buildFinancialHealthSnapshot({ userId: readModel.userId, records });
  const forecastInput = FinancialForecastingEngine.buildInput({ userId: readModel.userId, records, horizon: "12m" });
  const forecast = FinancialForecastingEngine.generate(forecastInput);
  const goals = (await createCoreDecisioningServiceFromEnv().readGoalState({ userId: session.userId, expiresAt: session.expiresAt ?? null })).snapshot;
  const briefing = PrivateBetaFoundation.buildDeterministicBriefing({
    userId: session.userId,
    householdId: session.householdId,
    records,
    health,
    forecast,
    goals,
  });
  const provenance = PrivateBetaFoundation.buildProvenanceViews({ health, forecast, goals });
  const readiness = PrivateBetaFoundation.buildPrivateBetaReadinessReport(runtimeConfig);
  return { session, records, health, forecast, goals, briefing, provenance, readiness };
}

export function betaSafeError(error: unknown): { error: string; referenceId: string } {
  return {
    error: error instanceof Error && /^[A-Z_:-]+$/.test(error.message) ? error.message : "PRIVATE_BETA_OPERATION_FAILED",
    referenceId: `err-${Date.now().toString(36)}`,
  };
}
