import * as fs from "fs";
import * as path from "path";

const AI_DIR = path.join(process.cwd(), ".ai");
const PROMOTION_FILE = path.join(AI_DIR, "releases", "promotion.json");

export type PromotionState = "dev" | "candidate" | "staging" | "production";

export interface RollbackCheckpoint {
  state: PromotionState;
  gitRef: string;
  promotedAt: string;
  promotedBy: string;
  note: string;
}

export interface PromotionRecord {
  releaseId: string;
  currentState: PromotionState;
  approvedForProduction: boolean;
  rollbackCheckpoints: RollbackCheckpoint[];
  history: { from: PromotionState; to: PromotionState; at: string; by: string; note: string }[];
  createdAt: string;
  updatedAt: string;
}

const STATE_ORDER: PromotionState[] = ["dev", "candidate", "staging", "production"];

function ensureReleasesDir(): void {
  const dir = path.dirname(PROMOTION_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readPromotion(): PromotionRecord | null {
  ensureReleasesDir();
  try {
    if (fs.existsSync(PROMOTION_FILE)) {
      return JSON.parse(fs.readFileSync(PROMOTION_FILE, "utf-8")) as PromotionRecord;
    }
  } catch { /* ignore */ }
  return null;
}

function writePromotion(record: PromotionRecord): void {
  ensureReleasesDir();
  record.updatedAt = new Date().toISOString();
  fs.writeFileSync(PROMOTION_FILE, JSON.stringify(record, null, 2), "utf-8");
}

export function initPromotion(gitRef: string): PromotionRecord {
  const existing = readPromotion();
  if (existing) return existing;

  const record: PromotionRecord = {
    releaseId: `rel-${Date.now()}`,
    currentState: "dev",
    approvedForProduction: false,
    rollbackCheckpoints: [
      { state: "dev", gitRef, promotedAt: new Date().toISOString(), promotedBy: "system", note: "Initial dev state" },
    ],
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writePromotion(record);
  return record;
}

export function promoteRelease(
  to: PromotionState,
  by: string,
  gitRef: string,
  note: string
): { ok: boolean; record: PromotionRecord | null; error?: string } {
  const record = readPromotion() ?? initPromotion(gitRef);

  if (to === "production" && !record.approvedForProduction) {
    return { ok: false, record, error: "Production promotion requires explicit approval. Set approvedForProduction=true first." };
  }

  const currentIdx = STATE_ORDER.indexOf(record.currentState);
  const targetIdx = STATE_ORDER.indexOf(to);
  if (targetIdx <= currentIdx) {
    return { ok: false, record, error: `Cannot promote from '${record.currentState}' to '${to}' — must advance forward.` };
  }

  const from = record.currentState;
  record.currentState = to;
  record.rollbackCheckpoints.push({ state: to, gitRef, promotedAt: new Date().toISOString(), promotedBy: by, note });
  record.history.push({ from, to, at: new Date().toISOString(), by, note });
  writePromotion(record);
  return { ok: true, record };
}

export function approveForProduction(by: string): PromotionRecord {
  const record = readPromotion() ?? initPromotion("HEAD");
  record.approvedForProduction = true;
  record.history.push({ from: record.currentState, to: record.currentState, at: new Date().toISOString(), by, note: "Approved for production promotion" });
  writePromotion(record);
  return record;
}

export function rollbackPromotion(by: string, note: string): { ok: boolean; record: PromotionRecord | null; error?: string } {
  const record = readPromotion();
  if (!record) return { ok: false, record: null, error: "No promotion record found" };
  if (record.rollbackCheckpoints.length < 2) {
    return { ok: false, record, error: "No rollback checkpoint available" };
  }
  const prev = record.rollbackCheckpoints[record.rollbackCheckpoints.length - 2];
  const from = record.currentState;
  record.currentState = prev.state;
  record.rollbackCheckpoints.pop();
  record.history.push({ from, to: prev.state, at: new Date().toISOString(), by, note: `Rollback: ${note}` });
  writePromotion(record);
  return { ok: true, record };
}

export function getPromotionRecord(): PromotionRecord | null {
  return readPromotion();
}

export function getPromotionSummary(): { state: PromotionState; readyForProduction: boolean; checkpointCount: number } {
  const record = readPromotion();
  return {
    state: record?.currentState ?? "dev",
    readyForProduction: record?.approvedForProduction ?? false,
    checkpointCount: record?.rollbackCheckpoints.length ?? 0,
  };
}
