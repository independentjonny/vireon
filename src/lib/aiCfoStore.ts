import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { AICfoAdviserBrief, AICfoAnswer, AICfoGeneratedDecision, AICfoRequest, AICfoTimelineEvent } from "@/lib/aiCfo";

export type AICfoHistoryEntry = {
  request: AICfoRequest;
  answer: AICfoAnswer;
};

export type AICfoPersistedState = {
  history: AICfoHistoryEntry[];
  decisions: AICfoGeneratedDecision[];
  timelineEvents: AICfoTimelineEvent[];
  adviserBriefs: AICfoAdviserBrief[];
};

const DATA_DIR = join(process.cwd(), ".ai", "local-data");
const AI_CFO_FILE = "ai-cfo.json";

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(): string {
  if (process.env.VIREON_AI_CFO_STORE_FILE) return process.env.VIREON_AI_CFO_STORE_FILE;
  ensureDataDir();
  return join(DATA_DIR, AI_CFO_FILE);
}

function emptyState(): AICfoPersistedState {
  return { history: [], decisions: [], timelineEvents: [], adviserBriefs: [] };
}

function decisionKey(decision: AICfoGeneratedDecision): string {
  return `${decision.sourceQuestionId}:${decision.calculationSnapshotId}:${decision.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function getAICfoState(): AICfoPersistedState {
  const path = filePath();
  if (!existsSync(path)) {
    const state = emptyState();
    writeAICfoState(state);
    return state;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as Partial<AICfoPersistedState>;
    return {
      history: parsed.history ?? [],
      decisions: parsed.decisions ?? [],
      timelineEvents: parsed.timelineEvents ?? [],
      adviserBriefs: parsed.adviserBriefs ?? [],
    };
  } catch {
    const state = emptyState();
    writeAICfoState(state);
    return state;
  }
}

export function writeAICfoState(state: AICfoPersistedState): void {
  writeFileSync(filePath(), JSON.stringify(state, null, 2), "utf-8");
}

export function persistAICfoRun(input: {
  request: AICfoRequest;
  answer: AICfoAnswer;
  decision: AICfoGeneratedDecision;
  timelineEvent: AICfoTimelineEvent;
  adviserBrief: AICfoAdviserBrief;
}): AICfoPersistedState {
  const current = getAICfoState();
  const existingDecisionKeys = new Set(current.decisions.map(decisionKey));
  const nextDecision = existingDecisionKeys.has(decisionKey(input.decision)) ? [] : [input.decision];
  const next: AICfoPersistedState = {
    history: [{ request: input.request, answer: input.answer }, ...current.history].slice(0, 100),
    decisions: [...nextDecision, ...current.decisions].slice(0, 100),
    timelineEvents: [input.timelineEvent, ...current.timelineEvents.filter((event) => event.id !== input.timelineEvent.id)].slice(0, 150),
    adviserBriefs: [input.adviserBrief, ...current.adviserBriefs.filter((brief) => brief.id !== input.adviserBrief.id)].slice(0, 50),
  };
  writeAICfoState(next);
  return next;
}
