import { POSTGRES_PILOT_APPLICATION_ROLE } from "./postgresPilotRoleProvisioning.ts";
import { createHash } from "node:crypto";
import { redactPostgresPilotText } from "./postgresPilotRedaction.ts";

export type BootstrapEnvironment = Record<string, string | undefined>;

export type BootstrapPlan = {
  ok: boolean;
  blocked: string[];
  warnings: string[];
  derived: {
    projectRef: string | null;
    poolerHost: string | null;
    restoreProjectRef: string | null;
    applicationUsername: string | null;
    applicationDatabaseUrl: string | null;
    primaryDatabaseUrlSource: "VIREON_PILOT_DATABASE_URL" | "VIREON_PILOT_MIGRATION_DATABASE_URL" | null;
  };
  childEnv: BootstrapEnvironment;
};

export type UrlValidation = {
  ok: boolean;
  reason: string | null;
  protocol: string | null;
  hostname: string | null;
  database: string | null;
  sslmode: string | null;
  pooler: boolean;
  projectRef: string | null;
  hasQuery: boolean;
  parsedQueryKeys: string[];
  sslModeDetected: string | null;
};

export type RestoreTargetValidation = {
  ok: boolean;
  blocked: string[];
  warnings: string[];
  primary: UrlValidation;
  restore: UrlValidation;
  sameProject: boolean;
  sameLogicalDatabase: boolean;
  ssl: boolean;
  guidance: RestoreTargetGuidance | null;
  comparisonBasis: string;
};

export type PostgresConnectionMode = "SUPABASE_POOLER" | "SUPABASE_DIRECT" | "OTHER";

export type ParsedPostgresTarget = {
  ok: boolean;
  reason: string | null;
  protocol: string | null;
  hostname: string | null;
  port: string | null;
  database: string | null;
  projectRef: string | null;
  sslMode: string | null;
  connectionMode: PostgresConnectionMode | null;
  logicalDatabaseIdentity: string | null;
  usernameKind: "ROUTED_SUPABASE_USER" | "DIRECT_USER" | "UNKNOWN";
  validation: UrlValidation;
};

export type PostgresTargetComparison = {
  primary: ParsedPostgresTarget;
  restore: ParsedPostgresTarget;
  sameProject: boolean;
  sameLogicalDatabase: boolean;
  comparisonBasis: string;
};

export type PilotEnvironmentClassification =
  | "PRODUCTION"
  | "NON_PRODUCTION"
  | "DEVELOPMENT"
  | "TEST"
  | "POSTGRES_PILOT_NON_PRODUCTION"
  | "UNKNOWN";

export type PilotEnvironmentValidation = {
  ok: boolean;
  normalizedEnvironment: string | null;
  environmentClassification: PilotEnvironmentClassification;
  reason: string | null;
};

export type PilotTargetValidation = {
  ok: boolean;
  blocked: string[];
  warnings: string[];
  comparison: PostgresTargetComparison;
  restoreTarget: RestoreTargetValidation;
  diagnostics: {
    normalizedEnvironment: string | null;
    environmentClassification: PilotEnvironmentClassification;
    primaryProjectRef: string | null;
    restoreProjectRef: string | null;
    sameProject: boolean;
    sameLogicalDatabase: boolean;
    primaryConnectionMode: PostgresConnectionMode | null;
    restoreConnectionMode: PostgresConnectionMode | null;
    comparisonBasis: string;
  };
};

export type ApplicationConnectionTarget = {
  ok: boolean;
  status: "OK" | "MISSING" | "INVALID" | "APPLICATION_POOLER_USERNAME_NOT_ROUTED";
  reason: string | null;
  applicationRole: string;
  username: string | null;
  routedUsernameHasProjectRef: boolean;
  routedUsernameProjectRef: string | null;
  connectionMode: PostgresConnectionMode | null;
  applicationUrlSource: "VIREON_PILOT_APPLICATION_DATABASE_URL";
  database: string | null;
  hostConfigured: boolean;
  sslMode: string | null;
};

export type PasswordSafetyDiagnostics = {
  passwordConfigured: boolean;
  passwordLength: number;
  passwordHasLeadingWhitespace: boolean;
  passwordHasTrailingWhitespace: boolean;
  passwordContainsNewline: boolean;
  passwordAppearsQuoted: boolean;
  passwordContainsAt: boolean;
  passwordContainsColon: boolean;
  passwordContainsSlash: boolean;
  passwordContainsQuestionMark: boolean;
  passwordContainsHash: boolean;
  passwordContainsPercent: boolean;
  passwordContainsBang: boolean;
  passwordContainsSpace: boolean;
  passwordContainsUnicode: boolean;
  passwordFingerprint: string | null;
};

export type ApplicationCredentialDiagnostics = {
  provisioningPassword: PasswordSafetyDiagnostics;
  applicationUrlPassword: PasswordSafetyDiagnostics;
  verifierPassword: PasswordSafetyDiagnostics;
  fingerprintsMatch: boolean;
  credentialTransport: "PGPASSWORD";
  applicationUrlContainsPassword: boolean;
  credentialTransportContradiction: boolean;
};

