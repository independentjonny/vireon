import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type {
  TransactionRecord,
  SubscriptionRecord,
  TelemetryRecord,
  MemoryNodeRecord,
} from "./persistence/schema";

const DATA_DIR = join(process.cwd(), ".ai", "local-data");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readData<T>(filename: string, defaultValue: T): T {
  ensureDataDir();
  const filePath = join(DATA_DIR, filename);
  if (!existsSync(filePath)) return defaultValue;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return defaultValue;
  }
}

function writeData<T>(filename: string, data: T): void {
  ensureDataDir();
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(data, null, 2), "utf-8");
}

export type LocalImportRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  rowCount: number;
  mode: string;
  healthScore: number;
  importedAt: string;
  transactionIds: string[];
};

// ── Transactions ────────────────────────────────────────────────────────────

export function getLocalTransactions(): TransactionRecord[] {
  return readData<TransactionRecord[]>("transactions.json", []);
}

export function saveLocalTransactions(transactions: TransactionRecord[]): void {
  writeData("transactions.json", transactions);
}

export function appendLocalTransactions(transactions: TransactionRecord[]): number {
  const existing = getLocalTransactions();
  const existingIds = new Set(existing.map((t) => t.id));
  const newOnes = transactions.filter((t) => !existingIds.has(t.id));
  saveLocalTransactions([...existing, ...newOnes]);
  return newOnes.length;
}

// ── Subscriptions ───────────────────────────────────────────────────────────

export function getLocalSubscriptions(): SubscriptionRecord[] {
  return readData<SubscriptionRecord[]>("subscriptions.json", []);
}

export function saveLocalSubscriptions(subscriptions: SubscriptionRecord[]): void {
  writeData("subscriptions.json", subscriptions);
}

export function upsertLocalSubscription(sub: SubscriptionRecord): SubscriptionRecord {
  const existing = getLocalSubscriptions();
  const idx = existing.findIndex(
    (s) => s.merchantCanonical === sub.merchantCanonical && s.workspaceId === sub.workspaceId
  );
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...sub, updatedAt: new Date().toISOString() };
    saveLocalSubscriptions(existing);
    return existing[idx];
  }
  existing.push(sub);
  saveLocalSubscriptions(existing);
  return sub;
}

