import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createEmptyFinancialVaultState } from "@/lib/financialVaultEmptyState";
import { createTwinPersistedState } from "@/lib/financialDigitalTwin";
import type { FinancialVaultState } from "@/lib/financialVaultTypes";
import type { TwinPersistedState, TwinScenario, TwinSimulationOutput, TwinTimelineEvent } from "@/lib/financialDigitalTwin";

const DATA_DIR = join(process.cwd(), ".ai", "local-data");
const TWIN_FILE = "financial-digital-twin.json";

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(): string {
  if (process.env.VIREON_TWIN_STORE_FILE) return process.env.VIREON_TWIN_STORE_FILE;
  ensureDataDir();
  return join(DATA_DIR, TWIN_FILE);
}

export function getFinancialDigitalTwinState(vault: FinancialVaultState = createEmptyFinancialVaultState()): TwinPersistedState {
  const path = filePath();
  if (!existsSync(path)) {
    const seeded = createTwinPersistedState(vault);
    writeFinancialDigitalTwinState(seeded);
    return seeded;
  }

  try {
    return JSON.parse(readFileSync(path, "utf-8")) as TwinPersistedState;
  } catch {
    const seeded = createTwinPersistedState(vault);
    writeFinancialDigitalTwinState(seeded);
    return seeded;
  }
}

export function writeFinancialDigitalTwinState(state: TwinPersistedState): void {
  writeFileSync(filePath(), JSON.stringify(state, null, 2), "utf-8");
}

export function saveTwinScenario(scenario: TwinScenario): TwinPersistedState {
  const current = getFinancialDigitalTwinState();
  const scenarios = [scenario, ...current.scenarios.filter((item) => item.id !== scenario.id)];
  const next = { ...current, scenarios };
  writeFinancialDigitalTwinState(next);
  return next;
}

export function appendTwinSimulation(output: TwinSimulationOutput): TwinPersistedState {
  const current = getFinancialDigitalTwinState();
  const next = {
    ...current,
    simulationHistory: [output, ...current.simulationHistory].slice(0, 50),
    decisionHistory: [...output.decisions, ...current.decisionHistory].slice(0, 100),
    timelineEvents: mergeTimelineEvents([...current.timelineEvents, ...output.futureTimelineEvents]),
    calculationSnapshots: [output.yearly, ...current.calculationSnapshots].slice(0, 20),
  };
  writeFinancialDigitalTwinState(next);
  return next;
}

function mergeTimelineEvents(events: TwinTimelineEvent[]): TwinTimelineEvent[] {
  return events
    .filter((event, index, all) => all.findIndex((item) => item.id === event.id) === index)
    .sort((a, b) => a.year - b.year);
}