export type ApplicationPsqlInvocation = {
  ok: boolean;
  statusCode: "OK" | "APPLICATION_POOLER_EFFECTIVE_USERNAME_NOT_ROUTED" | "INVALID_APPLICATION_CONNECTION_TARGET";
  reason: string | null;
  databaseRole: string;
  connectionUsername: string | null;
  host: string | null;
  port: string | null;
  database: string | null;
  sslMode: string | null;
  connectionMode: PostgresConnectionMode | null;
  projectRef: string | null;
  psqlExecutable: string;
  baseArgs: string[];
  diagnostics: {
    psqlExecutable: string;
    connectionStyle: "EXPLICIT_FLAGS";
    effectiveHost: string | null;
    effectivePort: string | null;
    effectiveDatabase: string | null;
    effectiveUsername: string | null;
    usernameContainsProjectRef: boolean;
    effectiveProjectRef: string | null;
    sslMode: string | null;
    passwordEnvironmentConfigured: boolean;
    pgUserConfigured: boolean;
    pgHostConfigured: boolean;
    pgPortConfigured: boolean;
    pgDatabaseConfigured: boolean;
    pgSslModeConfigured: boolean;
    pgServiceConfigured: boolean;
    pgServiceFileConfigured: boolean;
    pgPassFileConfigured: boolean;
    connectionTargetContainsPassword: boolean;
    passwordInCommandArguments: boolean;
    credentialTransport: "PGPASSWORD";
    commandArgumentsRedacted: string[];
  };
};

export type RestoreTargetGuidance = {
  primaryProjectRef: string | null;
  restoreProjectRef: string | null;
  message: string;
  requirements: string[];
  nextAction: string;
};

export const RESTORE_TARGET_NEXT_ACTION =
  "Create a separate empty Supabase restore project, set VIREON_PILOT_RESTORE_DATABASE_URL, then run npm run postgres:pilot:validate-targets.";

function emptyUrlValidation(reason: string): UrlValidation {
  return {
    ok: false,
    reason,
    protocol: null,
    hostname: null,
    database: null,
    sslmode: null,
    pooler: false,
    projectRef: null,
    hasQuery: false,
    parsedQueryKeys: [],
    sslModeDetected: null,
  };
}

function parsePostgresUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

export function readPostgresUrlSearchParam(url: URL, key: string): string | null {
  const expected = key.toLowerCase();
  for (const [candidateKey, candidateValue] of url.searchParams.entries()) {
    if (candidateKey.toLowerCase() === expected) return candidateValue;
  }
  return null;
}

export function createSafeUrlDiagnostic(validation: UrlValidation): {
  protocol: string | null;
  host: boolean;
  projectRef: string | null;
  hasQuery: boolean;
  parsedQueryKeys: string[];
  sslModeDetected: string | null;
} {
  return {
    protocol: validation.protocol,
    host: Boolean(validation.hostname),
    projectRef: validation.projectRef,
    hasQuery: validation.hasQuery,
    parsedQueryKeys: validation.parsedQueryKeys,
    sslModeDetected: validation.sslModeDetected,
  };
}

export function parsePostgresTarget(value: string | undefined, label: string): ParsedPostgresTarget {
  const validation = validatePilotDatabaseUrl(value, label);
  if (!validation.ok || !value) {
    return {
      ok: false,
      reason: validation.reason,
      protocol: validation.protocol,
      hostname: validation.hostname,
      port: null,
      database: validation.database,
      projectRef: validation.projectRef,
      sslMode: validation.sslmode,
      connectionMode: null,
      logicalDatabaseIdentity: null,
      usernameKind: "UNKNOWN",
      validation,
    };
  }
  const url = parsePostgresUrl(value);
  if (!url) {
    return {
      ok: false,
      reason: `${label} is malformed`,
      protocol: validation.protocol,
      hostname: validation.hostname,
      port: null,
      database: validation.database,
      projectRef: validation.projectRef,
      sslMode: validation.sslmode,
      connectionMode: null,
      logicalDatabaseIdentity: null,
      usernameKind: "UNKNOWN",
      validation,
    };
  }
  const connectionMode: PostgresConnectionMode = validation.pooler
    ? "SUPABASE_POOLER"
    : validation.hostname && /^db\.[a-z0-9-]+\.supabase\.(?:co|com)$/i.test(validation.hostname)
      ? "SUPABASE_DIRECT"
      : "OTHER";
  const username = decodeURIComponent(url.username || "");
  const usernameKind = username.includes(".") && validation.projectRef ? "ROUTED_SUPABASE_USER" : username ? "DIRECT_USER" : "UNKNOWN";
  const port = url.port || "5432";
  const logicalDatabaseIdentity = validation.projectRef
    ? `supabase:${validation.projectRef}:${validation.database ?? ""}`
    : `${validation.hostname ?? ""}:${port}:${validation.database ?? ""}`;
  return {
    ok: true,
    reason: null,
    protocol: validation.protocol,
    hostname: validation.hostname,
    port,
    database: validation.database,
    projectRef: validation.projectRef,
    sslMode: validation.sslmode,
    connectionMode,
    logicalDatabaseIdentity,
    usernameKind,
    validation,
  };
}

