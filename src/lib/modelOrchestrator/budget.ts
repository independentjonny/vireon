import { readModelOrchestratorConfig } from "./registry.ts";
import type { ModelRecord, ModelTaskRequest } from "./types.ts";

export type BudgetLedger = {
  dailySpend: number;
  monthlySpend: number;
  userSpend: Record<string, number>;
  workerSpend: Record<string, number>;
};

export const defaultBudgetLedger: BudgetLedger = {
  dailySpend: 0,
  monthlySpend: 0,
  userSpend: {},
  workerSpend: {},
};

export function estimateModelCost(model: ModelRecord, request: ModelTaskRequest) {
  if (model.relativeCostClass === "free") return 0;
  const base = model.relativeCostClass === "low" ? 0.02 : model.relativeCostClass === "medium" ? 0.2 : 1.5;
  const schemaMultiplier = request.outputSchema ? 1.15 : 1;
  const reasoningMultiplier = request.requiredCapabilities.includes("reasoning") ? 1.25 : 1;
  return Number((base * schemaMultiplier * reasoningMultiplier).toFixed(4));
}

export function enforceBudget(request: ModelTaskRequest, model: ModelRecord, ledger: BudgetLedger = defaultBudgetLedger, env: NodeJS.ProcessEnv = process.env) {
  const config = readModelOrchestratorConfig(env);
  const estimatedCost = estimateModelCost(model, request);
  const userSpend = ledger.userSpend[request.userId] ?? 0;
  if (estimatedCost > request.maximumCost) return { ok: false, estimatedCost, reason: "task maximum cost exceeded" };
  if (estimatedCost > config.maxTaskCost) return { ok: false, estimatedCost, reason: "global max task cost exceeded" };
  if (ledger.dailySpend + estimatedCost > config.dailyBudget) return { ok: false, estimatedCost, reason: "daily model budget exceeded" };
  if (ledger.monthlySpend + estimatedCost > config.monthlyBudget) return { ok: false, estimatedCost, reason: "monthly model budget exceeded" };
  if (userSpend + estimatedCost > config.monthlyBudget) return { ok: false, estimatedCost, reason: "user model budget exceeded" };
  return { ok: true, estimatedCost, reason: "budget available" };
}
