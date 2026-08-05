import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  calculateHouseReadiness,
} from "@/lib/housingAffordabilityEngine";
import { createEmptyFinancialVaultState } from "@/lib/financialVaultEmptyState";
import {
  buildDefaultHousingAffordabilityState,
  createHousingAffordabilityScenarioState,
  generateHousingAffordabilityReportState,
} from "@/lib/housingAffordabilityState";
import type {
  HousingAffordabilityState,
  HousingScenarioInput,
} from "@/lib/housingAffordabilityTypes";
import type { FinancialVaultState } from "@/lib/financialVaultTypes";

const DATA_DIR = join(process.cwd(), ".ai", "local-data");
const HOUSING_FILE = "housing-affordability.json";

function assertLegacyLocalHousingStoreAllowed(): void {
  if (process.env.NODE_ENV === "production" && process.env.VIREON_ALLOW_LEGACY_LOCAL_HOUSING_STORE !== "true") {
    throw new Error("Legacy local Housing store is disabled in production. Use PostgreSQL-backed Housing persistence.");
  }
}

function ensureDataDir(): void {
  assertLegacyLocalHousingStoreAllowed();
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePath(): string {
  ensureDataDir();
  return join(DATA_DIR, HOUSING_FILE);
}

export function getHousingAffordabilityState(vault: FinancialVaultState = createEmptyFinancialVaultState()): HousingAffordabilityState {
  const path = filePath();
  if (!existsSync(path)) {
    const seeded = buildDefaultHousingAffordabilityState(vault);
    writeHousingAffordabilityState(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as HousingAffordabilityState;
    const primary = parsed.housing_scenarios[0];
    return {
      housing_scenarios: parsed.housing_scenarios ?? [],
      housing_obstacles: parsed.housing_obstacles ?? [],
      housing_action_plans: parsed.housing_action_plans ?? [],
      housing_ai_analysis: parsed.housing_ai_analysis ?? [],
      house_readiness_score: calculateHouseReadiness(vault.financial_profile, vault.uploaded_documents, primary),
      purchase_readiness_report: parsed.purchase_readiness_report ?? null,
    };
  } catch {
    const seeded = buildDefaultHousingAffordabilityState(vault);
    writeHousingAffordabilityState(seeded);
    return seeded;
  }
}

export function writeHousingAffordabilityState(state: HousingAffordabilityState): void {
  writeFileSync(filePath(), JSON.stringify(state, null, 2), "utf-8");
}

export async function createHousingScenario(input: HousingScenarioInput, vault: FinancialVaultState = createEmptyFinancialVaultState()): Promise<HousingAffordabilityState> {
  const current = getHousingAffordabilityState(vault);
  const next = await createHousingAffordabilityScenarioState(input, vault, current);

  writeHousingAffordabilityState(next);
  return next;
}

export function generateHousingReportForScenario(scenarioId: string, vault: FinancialVaultState = createEmptyFinancialVaultState()): HousingAffordabilityState {
  const current = getHousingAffordabilityState(vault);
  const next = generateHousingAffordabilityReportState(scenarioId, vault, current);
  writeHousingAffordabilityState(next);
  return next;
}