export function comparePostgresTargets(input: { primaryUrl: string | undefined; restoreUrl: string | undefined }): PostgresTargetComparison {
  const primary = parsePostgresTarget(input.primaryUrl, "VIREON_PILOT_DATABASE_URL");
  const restore = parsePostgresTarget(input.restoreUrl, "VIREON_PILOT_RESTORE_DATABASE_URL");
  const sameProject = Boolean(primary.projectRef && restore.projectRef && primary.projectRef === restore.projectRef);
  const sameLogicalDatabase = Boolean(
    primary.ok &&
    restore.ok &&
    primary.logicalDatabaseIdentity &&
    restore.logicalDatabaseIdentity &&
    primary.logicalDatabaseIdentity === restore.logicalDatabaseIdentity
  );
  let comparisonBasis = "host, port and database";
  if (primary.connectionMode === "SUPABASE_POOLER" || restore.connectionMode === "SUPABASE_POOLER") {
    comparisonBasis = "Supabase pooler routed username project references";
  } else if (primary.connectionMode === "SUPABASE_DIRECT" || restore.connectionMode === "SUPABASE_DIRECT") {
    comparisonBasis = "Supabase direct database endpoint project references";
  }
  return { primary, restore, sameProject, sameLogicalDatabase, comparisonBasis };
}

export function classifyPilotEnvironment(value: string | undefined | null): PilotEnvironmentValidation {
  const normalizedEnvironment = value?.trim().toLowerCase() || null;
  if (!normalizedEnvironment) {
    return { ok: false, normalizedEnvironment, environmentClassification: "UNKNOWN", reason: "VIREON_ENVIRONMENT is required." };
  }
  if (normalizedEnvironment === "production" || normalizedEnvironment === "prod") {
    return { ok: false, normalizedEnvironment, environmentClassification: "PRODUCTION", reason: "VIREON_ENVIRONMENT is production." };
  }
  if (normalizedEnvironment === "postgres-pilot-non-production") {
    return { ok: true, normalizedEnvironment, environmentClassification: "POSTGRES_PILOT_NON_PRODUCTION", reason: null };
  }
  if (normalizedEnvironment === "non-production") {
    return { ok: true, normalizedEnvironment, environmentClassification: "NON_PRODUCTION", reason: null };
  }
  if (normalizedEnvironment === "development") {
    return { ok: true, normalizedEnvironment, environmentClassification: "DEVELOPMENT", reason: null };
  }
  if (normalizedEnvironment === "test") {
    return { ok: true, normalizedEnvironment, environmentClassification: "TEST", reason: null };
  }
  return { ok: false, normalizedEnvironment, environmentClassification: "UNKNOWN", reason: "VIREON_ENVIRONMENT is not an approved pilot environment." };
}

export function validatePilotTargets(input: {
  primaryUrl: string | undefined;
  restoreUrl: string | undefined;
  environment: string | undefined;
  syntheticDataOnly: string | undefined;
  requireSsl: string | undefined;
  persistenceMode: string | undefined;
}): PilotTargetValidation {
  const blocked: string[] = [];
  const warnings: string[] = [];
  const restoreTarget = validateRestoreTarget({ primaryUrl: input.primaryUrl, restoreUrl: input.restoreUrl });
  const comparison = comparePostgresTargets({ primaryUrl: input.primaryUrl, restoreUrl: input.restoreUrl });
  const environment = classifyPilotEnvironment(input.environment);
  blocked.push(...restoreTarget.blocked);
  warnings.push(...restoreTarget.warnings);
  if (!environment.ok) blocked.push(environment.reason ?? "VIREON_ENVIRONMENT is not approved for the PostgreSQL pilot.");
  if (input.syntheticDataOnly !== "true") blocked.push("VIREON_SYNTHETIC_DATA_ONLY must be true");
  if (input.requireSsl !== "true") blocked.push("VIREON_REQUIRE_SSL must be true");
  if (input.persistenceMode !== "postgres-required") blocked.push("VIREON_PERSISTENCE_MODE must be postgres-required");
  return {
    ok: blocked.length === 0,
    blocked,
    warnings,
    comparison,
    restoreTarget,
    diagnostics: {
      normalizedEnvironment: environment.normalizedEnvironment,
      environmentClassification: environment.environmentClassification,
      primaryProjectRef: comparison.primary.projectRef,
      restoreProjectRef: comparison.restore.projectRef,
      sameProject: comparison.sameProject,
      sameLogicalDatabase: comparison.sameLogicalDatabase,
      primaryConnectionMode: comparison.primary.connectionMode,
      restoreConnectionMode: comparison.restore.connectionMode,
      comparisonBasis: comparison.comparisonBasis,
    },
  };
}

