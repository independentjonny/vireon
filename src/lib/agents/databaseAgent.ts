import { TABLE_NAMES, SCHEMA_VERSION } from "@/lib/persistence/schema";
import {
  getLocalTransactions,
  getLocalSubscriptions,
  getLocalTelemetry,
  getLocalMemory,
  getStorageMode,
} from "@/lib/localStore";
import { supabaseConfigured, getSupabaseClientConfig } from "@/lib/supabase/client";

export type DatabaseCheckResult = {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export type DatabaseAgentReport = {
  agent: "database-agent";
  status: "complete" | "degraded";
  task: string;
  storageMode: string;
  schemaVersion: string;
  tables: string[];
  checks: DatabaseCheckResult[];
  recordCounts: Record<string, number>;
  supabaseProbe: SupabaseProbeResult;
  generatedAt: string;
};

export type SupabaseProbeResult = {
  configured: boolean;
  reachable: boolean | null;
  latencyMs: number | null;
  error: string | null;
};

const PROBE_RETRY_DELAYS_MS = [1000, 3000, 5000];

async function fetchWithRetry(
  url: string,
  options: RequestInit,
): Promise<{ response: Response | null; error: string | null; attempts: number }> {
  let lastError: string | null = null;
  for (let i = 0; i <= PROBE_RETRY_DELAYS_MS.length; i++) {
    try {
      const response = await fetch(url, options);
      return { response, error: null, attempts: i + 1 };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (i < PROBE_RETRY_DELAYS_MS.length) {
        await new Promise((resolve) => setTimeout(resolve, PROBE_RETRY_DELAYS_MS[i]));
      }
    }
  }
  return {
    response: null,
    error: `Failed after ${PROBE_RETRY_DELAYS_MS.length + 1} attempts: ${lastError}`,
    attempts: PROBE_RETRY_DELAYS_MS.length + 1,
  };
}

export async function probeSupabaseConnection(): Promise<SupabaseProbeResult> {
  if (!supabaseConfigured) {
    return { configured: false, reachable: null, latencyMs: null, error: null };
  }

  const { url, anonKey } = getSupabaseClientConfig();
  const probeUrl = `${url}/rest/v1/`;
  const start = Date.now();

  const { response, error } = await fetchWithRetry(probeUrl, {
    method: "HEAD",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    signal: AbortSignal.timeout(5000),
  });

  const latencyMs = Date.now() - start;

  if (response) {
    return { configured: true, reachable: response.status < 500, latencyMs, error: null };
  }
  return { configured: true, reachable: false, latencyMs, error };
}

export async function databaseAgent(task: string): Promise<DatabaseAgentReport> {
  const mode = getStorageMode();
  const checks: DatabaseCheckResult[] = [];
  const recordCounts: Record<string, number> = {};
  const supabaseProbe = await probeSupabaseConnection();

  // Schema table enumeration
  const tables = Object.values(TABLE_NAMES);
  checks.push({
    name: "Schema tables enumerated",
    status: "pass",
    detail: `${tables.length} tables defined in schema v${SCHEMA_VERSION}`,
  });

  // Local data layer connectivity
  try {
    const txs = getLocalTransactions();
    recordCounts.transactions = txs.length;
    checks.push({
      name: "Transaction store accessible",
      status: "pass",
      detail: `${txs.length} transaction(s) in local store`,
    });

    const duplicateIds = txs.filter((t, i) => txs.findIndex((x) => x.id === t.id) !== i);
    checks.push({
      name: "Transaction ID uniqueness",
      status: duplicateIds.length === 0 ? "pass" : "warn",
      detail: duplicateIds.length === 0 ? "All IDs unique" : `${duplicateIds.length} duplicate ID(s) detected`,
    });
  } catch (err) {
    checks.push({ name: "Transaction store accessible", status: "fail", detail: String(err) });
  }

  try {
    const subs = getLocalSubscriptions();
    recordCounts.subscriptions = subs.length;

    const invalidSubs = subs.filter((s) => !s.merchant || s.amount === undefined || s.amount === null);
    checks.push({
      name: "Subscription store accessible",
      status: "pass",
      detail: `${subs.length} subscription(s) in local store`,
    });
    checks.push({
      name: "Subscription data integrity",
      status: invalidSubs.length === 0 ? "pass" : "warn",
      detail: invalidSubs.length === 0 ? "All subscriptions have required fields" : `${invalidSubs.length} subscription(s) missing required fields`,
    });
  } catch (err) {
    checks.push({ name: "Subscription store accessible", status: "fail", detail: String(err) });
  }

  try {
    const telemetry = getLocalTelemetry();
    recordCounts.telemetry = telemetry.length;
    checks.push({
      name: "Telemetry store accessible",
      status: "pass",
      detail: `${telemetry.length} telemetry record(s) in local store`,
    });
  } catch (err) {
    checks.push({ name: "Telemetry store accessible", status: "fail", detail: String(err) });
  }

  try {
    const memory = getLocalMemory();
    recordCounts.memory_nodes = memory.length;
    checks.push({
      name: "Memory node store accessible",
      status: "pass",
      detail: `${memory.length} memory node(s) in local store`,
    });
  } catch (err) {
    checks.push({ name: "Memory node store accessible", status: "fail", detail: String(err) });
  }

  // Live DB readiness
  checks.push({
    name: "Live database connectivity",
    status: mode === "live-db" ? "pass" : "warn",
    detail:
      mode === "live-db"
        ? "DATABASE_URL is set — live-db mode active"
        : "DATABASE_URL not set — running in local-persistent mode. Set DATABASE_URL to activate live database.",
  });

  // Supabase real connection probe
  if (!supabaseProbe.configured) {
    checks.push({
      name: "Supabase connection probe",
      status: "warn",
      detail: "Supabase not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable real-database connectivity",
    });
  } else if (supabaseProbe.reachable) {
    checks.push({
      name: "Supabase connection probe",
      status: "pass",
      detail: `Supabase REST API reachable (${supabaseProbe.latencyMs}ms latency)`,
    });
  } else {
    checks.push({
      name: "Supabase connection probe",
      status: "fail",
      detail: `Supabase unreachable — ${supabaseProbe.error ?? "connection failed"}`,
    });
  }

  const hasFailures = checks.some((c) => c.status === "fail");
  return {
    agent: "database-agent",
    status: hasFailures ? "degraded" : "complete",
    task,
    storageMode: mode,
    schemaVersion: SCHEMA_VERSION,
    tables,
    checks,
    recordCounts,
    supabaseProbe,
    generatedAt: new Date().toISOString(),
  };
}
