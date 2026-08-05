import { buildAiDecisions } from "@/lib/aiDecisionCentre";
import { getFinancialBalanceSheet } from "@/lib/financialBalanceSheet";
import { FinancialDigitalTwinEngine } from "@/lib/financialDigitalTwin";
import { createDemoFinancialVaultState } from "@/lib/financialVaultEmptyState";
import { buildDefaultHousingAffordabilityState } from "@/lib/housingAffordabilityState";
import { StructureComparisonEngine } from "@/lib/structureComparisonEngine";
import type { AICfoInputs } from "@/lib/aiCfo";
import type { FinancialVaultState } from "@/lib/financialVaultTypes";

function assertLegacyAICfoRuntimeAllowed(): void {
  if (process.env.NODE_ENV === "production" && process.env.VIREON_ALLOW_LEGACY_AI_CFO_RUNTIME !== "true") {
    throw new Error("Legacy AI CFO runtime input builder is disabled in production. Use PostgreSQL-backed core decisioning inputs.");
  }
}

export function gatherAICfoInputs(vault: FinancialVaultState = createDemoFinancialVaultState()): AICfoInputs {
  assertLegacyAICfoRuntimeAllowed();
  const twinState = FinancialDigitalTwinEngine.createPersistedState(vault);
  const balanceSheet = getFinancialBalanceSheet();
  const housing = buildDefaultHousingAffordabilityState(vault);
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