// Backfill subscriptions from existing recurring transactions (idempotent).
export function backfillSubscriptionsFromTransactions(): number {
  const existingSubs = getLocalSubscriptions();
  const existingKeys = new Set(
    existingSubs.map((s) => `${s.merchantCanonical}::${s.workspaceId}`)
  );
  const txs = getLocalTransactions();
  const seen = new Map<string, TransactionRecord>();
  for (const t of txs.filter((t) => t.recurring)) {
    const key = `${t.merchantCanonical}::${t.workspaceId}`;
    if (!seen.has(key)) seen.set(key, t);
  }
  let created = 0;
  for (const [key, t] of seen.entries()) {
    if (existingKeys.has(key)) continue;
    const cadence: SubscriptionRecord["cadence"] =
      t.recurringCadence === "quarterly"
        ? "quarterly"
        : t.recurringCadence === "annual"
        ? "annual"
        : "monthly";
    const cadenceDays = cadence === "monthly" ? 30 : cadence === "quarterly" ? 91 : 365;
    const nextRenewal = new Date(
      new Date(t.date).getTime() + cadenceDays * 24 * 60 * 60 * 1000
    );
    const amount = Math.abs(t.amount);
    const savingsOpportunity = Math.round(amount * 12 * 0.15 * 100) / 100;
    const sub: SubscriptionRecord = {
      id: `sub-${t.merchantCanonical}-${t.workspaceId}`,
      workspaceId: t.workspaceId,
      transactionId: t.id,
      merchant: t.merchantCanonical,
      merchantCanonical: t.merchantCanonical,
      amount,
      cadence,
      nextRenewalDate: nextRenewal.toISOString(),
      cancellationScore: 0,
      pricingAnomalyScore: 0,
      savingsOpportunity,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsertLocalSubscription(sub);
    created++;
  }
  return created;
}

// ── Telemetry ───────────────────────────────────────────────────────────────

export function getLocalTelemetry(): TelemetryRecord[] {
  return readData<TelemetryRecord[]>("telemetry.json", []);
}

export function appendLocalTelemetry(event: TelemetryRecord): void {
  const existing = getLocalTelemetry();
  const trimmed = existing.length >= 1000 ? existing.slice(-999) : existing;
  writeData("telemetry.json", [...trimmed, event]);
}

// ── Memory ──────────────────────────────────────────────────────────────────

export function getLocalMemory(): MemoryNodeRecord[] {
  return readData<MemoryNodeRecord[]>("memory.json", []);
}

export function appendLocalMemory(node: MemoryNodeRecord): void {
  const existing = getLocalMemory();
  writeData("memory.json", [...existing, node]);
}

// ── Imports ─────────────────────────────────────────────────────────────────

export function getLocalImports(): LocalImportRecord[] {
  return readData<LocalImportRecord[]>("imports.json", []);
}

export function appendLocalImport(record: LocalImportRecord): void {
  const existing = getLocalImports();
  writeData("imports.json", [...existing, record]);
}

// ── Copilot History ─────────────────────────────────────────────────────────

export type CopilotHistoryEntry = {
  id: string;
  question: string;
  answer: string;
  askedAt: string;
  context: { transactions: number; subscriptions: number };
};

export function getCopilotHistory(): CopilotHistoryEntry[] {
  return readData<CopilotHistoryEntry[]>("copilot-history.json", []);
}

export function appendCopilotHistory(entry: CopilotHistoryEntry): void {
  const existing = getCopilotHistory();
  const trimmed = existing.length >= 200 ? existing.slice(-199) : existing;
  writeData("copilot-history.json", [...trimmed, entry]);
}

// ── Insight Resolution State ──────────────────────────────────────────────────

export type InsightResolutionEntry = {
  insightId: string;
  resolved: boolean;
  resolvedAt: string | null;
  dismissedAt: string | null;
};

export function getInsightResolutions(): InsightResolutionEntry[] {
  return readData<InsightResolutionEntry[]>("insight-resolutions.json", []);
}

export function resolveInsight(insightId: string): void {
  const existing = getInsightResolutions();
  const idx = existing.findIndex((e) => e.insightId === insightId);
  const entry: InsightResolutionEntry = {
    insightId,
    resolved: true,
    resolvedAt: new Date().toISOString(),
    dismissedAt: null,
  };
  if (idx >= 0) existing[idx] = entry;
  else existing.push(entry);
  writeData("insight-resolutions.json", existing);
}

// ── Subscription Board Actions ────────────────────────────────────────────────

export type SubscriptionAction = {
  id: string;
  subscriptionId: string;
  merchant: string;
  action: "keep" | "cancel" | "review" | "ignore";
  takenAt: string;
};

export function getSubscriptionActions(): SubscriptionAction[] {
  return readData<SubscriptionAction[]>("subscription-actions.json", []);
}

export function appendSubscriptionAction(action: SubscriptionAction): void {
  const existing = getSubscriptionActions();
  const trimmed = existing.length >= 500 ? existing.slice(-499) : existing;
  writeData("subscription-actions.json", [...trimmed, action]);
}

// ── Workflow Runs ─────────────────────────────────────────────────────────────

export type WorkflowRun = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  stages: { name: string; status: "pass" | "fail" | "skip"; detail: string; ts: string }[];
  totalTransactions: number;
  totalSubscriptions: number;
  insightsGenerated: number;
};

export function getWorkflowRuns(): WorkflowRun[] {
  return readData<WorkflowRun[]>("workflow-runs.json", []);
}

export function appendWorkflowRun(run: WorkflowRun): void {
  const existing = getWorkflowRuns();
  const trimmed = existing.length >= 50 ? existing.slice(-49) : existing;
  writeData("workflow-runs.json", [...trimmed, run]);
}

// ── Merchant Cleanup Mappings ─────────────────────────────────────────────────

export type MerchantCleanupMapping = {
  original: string;
  canonical: string;
  confirmedAt: string;
  confirmedBy: string;
};

export function getMerchantCleanupMappings(): MerchantCleanupMapping[] {
  return readData<MerchantCleanupMapping[]>("merchant-cleanup.json", []);
}

export function upsertMerchantCleanupMapping(mapping: MerchantCleanupMapping): void {
  const existing = getMerchantCleanupMappings();
  const idx = existing.findIndex((m) => m.original === mapping.original);
  if (idx >= 0) existing[idx] = mapping;
  else existing.push(mapping);
  writeData("merchant-cleanup.json", existing);
}

// ── Mode helpers ─────────────────────────────────────────────────────────────

export type StorageMode = "live-db" | "local-persistent" | "scaffold" | "mock";

export function getStorageMode(): StorageMode {
  if (process.env.DATABASE_URL) return "live-db";
  return "local-persistent";
}

export function hasLocalData(): { transactions: number; subscriptions: number; imports: number } {
  return {
    transactions: getLocalTransactions().length,
    subscriptions: getLocalSubscriptions().length,
    imports: getLocalImports().length,
  };
}