export function deriveSupabaseProjectRef(migrationDatabaseUrl: string | undefined): string | null {
  const url = parsePostgresUrl(migrationDatabaseUrl);
  if (!url) return null;
  const username = decodeURIComponent(url.username || "");
  const usernameMatch = username.match(/^[^.]+\.([a-z0-9-]+)$/i);
  if (usernameMatch?.[1]) return usernameMatch[1];

  const directHostMatch = url.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.(?:co|com)$/i);
  if (directHostMatch?.[1]) return directHostMatch[1];

  const poolerQueryRef = readPostgresUrlSearchParam(url, "project") || readPostgresUrlSearchParam(url, "project_ref");
  return poolerQueryRef || null;
}

export function deriveSupabasePoolerHost(migrationDatabaseUrl: string | undefined): string | null {
  const url = parsePostgresUrl(migrationDatabaseUrl);
  if (!url) return null;
  if (/pooler\.supabase\.(?:co|com)$/i.test(url.hostname)) return url.hostname;
  return null;
}

export function validatePilotDatabaseUrl(value: string | undefined, label: string): UrlValidation {
  if (!value) {
    return emptyUrlValidation(`missing ${label}`);
  }
  const url = parsePostgresUrl(value);
  if (!url) {
    return emptyUrlValidation(`${label} is malformed`);
  }
  const protocol = url.protocol.replace(":", "").toLowerCase();
  const database = url.pathname.replace(/^\//, "") || null;
  const parsedQueryKeys = Array.from(new Set(Array.from(url.searchParams.keys()).map((key) => key.toLowerCase())));
  const sslModeDetected = readPostgresUrlSearchParam(url, "sslmode");
  const sslmode = sslModeDetected?.toLowerCase() ?? null;
  const pooler = /pooler\.supabase\.(?:co|com)$/i.test(url.hostname);
  const projectRef = deriveSupabaseProjectRef(value);
  const base = {
    protocol,
    hostname: url.hostname,
    database,
    sslmode,
    pooler,
    projectRef,
    hasQuery: url.search.length > 0,
    parsedQueryKeys,
    sslModeDetected,
  };
  if (!["postgres", "postgresql"].includes(protocol)) {
    return { ok: false, reason: `${label} must use postgresql://`, ...base };
  }
  if (!url.hostname) {
    return { ok: false, reason: `${label} must include a hostname`, ...base, hostname: null };
  }
  if (!database) {
    return { ok: false, reason: `${label} must include a database name`, ...base };
  }
  if (sslmode !== "require" && sslmode !== "verify-full") {
    return { ok: false, reason: `${label} must include sslmode=require or sslmode=verify-full`, ...base };
  }
  if (/supabase/i.test(url.hostname) && !projectRef) {
    return { ok: false, reason: `${label} is Supabase-hosted but project reference could not be derived`, ...base };
  }
  if (/pooler/i.test(url.hostname) && !pooler) {
    return { ok: false, reason: `${label} contains pooler in hostname but does not match the expected Supabase pooler hostname pattern`, ...base };
  }
  return { ok: true, reason: null, ...base };
}

export function createRestoreTargetGuidance(input: { primaryProjectRef: string | null; restoreProjectRef: string | null }): RestoreTargetGuidance {
  return {
    primaryProjectRef: input.primaryProjectRef,
    restoreProjectRef: input.restoreProjectRef,
    message: "The PostgreSQL pilot restore target must be a second Supabase project, not the primary pilot project.",
    requirements: [
      "Create a second Supabase project manually for restore validation.",
      "Keep the restore project empty and disposable.",
      "Use the restore project's Session Pooler connection string.",
      "Include sslmode=require or sslmode=verify-full.",
      "Do not print, commit or paste passwords into source control, issue comments or logs.",
    ],
    nextAction: RESTORE_TARGET_NEXT_ACTION,
  };
}

export function validateRestoreTarget(input: { primaryUrl: string | undefined; restoreUrl: string | undefined }): RestoreTargetValidation {
  const blocked: string[] = [];
  const warnings: string[] = [];
  const comparison = comparePostgresTargets(input);
  const primary = comparison.primary.validation;
  const restore = comparison.restore.validation;
  const sameLogicalDatabase = comparison.sameLogicalDatabase;
  const sameProject = comparison.sameProject;
  if (!restore.ok) blocked.push(restore.reason ?? "restore URL invalid");
  if (!primary.ok) blocked.push(primary.reason ?? "primary URL invalid");
  if (primary.ok && restore.ok) {
    if (sameLogicalDatabase) {
      blocked.push("restore URL points to the same hostname and database as primary; configure a separate restore database.");
    }
    if (sameProject) {
      blocked.push("restore URL uses the same Supabase project reference as primary; configure a separate restore project for pilot restore validation.");
    }
    if (primary.hostname === restore.hostname && primary.database !== restore.database && !sameProject) {
      warnings.push("restore URL shares the primary hostname but uses a different database; confirm this is an intentionally disposable restore target.");
    }
  }
  const ssl = primary.ok && restore.ok && Boolean(primary.sslmode) && Boolean(restore.sslmode);
  return {
    ok: blocked.length === 0,
    blocked,
    warnings,
    primary,
    restore,
    sameProject,
    sameLogicalDatabase,
    ssl,
    guidance: sameProject ? createRestoreTargetGuidance({ primaryProjectRef: primary.projectRef, restoreProjectRef: restore.projectRef }) : null,
    comparisonBasis: comparison.comparisonBasis,
  };
}

export function buildApplicationDatabaseUrl(input: { migrationDatabaseUrl: string; applicationRolePassword: string }): string {
  void input.applicationRolePassword;
  const url = new URL(input.migrationDatabaseUrl.trim());
  const projectRef = deriveSupabaseProjectRef(input.migrationDatabaseUrl);
  const poolerHost = deriveSupabasePoolerHost(input.migrationDatabaseUrl);
  const useSupabasePoolerUser = Boolean(projectRef && poolerHost);
  const username = useSupabasePoolerUser
    ? `${POSTGRES_PILOT_APPLICATION_ROLE}.${projectRef}`
    : POSTGRES_PILOT_APPLICATION_ROLE;

  url.username = "__vireon_user__";
  url.password = "";
  if (!url.searchParams.get("sslmode")) url.searchParams.set("sslmode", "require");

  const encodedUsername = encodeURIComponent(username);
  return url.toString().replace("__vireon_user__@", `${encodedUsername}@`);
}

export function passwordFingerprint(value: string | undefined | null): string | null {
  if (value == null) return null;
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 12);
}

