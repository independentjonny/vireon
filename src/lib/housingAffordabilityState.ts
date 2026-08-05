import {
  buildPurchaseReadinessReport,
  calculateHouseReadiness,
  detectHousingObstacles,
  generateComparisonScenarios,
  generateHousingActionPlan,
  generateHousingCoachAnalysis,
} from "@/lib/housingAffordabilityEngine";
import { createEmptyFinancialVaultState } from "@/lib/financialVaultEmptyState";
import type {
  HousingAffordabilityState,
  HousingScenario,
  HousingScenarioInput,
} from "@/lib/housingAffordabilityTypes";
import type { FinancialVaultState } from "@/lib/financialVaultTypes";

export function buildDefaultHousingAffordabilityState(vault: FinancialVaultState = createEmptyFinancialVaultState()): HousingAffordabilityState {
  const input: HousingScenarioInput = {
    propertyPrice: 1300000,
    deposit: 250000,
    purchaseState: "NSW",
    estimatedInterestRate: 6.24,
    loanTermYears: 30,
  };
  const scenarios = generateComparisonScenarios(input, vault.financial_profile);
  const primary = scenarios[0];
  const obstacles = scenarios.flatMap((scenario) => detectHousingObstacles(scenario, vault.financial_profile));
  const actions = generateHousingActionPlan(primary, obstacles.filter((item) => item.scenarioId === primary.id));
  const readiness = calculateHouseReadiness(vault.financial_profile, vault.uploaded_documents, primary);
  const report = buildPurchaseReadinessReport({
    scenario: primary,
    comparison: scenarios,
    obstacles: obstacles.filter((item) => item.scenarioId === primary.id),
    actions,
    readiness,
    documents: vault.uploaded_documents,
  });

  return {
    housing_scenarios: scenarios,
    housing_obstacles: obstacles,
    housing_action_plans: actions,
    housing_ai_analysis: [],
    house_readiness_score: readiness,
    purchase_readiness_report: report,
  };
}

export function refreshHousingAffordabilityState(
  state: HousingAffordabilityState,
  vault: FinancialVaultState = createEmptyFinancialVaultState(),
): HousingAffordabilityState {
  const primary = state.housing_scenarios[0];
  return {
    housing_scenarios: state.housing_scenarios ?? [],
    housing_obstacles: state.housing_obstacles ?? [],
    housing_action_plans: state.housing_action_plans ?? [],
    housing_ai_analysis: state.housing_ai_analysis ?? [],
    house_readiness_score: calculateHouseReadiness(vault.financial_profile, vault.uploaded_documents, primary),
    purchase_readiness_report: state.purchase_readiness_report ?? null,
  };
}

export async function createHousingAffordabilityScenarioState(
  input: HousingScenarioInput,
  vault: FinancialVaultState = createEmptyFinancialVaultState(),
  current: HousingAffordabilityState = buildDefaultHousingAffordabilityState(vault),
): Promise<HousingAffordabilityState> {
  const comparison = generateComparisonScenarios(input, vault.financial_profile);
  const primary = comparison[0];
  const otherScenarios = current.housing_scenarios.filter((scenario) => !scenario.id.startsWith("scenario-"));
  const scenarios: HousingScenario[] = [...comparison, ...otherScenarios].slice(0, 12);
  const obstacles = comparison.flatMap((scenario) => detectHousingObstacles(scenario, vault.financial_profile));
  const primaryObstacles = obstacles.filter((item) => item.scenarioId === primary.id);
  const actions = generateHousingActionPlan(primary, primaryObstacles);
  const readiness = calculateHouseReadiness(vault.financial_profile, vault.uploaded_documents, primary);
  const ai = await generateHousingCoachAnalysis(primary, primaryObstacles, actions);
  const report = buildPurchaseReadinessReport({
    scenario: primary,
    comparison,
    obstacles: primaryObstacles,
    actions,
    readiness,
    documents: vault.uploaded_documents,
  });

  return {
    housing_scenarios: scenarios,
    housing_obstacles: obstacles,
    housing_action_plans: actions,
    housing_ai_analysis: [ai, ...current.housing_ai_analysis.filter((item) => item.scenarioId !== primary.id)].slice(0, 20),
    house_readiness_score: readiness,
    purchase_readiness_report: report,
  };
}

export function generateHousingAffordabilityReportState(
  scenarioId: string,
  vault: FinancialVaultState = createEmptyFinancialVaultState(),
  current: HousingAffordabilityState = buildDefaultHousingAffordabilityState(vault),
): HousingAffordabilityState {
  const scenario = current.housing_scenarios.find((item) => item.id === scenarioId) ?? current.housing_scenarios[0];
  if (!scenario) return current;
  const obstacles = current.housing_obstacles.filter((item) => item.scenarioId === scenario.id);
  const actions = current.housing_action_plans.filter((item) => item.scenarioId === scenario.id);
  const readiness = calculateHouseReadiness(vault.financial_profile, vault.uploaded_documents, scenario);
  const report = buildPurchaseReadinessReport({
    scenario,
    comparison: current.housing_scenarios,
    obstacles,
    actions,
    readiness,
    documents: vault.uploaded_documents,
  });
  return { ...current, house_readiness_score: readiness, purchase_readiness_report: report };
}
