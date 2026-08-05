import { buildAiDecisions } from "@/lib/aiDecisionCentre";
import type { AICfoInputs } from "@/lib/aiCfo";
import { buildFinancialBalanceSheetFromReadModel } from "@/lib/financialBalanceSheet";
import { FinancialDigitalTwinEngine, type TwinPersistedState } from "@/lib/financialDigitalTwin";
import { buildDefaultHousingAffordabilityState } from "@/lib/housingAffordabilityState";
import type { HousingAffordabilityState } from "@/lib/housingAffordabilityTypes";
import { StructureComparisonEngine } from "@/lib/structureComparisonEngine";
import type { AuthenticatedSession } from "@/lib/productionDataIntegrity";
import { createFinancialPositionReadServiceFromEnv, type FinancialPositionReadModel } from "@/server/services/financialPositionReadService";

if (typeof window !== "undefined") {
  throw new Error("Persisted AI CFO input service is server-only.");
}

export function buildAICfoInputsFromFinancialReadModel(
  model: FinancialPositionReadModel,
  twinOverride?: TwinPersistedState,
  housingOverride?: HousingAffordabilityState,
): AICfoInputs {
  const vault = model.vault;
  const balanceSheet = buildFinancialBalanceSheetFromReadModel(model);
  const housing = housingOverride ?? buildDefaultHousingAffordabilityState(vault);
  const twinState = twinOverride ?? FinancialDigitalTwinEngine.createPersistedState(vault);
  const decisions = buildAiDecisions({ vault, housing, balanceSheet });
  const structureComparison = StructureComparisonEngine.fromVault(vault);
  return {
    vault,
    twinState,
    balanceSheet,
    housing,
    decisions,
    structureComparison,
  };
}

export function createPersistedAICfoInputServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const readService = createFinancialPositionReadServiceFromEnv(env);
  return {
    async read(session: AuthenticatedSession, correlationId?: string): Promise<AICfoInputs> {
      return buildAICfoInputsFromFinancialReadModel(await readService.read(session, correlationId));
    },
  };
}