export function createPasswordSafetyDiagnostics(value: string | undefined | null): PasswordSafetyDiagnostics {
  const passwordConfigured = value != null && value.length > 0;
  const password = value ?? "";
  return {
    passwordConfigured,
    passwordLength: password.length,
    passwordHasLeadingWhitespace: /^\s/.test(password),
    passwordHasTrailingWhitespace: /\s$/.test(password),
    passwordContainsNewline: /[\r\n]/.test(password),
    passwordAppearsQuoted: (password.startsWith("'") && password.endsWith("'")) || (password.startsWith('"') && password.endsWith('"')),
    passwordContainsAt: password.includes("@"),
    passwordContainsColon: password.includes(":"),
    passwordContainsSlash: password.includes("/"),
    passwordContainsQuestionMark: password.includes("?"),
    passwordContainsHash: password.includes("#"),
    passwordContainsPercent: password.includes("%"),
    passwordContainsBang: password.includes("!"),
    passwordContainsSpace: password.includes(" "),
    passwordContainsUnicode: /[^\u0000-\u007f]/.test(password),
    passwordFingerprint: passwordConfigured ? passwordFingerprint(password) : null,
  };
}

export function decodeUrlPassword(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const encodedPassword = new URL(value.trim()).password;
    return encodedPassword ? decodeURIComponent(encodedPassword) : null;
  } catch {
    return null;
  }
}

export function buildPasswordlessDatabaseUrl(value: string): string {
  const url = new URL(value.trim());
  url.password = "";
  return url.toString();
}

export const POSTGRES_PILOT_LIBPQ_ENV_KEYS = [
  "PGUSER",
  "PGHOST",
  "PGHOSTADDR",
  "PGPORT",
  "PGDATABASE",
  "PGSERVICE",
  "PGSERVICEFILE",
  "PGPASSFILE",
  "PGOPTIONS",
  "PGAPPNAME",
  "PGCONNECT_TIMEOUT",
  "PGTARGETSESSIONATTRS",
] as const;

export function buildSanitizedPsqlEnvironment(input: {
  baseEnv: BootstrapEnvironment;
  password: string;
  sslMode?: string | null;
  connectTimeoutSeconds?: string;
}): BootstrapEnvironment {
  const env: BootstrapEnvironment = {};
  const preserveCaseInsensitive = ["SystemRoot", "WINDIR", "PATH", "Path", "TEMP", "TMP"];
  for (const preserveKey of preserveCaseInsensitive) {
    const existingKey = Object.keys(input.baseEnv).find((key) => key.toUpperCase() === preserveKey.toUpperCase());
    if (existingKey && input.baseEnv[existingKey] != null) {
      const normalizedKey = preserveKey === "Path" ? "PATH" : preserveKey;
      env[normalizedKey] = input.baseEnv[existingKey];
    }
  }
  if (!env.PATH && input.baseEnv.PATH) env.PATH = input.baseEnv.PATH;
  if (!env.TEMP && input.baseEnv.TEMP) env.TEMP = input.baseEnv.TEMP;
  if (!env.TMP && input.baseEnv.TMP) env.TMP = input.baseEnv.TMP;
  env.PGPASSWORD = input.password;
  env.PGSSLMODE = input.sslMode || "require";
  env.PGCONNECT_TIMEOUT = input.connectTimeoutSeconds || "10";
  return env;
}

