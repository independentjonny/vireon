export type TelemetryLevel = "info" | "warn" | "error" | "critical";

export type TelemetryEvent = {
  id: string;
  event: string;
  level: TelemetryLevel;
  agent: string;
  payload: Record<string, unknown>;
  errorClass: string | null;
  resolved: boolean;
  createdAt: string;
};

const dbConfigured = Boolean(
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL
);

const TELEMETRY_BUFFER: TelemetryEvent[] = [
  {
    id: "tel-001",
    event: "build.success",
    level: "info",
    agent: "qa-orchestrator",
    payload: { duration: 28000, routes: 21 },
    errorClass: null,
    resolved: true,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "tel-002",
    event: "agent.run",
    level: "info",
    agent: "financial-intelligence",
    payload: { goal: "analyse subscriptions", duration: 142 },
    errorClass: null,
    resolved: true,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  ...(!dbConfigured
    ? [
        {
          id: "tel-003",
          event: "env.missing",
          level: "warn" as TelemetryLevel,
          agent: "deployment-governor",
          payload: { missingVars: ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"] },
          errorClass: "EnvironmentError",
          resolved: false,
          createdAt: new Date(Date.now() - 600000).toISOString(),
        },
      ]
    : []),
];

export function ingestTelemetry(
  event: string,
  level: TelemetryLevel,
  agent: string,
  payload: Record<string, unknown> = {},
  errorClass: string | null = null
): TelemetryEvent {
  const record: TelemetryEvent = {
    id: `tel-${Date.now()}`,
    event,
    level,
    agent,
    payload,
    errorClass,
    resolved: false,
    createdAt: new Date().toISOString(),
  };
  TELEMETRY_BUFFER.push(record);
  return record;
}

export function getTelemetryBuffer(): TelemetryEvent[] {
  return [...TELEMETRY_BUFFER].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getTelemetrySummary() {
  const buffer = getTelemetryBuffer();
  return {
    total: buffer.length,
    byLevel: {
      info: buffer.filter((e) => e.level === "info").length,
      warn: buffer.filter((e) => e.level === "warn").length,
      error: buffer.filter((e) => e.level === "error").length,
      critical: buffer.filter((e) => e.level === "critical").length,
    },
    unresolved: buffer.filter((e) => !e.resolved).length,
    lastEventAt: buffer[0]?.createdAt ?? null,
  };
}
