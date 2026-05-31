import { uiAgent } from "./uiAgent";
import { backendAgent } from "./backendAgent";
import { financeAgent } from "./financeAgent";
import { databaseAgent } from "./databaseAgent";
import { repairAgent } from "./repairAgent";
import { plannerAgent } from "./plannerAgent";
import { qaAgent } from "./qaAgent";
import { deploymentAgent } from "./deploymentAgent";

export async function runAgents(goal: string) {
  const plan = await plannerAgent(goal);

  const [ui, backend, finance, database, repair, qa, deployment] = await Promise.all([
    uiAgent(goal),
    backendAgent(goal),
    financeAgent(goal),
    databaseAgent(goal),
    repairAgent(goal),
    qaAgent(goal),
    deploymentAgent("cloudflare"),
  ]);

  return {
    ok: true,
    goal,
    runtime: "specialist-agent-layer-v2",
    plan,
    agents: [ui, backend, finance, database, repair, qa, deployment],
    completedAt: new Date().toISOString(),
  };
}