function psqlBaseArgs(input: {
  host: string;
  port: string;
  username: string;
  database: string;
}): string[] {
  return [
    "-X",
    "-w",
    "-h",
    input.host,
    "-p",
    input.port,
    "-U",
    input.username,
    "-d",
    input.database,
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
  ];
}

export function buildApplicationPsqlInvocation(input: {
  applicationUrl: string | undefined | null;
  password: string | undefined | null;
  psqlExecutable?: string;
}): ApplicationPsqlInvocation {
  const psqlExecutable = input.psqlExecutable || "psql";
  const target = inspectApplicationConnectionTarget(input.applicationUrl);
  const passwordConfigured = Boolean(input.password);
  const emptyDiagnostics = {
    psqlExecutable,
    connectionStyle: "EXPLICIT_FLAGS" as const,
    effectiveHost: null,
    effectivePort: null,
    effectiveDatabase: null,
    effectiveUsername: target.username,
    usernameContainsProjectRef: target.routedUsernameHasProjectRef,
    effectiveProjectRef: target.routedUsernameProjectRef,
    sslMode: target.sslMode,
    passwordEnvironmentConfigured: passwordConfigured,
    pgUserConfigured: false,
    pgHostConfigured: false,
    pgPortConfigured: false,
    pgDatabaseConfigured: false,
    pgSslModeConfigured: true,
    pgServiceConfigured: false,
    pgServiceFileConfigured: false,
    pgPassFileConfigured: false,
    connectionTargetContainsPassword: false,
    passwordInCommandArguments: false,
    credentialTransport: "PGPASSWORD" as const,
    commandArgumentsRedacted: [] as string[],
  };
  if (!target.ok || !input.applicationUrl) {
    return {
      ok: false,
      statusCode: target.status === "APPLICATION_POOLER_USERNAME_NOT_ROUTED"
        ? "APPLICATION_POOLER_EFFECTIVE_USERNAME_NOT_ROUTED"
        : "INVALID_APPLICATION_CONNECTION_TARGET",
      reason: target.reason || "invalid application database URL",
      databaseRole: POSTGRES_PILOT_APPLICATION_ROLE,
      connectionUsername: target.username,
      host: null,
      port: null,
      database: target.database,
      sslMode: target.sslMode,
      connectionMode: target.connectionMode,
      projectRef: target.routedUsernameProjectRef,
      psqlExecutable,
      baseArgs: [],
      diagnostics: emptyDiagnostics,
    };
  }

  const url = new URL(input.applicationUrl.trim());
  const connectionUsername = decodeURIComponent(url.username || "");
  const host = url.hostname;
  const port = url.port || "5432";
  const database = url.pathname.replace(/^\//, "") || "postgres";
  const sslMode = target.sslMode || "require";
  const projectRef = target.routedUsernameProjectRef;
  const usernameContainsProjectRef = Boolean(projectRef);
  const baseArgs = psqlBaseArgs({ host, port, username: connectionUsername, database });
  const commandArgumentsRedacted = [...baseArgs, "-c", "<sql>"];
  const diagnostics = {
    ...emptyDiagnostics,
    effectiveHost: host,
    effectivePort: port,
    effectiveDatabase: database,
    effectiveUsername: connectionUsername,
    usernameContainsProjectRef,
    effectiveProjectRef: projectRef,
    sslMode,
    commandArgumentsRedacted,
  };

  if (target.connectionMode === "SUPABASE_POOLER" && !usernameContainsProjectRef) {
    return {
      ok: false,
      statusCode: "APPLICATION_POOLER_EFFECTIVE_USERNAME_NOT_ROUTED",
      reason: "Supabase Session Pooler verification must use routed username vireon_app.<project-ref> in the actual -U argument.",
      databaseRole: POSTGRES_PILOT_APPLICATION_ROLE,
      connectionUsername,
      host,
      port,
      database,
      sslMode,
      connectionMode: target.connectionMode,
      projectRef,
      psqlExecutable,
      baseArgs,
      diagnostics,
    };
  }

  return {
    ok: true,
    statusCode: "OK",
    reason: null,
    databaseRole: POSTGRES_PILOT_APPLICATION_ROLE,
    connectionUsername,
    host,
    port,
    database,
    sslMode,
    connectionMode: target.connectionMode,
    projectRef,
    psqlExecutable,
    baseArgs,
    diagnostics,
  };
}

export function buildApplicationCredentialDiagnostics(input: {
  provisioningPassword: string | undefined | null;
  applicationUrl: string | undefined | null;
  verifierPassword: string | undefined | null;
}): ApplicationCredentialDiagnostics {
  const applicationUrlPassword = decodeUrlPassword(input.applicationUrl);
  const provisioningPassword = createPasswordSafetyDiagnostics(input.provisioningPassword);
  const verifierPassword = createPasswordSafetyDiagnostics(input.verifierPassword);
  const urlPassword = createPasswordSafetyDiagnostics(applicationUrlPassword);
  const applicationUrlContainsPassword = Boolean(applicationUrlPassword);
  return {
    provisioningPassword,
    applicationUrlPassword: urlPassword,
    verifierPassword,
    fingerprintsMatch: Boolean(
      provisioningPassword.passwordFingerprint &&
      provisioningPassword.passwordFingerprint === verifierPassword.passwordFingerprint
    ),
    credentialTransport: "PGPASSWORD",
    applicationUrlContainsPassword,
    credentialTransportContradiction: applicationUrlContainsPassword,
  };
}

export function inspectApplicationConnectionTarget(value: string | undefined | null): ApplicationConnectionTarget {
  const applicationRole = POSTGRES_PILOT_APPLICATION_ROLE;
  if (!value) {
    return {
      ok: false,
      status: "MISSING",
      reason: "missing VIREON_PILOT_APPLICATION_DATABASE_URL",
      applicationRole,
      username: null,
      routedUsernameHasProjectRef: false,
      routedUsernameProjectRef: null,
      connectionMode: null,
      applicationUrlSource: "VIREON_PILOT_APPLICATION_DATABASE_URL",
      database: null,
      hostConfigured: false,
      sslMode: null,
    };
  }

  const target = parsePostgresTarget(value, "VIREON_PILOT_APPLICATION_DATABASE_URL");
  let username: string | null = null;
  let hostname: string | null = target.hostname;
  let database: string | null = target.database;
  let sslMode: string | null = target.sslMode;
  let inferredConnectionMode = target.connectionMode;
  try {
    const url = new URL(value.trim());
    username = decodeURIComponent(url.username || "") || null;
    hostname = url.hostname || hostname;
    database = url.pathname ? url.pathname.replace(/^\//, "") : database;
    inferredConnectionMode = /pooler\.supabase\.(?:co|com)$/i.test(url.hostname) ? "SUPABASE_POOLER" : inferredConnectionMode;
    sslMode = readPostgresUrlSearchParam(url, "sslmode")?.toLowerCase() ?? sslMode;
  } catch {
    username = null;
  }
  const routedPrefix = `${applicationRole}.`;
  const routedUsernameHasProjectRef = Boolean(username?.startsWith(routedPrefix) && username.length > routedPrefix.length);
  const routedUsernameProjectRef = routedUsernameHasProjectRef ? username!.slice(routedPrefix.length) : null;

  if (inferredConnectionMode === "SUPABASE_POOLER" && username === applicationRole && !routedUsernameHasProjectRef) {
    return {
      ok: false,
      status: "APPLICATION_POOLER_USERNAME_NOT_ROUTED",
      reason: "Supabase Session Pooler application URLs must use routed username vireon_app.<project-ref>.",
      applicationRole,
      username,
      routedUsernameHasProjectRef,
      routedUsernameProjectRef,
      connectionMode: inferredConnectionMode,
      applicationUrlSource: "VIREON_PILOT_APPLICATION_DATABASE_URL",
      database,
      hostConfigured: Boolean(hostname),
      sslMode,
    };
  }

  if (inferredConnectionMode === "SUPABASE_POOLER" && !routedUsernameHasProjectRef) {
    return {
      ok: false,
      status: "INVALID",
      reason: "VIREON_PILOT_APPLICATION_DATABASE_URL must use Supabase pooler user vireon_app.<project-ref>.",
      applicationRole,
      username,
      routedUsernameHasProjectRef,
      routedUsernameProjectRef,
      connectionMode: inferredConnectionMode,
      applicationUrlSource: "VIREON_PILOT_APPLICATION_DATABASE_URL",
      database,
      hostConfigured: Boolean(hostname),
      sslMode,
    };
  }

  if (!target.ok) {
    return {
      ok: false,
      status: "INVALID",
      reason: target.reason,
      applicationRole,
      username,
      routedUsernameHasProjectRef,
      routedUsernameProjectRef,
      connectionMode: target.connectionMode,
      applicationUrlSource: "VIREON_PILOT_APPLICATION_DATABASE_URL",
      database: target.database,
      hostConfigured: Boolean(target.hostname),
      sslMode: target.sslMode,
    };
  }

  if (target.connectionMode !== "SUPABASE_POOLER" && username !== applicationRole) {
    return {
      ok: false,
      status: "INVALID",
      reason: "Direct application database URLs must use vireon_app.",
      applicationRole,
      username,
      routedUsernameHasProjectRef,
      routedUsernameProjectRef,
      connectionMode: target.connectionMode,
      applicationUrlSource: "VIREON_PILOT_APPLICATION_DATABASE_URL",
      database: target.database,
      hostConfigured: Boolean(target.hostname),
      sslMode: target.sslMode,
    };
  }

  return {
    ok: true,
    status: "OK",
    reason: null,
    applicationRole,
    username,
    routedUsernameHasProjectRef,
    routedUsernameProjectRef,
    connectionMode: target.connectionMode,
    applicationUrlSource: "VIREON_PILOT_APPLICATION_DATABASE_URL",
    database: target.database,
    hostConfigured: Boolean(target.hostname),
    sslMode: target.sslMode,
  };
}

export function redactConnectionString(value: string | undefined | null): string | null {
  if (!value) return null;
  return redactPostgresPilotText(value);
}

export function evaluateRestoreDisposable(input: { tableCount: number; explicitlyDisposable: boolean }): { ok: boolean; restoreDisposable: boolean; blocked: string[]; warnings: string[] } {
  if (input.tableCount < 0 || !Number.isFinite(input.tableCount)) {
    return {
      ok: false,
      restoreDisposable: false,
      blocked: ["restore database object count could not be interpreted."],
      warnings: [],
    };
  }
  if (input.tableCount > 0 && !input.explicitlyDisposable) {
    return {
      ok: false,
      restoreDisposable: false,
      blocked: ["restore database is not empty; set VIREON_PILOT_RESTORE_DISPOSABLE=true only after confirming it contains no protected data."],
      warnings: [],
    };
  }
  if (input.tableCount > 0) {
    return {
      ok: true,
      restoreDisposable: true,
      blocked: [],
      warnings: ["restore database is non-empty but explicitly marked disposable."],
    };
  }
  return { ok: true, restoreDisposable: true, blocked: [], warnings: [] };
}

export function createPostgresPilotBootstrapPlan(env: BootstrapEnvironment): BootstrapPlan {
  const blocked: string[] = [];
  const warnings: string[] = [];
  const migrationUrl = env.VIREON_PILOT_MIGRATION_DATABASE_URL;
  const restoreUrl = env.VIREON_PILOT_RESTORE_DATABASE_URL;
  const appPassword = env.VIREON_PILOT_APPLICATION_ROLE_PASSWORD;

  if (!migrationUrl) blocked.push("missing VIREON_PILOT_MIGRATION_DATABASE_URL");
  if (!restoreUrl) {
    blocked.push("missing VIREON_PILOT_RESTORE_DATABASE_URL; configure a separate restore database before bootstrap can run preflight.");
  }
  if (!appPassword) blocked.push("missing VIREON_PILOT_APPLICATION_ROLE_PASSWORD");

  const migrationValidation = validatePilotDatabaseUrl(migrationUrl, "VIREON_PILOT_MIGRATION_DATABASE_URL");
  if (migrationUrl && !migrationValidation.ok) blocked.push(migrationValidation.reason ?? "migration URL invalid");

  let applicationDatabaseUrl: string | null = null;
  let applicationUsername: string | null = null;
  if (migrationUrl && appPassword) {
    try {
      applicationDatabaseUrl = buildApplicationDatabaseUrl({ migrationDatabaseUrl: migrationUrl, applicationRolePassword: appPassword });
      applicationUsername = decodeURIComponent(new URL(applicationDatabaseUrl).username);
    } catch {
      blocked.push("VIREON_PILOT_MIGRATION_DATABASE_URL is malformed; cannot derive application database URL.");
    }
  }

  const primaryDatabaseUrlSource = env.VIREON_PILOT_DATABASE_URL
    ? "VIREON_PILOT_DATABASE_URL"
    : migrationUrl
      ? "VIREON_PILOT_MIGRATION_DATABASE_URL"
      : null;

  const restoreValidation = validateRestoreTarget({
    primaryUrl: env.VIREON_PILOT_DATABASE_URL || migrationUrl,
    restoreUrl,
  });
  blocked.push(...restoreValidation.blocked);
  warnings.push(...restoreValidation.warnings);

  const childEnv: BootstrapEnvironment = {
    ...env,
    VIREON_PILOT_DATABASE_URL: env.VIREON_PILOT_DATABASE_URL || migrationUrl,
    VIREON_PILOT_APPLICATION_DATABASE_URL: applicationDatabaseUrl || env.VIREON_PILOT_APPLICATION_DATABASE_URL,
    VIREON_PERSISTENCE_MODE: env.VIREON_PERSISTENCE_MODE || "postgres-required",
    VIREON_ENVIRONMENT: env.VIREON_ENVIRONMENT || "postgres-pilot-non-production",
    VIREON_SYNTHETIC_DATA_ONLY: env.VIREON_SYNTHETIC_DATA_ONLY || "true",
    VIREON_REQUIRE_SSL: env.VIREON_REQUIRE_SSL || "true",
  };

  return {
    ok: blocked.length === 0,
    blocked,
    warnings,
    derived: {
      projectRef: deriveSupabaseProjectRef(migrationUrl),
      poolerHost: deriveSupabasePoolerHost(migrationUrl),
      restoreProjectRef: deriveSupabaseProjectRef(restoreUrl),
      applicationUsername,
      applicationDatabaseUrl,
      primaryDatabaseUrlSource,
    },
    childEnv,
  };
}
