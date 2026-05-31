// Centralized environment validation — checks presence and validity without exposing values.

export type EnvCheckResult = {
  key: string;
  present: boolean;
  required: boolean;
  description: string;
  group: "database" | "auth" | "vector" | "deployment";
};

const ENV_SPEC: Omit<EnvCheckResult, "present">[] = [
  {
    key: "DATABASE_URL",
    required: true,
    description: "PostgreSQL connection string for Prisma",
    group: "database",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    description: "Supabase project URL (public)",
    group: "auth",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anonymous key (public)",
    group: "auth",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    description: "Supabase service role key (server-only, never expose to browser)",
    group: "auth",
  },
  {
    key: "OPENAI_API_KEY",
    required: false,
    description: "OpenAI key for vector embeddings and semantic search",
    group: "vector",
  },
];

export function validateEnv(): EnvCheckResult[] {
  return ENV_SPEC.map((spec) => ({
    ...spec,
    present: Boolean(process.env[spec.key]),
  }));
}

export function getMissingRequired(): string[] {
  return validateEnv()
    .filter((r) => r.required && !r.present)
    .map((r) => r.key);
}

export function getMissingByGroup(group: EnvCheckResult["group"]): string[] {
  return validateEnv()
    .filter((r) => r.group === group && r.required && !r.present)
    .map((r) => r.key);
}

export function isProductionReady(): boolean {
  return getMissingRequired().length === 0;
}

export function isDatabaseReady(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);
}

export function isAuthReady(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export interface SupabaseReadinessDiagnostic {
  step: string;
  status: "ok" | "pending" | "missing";
  detail: string;
  action: string | null;
}

export function supabaseReadinessDiagnostics(): SupabaseReadinessDiagnostic[] {
  const urlPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKeyPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serviceKeyPresent = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return [
    {
      step: "Project URL",
      status: urlPresent ? "ok" : "missing",
      detail: urlPresent ? "NEXT_PUBLIC_SUPABASE_URL configured" : "NEXT_PUBLIC_SUPABASE_URL not set",
      action: urlPresent
        ? null
        : "Set NEXT_PUBLIC_SUPABASE_URL to your Supabase project URL (e.g. https://xyzabc.supabase.co)",
    },
    {
      step: "Anonymous Key",
      status: anonKeyPresent ? "ok" : "missing",
      detail: anonKeyPresent ? "NEXT_PUBLIC_SUPABASE_ANON_KEY configured" : "NEXT_PUBLIC_SUPABASE_ANON_KEY not set",
      action: anonKeyPresent
        ? null
        : "Set NEXT_PUBLIC_SUPABASE_ANON_KEY from your Supabase project API settings",
    },
    {
      step: "Service Role Key",
      status: serviceKeyPresent ? "ok" : "missing",
      detail: serviceKeyPresent ? "SUPABASE_SERVICE_ROLE_KEY configured" : "SUPABASE_SERVICE_ROLE_KEY not set",
      action: serviceKeyPresent
        ? null
        : "Set SUPABASE_SERVICE_ROLE_KEY from your Supabase project API settings (server-only)",
    },
    {
      step: "Browser Auth Client",
      status: urlPresent && anonKeyPresent ? "ok" : "pending",
      detail:
        urlPresent && anonKeyPresent
          ? "Browser auth client ready"
          : "Waiting for project URL + anon key",
      action: null,
    },
    {
      step: "Server Auth Client",
      status: urlPresent && serviceKeyPresent ? "ok" : "pending",
      detail:
        urlPresent && serviceKeyPresent
          ? "Server-side auth ready"
          : "Waiting for project URL + service role key",
      action: null,
    },
  ];
}
