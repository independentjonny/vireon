import { supabaseConfigured } from "@/lib/supabase/client";
import { supabaseServerConfigured } from "@/lib/supabase/server";
import { getStorageMode, hasLocalData } from "@/lib/localStore";

type StatusLevel = "green" | "yellow" | "red";
type DataMode = "live-db" | "local-persistent" | "scaffold" | "mock";

type ReadinessCheck = {
  name: string;
  status: StatusLevel;
  message: string;
  requiredEnvVars: string[];
  configured: boolean;
  mode?: DataMode;
};

function checkDatabase(): ReadinessCheck {
  const configured = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);
  const localCounts = hasLocalData();
  const hasLocalPersist = localCounts.transactions > 0 || localCounts.subscriptions > 0;

  if (configured) {
    return {
      name: "Database (Postgres/Prisma)",
      status: "green",
      message: "Database configuration detected — Prisma client ready to connect",
      requiredEnvVars: ["DATABASE_URL"],
      configured,
      mode: "live-db",
    };
  }

  if (hasLocalPersist) {
    return {
      name: "Database (Postgres/Prisma)",
      status: "yellow",
      message: `DATABASE_URL not set — local-persistent mode active (${localCounts.transactions} transactions, ${localCounts.subscriptions} subscriptions in .ai/local-data)`,
      requiredEnvVars: ["DATABASE_URL"],
      configured: false,
      mode: "local-persistent",
    };
  }

  return {
    name: "Database (Postgres/Prisma)",
    status: "yellow",
    message: "DATABASE_URL not set — scaffold mode; use mode=persist on /api/ingest to activate local-persistent storage",
    requiredEnvVars: ["DATABASE_URL"],
    configured: false,
    mode: "scaffold",
  };
}

function checkLocalPersistence(): ReadinessCheck {
  const localCounts = hasLocalData();
  const active = localCounts.transactions > 0 || localCounts.subscriptions > 0 || localCounts.imports > 0;
  return {
    name: "Local Persistent Storage (.ai/local-data)",
    status: active ? "green" : "yellow",
    message: active
      ? `Active — ${localCounts.transactions} transactions, ${localCounts.subscriptions} subscriptions, ${localCounts.imports} import runs`
      : "Empty — POST to /api/ingest with mode=persist to populate",
    requiredEnvVars: [],
    configured: true,
    mode: active ? "local-persistent" : "scaffold",
  };
}

function checkAuth(): ReadinessCheck {
  return {
    name: "Authentication (Supabase)",
    status: supabaseConfigured ? "green" : "yellow",
    message: supabaseConfigured
      ? "Supabase auth credentials present — auth layer ready"
      : "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY not set — auth disabled",
    requiredEnvVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    configured: supabaseConfigured,
    mode: supabaseConfigured ? "live-db" : "scaffold",
  };
}

function checkServerAuth(): ReadinessCheck {
  return {
    name: "Server Auth (Supabase Service Role)",
    status: supabaseServerConfigured ? "green" : "yellow",
    message: supabaseServerConfigured
      ? "Service role key present — server-side auth ready"
      : "SUPABASE_SERVICE_ROLE_KEY not set — server auth disabled",
    requiredEnvVars: ["SUPABASE_SERVICE_ROLE_KEY"],
    configured: supabaseServerConfigured,
    mode: supabaseServerConfigured ? "live-db" : "scaffold",
  };
}

function checkIngestion(): ReadinessCheck {
  const localCounts = hasLocalData();
  const hasImports = localCounts.imports > 0;
  return {
    name: "Transaction Ingestion (CSV Pipeline)",
    status: "green",
    message: hasImports
      ? `CSV ingestion active — ${localCounts.imports} import runs, ${localCounts.transactions} transactions persisted locally`
      : "CSV ingestion pipeline active — merchant canonicalization, dedup, recurring detection, health scoring",
    requiredEnvVars: [],
    configured: true,
    mode: hasImports ? "local-persistent" : "live-db",
  };
}

