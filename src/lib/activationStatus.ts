export type LayerId = "database" | "auth" | "vector" | "ingestion" | "subscriptions" | "telemetry";

export interface ActivationLayer {
  id: LayerId;
  mode: "live" | "scaffold";
  activatedAt: string | null;
  activatedByRunId: string | null;
}

const _state: Record<LayerId, ActivationLayer> = {
  database: { id: "database", mode: "scaffold", activatedAt: null, activatedByRunId: null },
  auth: { id: "auth", mode: "scaffold", activatedAt: null, activatedByRunId: null },
  vector: { id: "vector", mode: "scaffold", activatedAt: null, activatedByRunId: null },
  ingestion: { id: "ingestion", mode: "live", activatedAt: new Date().toISOString(), activatedByRunId: null },
  subscriptions: { id: "subscriptions", mode: "live", activatedAt: new Date().toISOString(), activatedByRunId: null },
  telemetry: { id: "telemetry", mode: "live", activatedAt: new Date().toISOString(), activatedByRunId: null },
};

export function computeActivationStatus(runId?: string): ActivationLayer[] {
  const dbReady = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);
  const authReady =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const vectorReady = Boolean(process.env.OPENAI_API_KEY);

  const now = new Date().toISOString();
  const rId = runId ?? null;

  if (dbReady && _state.database.mode !== "live") {
    _state.database = { id: "database", mode: "live", activatedAt: now, activatedByRunId: rId };
  }
  if (authReady && _state.auth.mode !== "live") {
    _state.auth = { id: "auth", mode: "live", activatedAt: now, activatedByRunId: rId };
  }
  if (vectorReady && _state.vector.mode !== "live") {
    _state.vector = { id: "vector", mode: "live", activatedAt: now, activatedByRunId: rId };
  }

  return Object.values(_state);
}

export function getActivationStatus(): ActivationLayer[] {
  return Object.values(_state);
}
