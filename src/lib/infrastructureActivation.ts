export type ActivationLayer = {
  id: string;
  name: string;
  mode: "live" | "scaffold";
  envVarsRequired: string[];
  envVarsPresent: string[];
  activationPath: string;
  description: string;
};

export type ActivationManifest = {
  activationScore: number;
  liveLayers: number;
  totalLayers: number;
  layers: ActivationLayer[];
  generatedAt: string;
};

const ACTIVATION_LAYERS: Omit<ActivationLayer, "mode" | "envVarsPresent">[] = [
  {
    id: "database",
    name: "Database",
    envVarsRequired: ["DATABASE_URL"],
    activationPath: "/api/env-check",
    description: "PostgreSQL via Prisma — persistent transactions, subscriptions, memory",
  },
  {
    id: "auth",
    name: "Authentication",
    envVarsRequired: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    activationPath: "/api/auth/session",
    description: "Supabase Auth — multi-user sessions, RBAC, workspace isolation",
  },
  {
    id: "vector",
    name: "Vector Memory",
    envVarsRequired: ["OPENAI_API_KEY"],
    activationPath: "/api/memory",
    description: "OpenAI embeddings — semantic recall, copilot context assembly",
  },
  {
    id: "ingestion",
    name: "CSV Ingestion",
    envVarsRequired: [],
    activationPath: "/api/ingest",
    description: "Transaction ingestion pipeline — CSV parse, categorise, dedup, score",
  },
  {
    id: "subscriptions",
    name: "Subscriptions",
    envVarsRequired: [],
    activationPath: "/api/subscriptions",
    description: "Cadence detection, renewal prediction, savings recommendations",
  },
  {
    id: "telemetry",
    name: "Telemetry",
    envVarsRequired: [],
    activationPath: "/api/telemetry",
    description: "Runtime event ledger — error classification, health monitoring",
  },
];

export function getActivationManifest(): ActivationManifest {
  const layers: ActivationLayer[] = ACTIVATION_LAYERS.map((layer) => {
    const present = layer.envVarsRequired.filter((k) => Boolean(process.env[k]));
    const mode: ActivationLayer["mode"] =
      layer.envVarsRequired.length === 0 || present.length === layer.envVarsRequired.length
        ? "live"
        : "scaffold";
    return { ...layer, envVarsPresent: present, mode };
  });

  const liveLayers = layers.filter((l) => l.mode === "live").length;
  const totalLayers = layers.length;
  const activationScore = Math.round((liveLayers / totalLayers) * 100);

  return {
    activationScore,
    liveLayers,
    totalLayers,
    layers,
    generatedAt: new Date().toISOString(),
  };
}