function checkSubscriptions(): ReadinessCheck {
  const localCounts = hasLocalData();
  const hasLocalSubs = localCounts.subscriptions > 0;
  return {
    name: "Subscription Intelligence",
    status: "green",
    message: hasLocalSubs
      ? `${localCounts.subscriptions} subscriptions in local-persistent storage — cadence, renewal, savings active`
      : "Cadence detection, renewal prediction, anomaly detection, savings recommendations active",
    requiredEnvVars: [],
    configured: true,
    mode: hasLocalSubs ? "local-persistent" : "mock",
  };
}

function checkVector(): ReadinessCheck {
  const configured = Boolean(process.env.OPENAI_API_KEY);
  return {
    name: "Vector Memory (Embeddings)",
    status: configured ? "green" : "yellow",
    message: configured
      ? "OPENAI_API_KEY present — vector search ready"
      : "OPENAI_API_KEY not set — running in stub mode",
    requiredEnvVars: ["OPENAI_API_KEY"],
    configured,
    mode: configured ? "live-db" : "mock",
  };
}

function checkDeployment(): ReadinessCheck {
  const hasDb = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);
  const hasAuth = supabaseConfigured;
  const ready = hasDb && hasAuth;
  return {
    name: "Deployment Readiness",
    status: ready ? "green" : "yellow",
    message: ready
      ? "All critical env vars set — ready for production deployment"
      : "Set DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY to unlock production",
    requiredEnvVars: ["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    configured: ready,
    mode: ready ? "live-db" : "scaffold",
  };
}

function checkSchema(): ReadinessCheck {
  return {
    name: "Prisma Schema (Database Models)",
    status: "green",
    message: "Schema v2: Org, User, Workspace, Transaction, Subscription, Insight, Embedding, MemoryNode, RoadmapTask, Telemetry",
    requiredEnvVars: [],
    configured: true,
    mode: "scaffold",
  };
}

function checkRepositories(): ReadinessCheck {
  const storageMode = getStorageMode();
  return {
    name: "Repository Layer",
    status: "green",
    message: storageMode === "live-db"
      ? "Live DB repositories active — Prisma client connected"
      : `Typed CRUD repositories with local-persistent fallback — ${storageMode} mode`,
    requiredEnvVars: [],
    configured: true,
    mode: storageMode,
  };
}

const CRITICAL_CHECKS = ["Database (Postgres/Prisma)", "Authentication (Supabase)"];

export async function GET() {
  const checks: ReadinessCheck[] = [
    checkDatabase(),
    checkLocalPersistence(),
    checkAuth(),
    checkServerAuth(),
    checkIngestion(),
    checkSubscriptions(),
    checkVector(),
    checkDeployment(),
    checkSchema(),
    checkRepositories(),
  ];

  const greenCount = checks.filter((c) => c.status === "green").length;
  const yellowCount = checks.filter((c) => c.status === "yellow").length;
  const redCount = checks.filter((c) => c.status === "red").length;

  const overallStatus: StatusLevel =
    redCount > 0 ? "red" : yellowCount > 0 ? "yellow" : "green";

  const missingEnvVars = checks
    .filter((c) => !c.configured)
    .flatMap((c) => c.requiredEnvVars)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const criticalFailures = checks
    .filter((c) => CRITICAL_CHECKS.includes(c.name) && !c.configured)
    .map((c) => c.name);

  const productionBlocked = criticalFailures.length > 0;

  const storageMode = getStorageMode();
  const localCounts = hasLocalData();

  const modeBreakdown: Record<string, number> = {};
  for (const check of checks) {
    if (check.mode) {
      modeBreakdown[check.mode] = (modeBreakdown[check.mode] ?? 0) + 1;
    }
  }

  return Response.json({
    ok: true,
    overallStatus,
    storageMode,
    productionBlocked,
    criticalFailures,
    summary: {
      green: greenCount,
      yellow: yellowCount,
      red: redCount,
      total: checks.length,
      readinessScore: Math.round((greenCount / checks.length) * 100),
    },
    modeBreakdown,
    localData: localCounts,
    checks,
    missingEnvVars,
    nextStep:
      productionBlocked
        ? `Production blocked — set ${criticalFailures.join(", ")} credentials first`
        : missingEnvVars.length > 0
        ? `Set ${missingEnvVars.join(", ")} in your deployment environment`
        : "All systems ready for production deployment",
    generatedAt: new Date().toISOString(),
  });
}
