import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg, { type QueryResult as PgQueryResult } from "pg";
import { redactPostgresPilotText } from "@/lib/postgresPilotRedaction";
import {
  buildApplicationDatabaseUrl,
  parsePostgresTarget,
  type ParsedPostgresTarget,
} from "@/lib/postgresPilotBootstrap";
import type { PostgresPilotClient, QueryResult } from "@/lib/postgresPilotPersistence";

if (typeof window !== "undefined") {
  throw new Error("PostgreSQL runtime modules are server-only.");
}

export type RuntimeDatabaseConfig = {
  applicationDatabaseUrl: string;
  applicationRolePassword: string;
  expectedRole?: string;
  queryTimeoutMs?: number;
  statementTimeoutMs?: number;
  correlationId?: string;
};

export type RuntimeDatabaseValidation = {
  ok: boolean;
  blocked: string[];
  target: ParsedPostgresTarget | null;
  username: string | null;
  projectRef: string | null;
  credentialTransport: "PGPASSWORD";
  passwordInUrl: boolean;
  redactedUrl: string | null;
};

export type DatabaseErrorClass =
  | "UNIQUE_CONSTRAINT"
  | "FOREIGN_KEY"
  | "SERIALIZATION_FAILURE"
  | "DEADLOCK"
  | "QUERY_TIMEOUT"
  | "PERMISSION_DENIED"
  | "RLS_OR_FORBIDDEN"
  | "CONNECTION"
  | "UNKNOWN";

export type DatabaseOperationLog = {
  correlationId: string;
  operation: string;
  durationMs: number;
  ok: boolean;
  errorClass?: DatabaseErrorClass;
  safeMessage?: string;
};

const ADMIN_USERNAMES = new Set(["postgres", "supabase_admin", "service_role"]);
const DEFAULT_QUERY_TIMEOUT_MS = 10_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 8_000;
const APPLICATION_ROLE = "vireon_app";
const USER_ENV_FALLBACK_NAMES = new Set([
  "VIREON_PILOT_MIGRATION_DATABASE_URL",
  "VIREON_DATABASE_URL",
  "VIREON_PILOT_APPLICATION_DATABASE_URL",
  "VIREON_APPLICATION_DATABASE_URL",
  "VIREON_PILOT_APPLICATION_ROLE_PASSWORD",
  "VIREON_APPLICATION_DATABASE_PASSWORD",
  "VIREON_DB_QUERY_TIMEOUT_MS",
  "VIREON_DB_STATEMENT_TIMEOUT_MS",
  "VIREON_CORRELATION_ID",
  "VIREON_PSQL_PATH",
  "PSQL_PATH",
]);
const windowsUserEnvCache = new Map<string, string>();
const WINDOWS_PSQL_CANDIDATES = [
  "C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe",
  "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe",
  "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe",
  "C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe",
];
const { Client: PgClient } = pg;

export function resolvePsqlExecutable(input?: { explicit?: string; env?: NodeJS.ProcessEnv; exists?: (path: string) => boolean }): string {
  const env = input?.env ?? process.env;
  const exists = input?.exists ?? existsSync;
  const explicit = input?.explicit || resolveRuntimeEnvValue("VIREON_PSQL_PATH", env) || resolveRuntimeEnvValue("PSQL_PATH", env);
  if (explicit) return explicit;
  if (process.platform === "win32") {
    const candidate = WINDOWS_PSQL_CANDIDATES.find((item) => exists(item));
    if (candidate) return candidate;
  }
  return "psql";
}

export function resolveRuntimeEnvValue(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  userEnvReader?: (name: string) => string | undefined
): string {
  const processValue = env[name];
  if (typeof processValue === "string" && processValue.trim().length > 0) return processValue;
  if (!USER_ENV_FALLBACK_NAMES.has(name)) return "";
  if (userEnvReader) return userEnvReader(name) || "";
  if (env !== process.env || process.platform !== "win32") return "";
  if (windowsUserEnvCache.has(name)) return windowsUserEnvCache.get(name) || "";
  const powershell = process.env.SystemRoot
    ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
    : "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
  const result = spawnSync(
    powershell,
    ["-NoProfile", "-Command", `[Environment]::GetEnvironmentVariable('${name.replace(/'/g, "''")}', 'User')`],
    { encoding: "utf8", windowsHide: true, timeout: 5_000 }
  );
  const value = result.status === 0 ? String(result.stdout || "").trim() : "";
  windowsUserEnvCache.set(name, value);
  return value;
}

export function createRuntimeDatabaseConfigFromEnv(env: NodeJS.ProcessEnv = process.env): RuntimeDatabaseConfig {
  const value = (name: string) => resolveRuntimeEnvValue(name, env);
  const migrationUrl = value("VIREON_PILOT_MIGRATION_DATABASE_URL") || value("VIREON_DATABASE_URL");
  const explicitApplicationUrl = value("VIREON_PILOT_APPLICATION_DATABASE_URL") || value("VIREON_APPLICATION_DATABASE_URL");
  const applicationRolePassword = value("VIREON_PILOT_APPLICATION_ROLE_PASSWORD") || value("VIREON_APPLICATION_DATABASE_PASSWORD");
  const applicationDatabaseUrl =
    explicitApplicationUrl ||
    (migrationUrl && applicationRolePassword
      ? buildApplicationDatabaseUrl({
          migrationDatabaseUrl: migrationUrl,
          applicationRolePassword,
        })
      : "");

  return {
    applicationDatabaseUrl,
    applicationRolePassword,
    expectedRole: APPLICATION_ROLE,
    queryTimeoutMs: Number(value("VIREON_DB_QUERY_TIMEOUT_MS") || DEFAULT_QUERY_TIMEOUT_MS),
    statementTimeoutMs: Number(value("VIREON_DB_STATEMENT_TIMEOUT_MS") || DEFAULT_STATEMENT_TIMEOUT_MS),
    correlationId: value("VIREON_CORRELATION_ID") || undefined,
  };
}

export function validateRuntimeDatabaseConfig(config: RuntimeDatabaseConfig): RuntimeDatabaseValidation {
  const blocked: string[] = [];
  const expectedRole = config.expectedRole || APPLICATION_ROLE;
  let target: ParsedPostgresTarget | null = null;
  let username: string | null = null;
  let projectRef: string | null = null;
  let passwordInUrl = false;
  let redactedUrl: string | null = null;

  if (!config.applicationDatabaseUrl) blocked.push("missing runtime application database URL");
  if (!config.applicationRolePassword) blocked.push("missing runtime application role password");

  if (config.applicationDatabaseUrl) {
    try {
      const url = new URL(config.applicationDatabaseUrl.trim());
      passwordInUrl = Boolean(url.password);
      redactedUrl = redactPostgresPilotText(config.applicationDatabaseUrl);
      target = parsePostgresTarget(config.applicationDatabaseUrl, "VIREON_RUNTIME_DATABASE_URL");
      username = decodeURIComponent(url.username);
      projectRef = target.projectRef;
      const bareUsername = username.split(".")[0];
      if (ADMIN_USERNAMES.has(bareUsername)) blocked.push("runtime database URL uses an administrative database role");
      if (bareUsername !== expectedRole) blocked.push(`runtime database URL must use ${expectedRole}`);
      if (!target.ok) blocked.push(target.reason || "runtime database URL is invalid");
      if (target.sslMode !== "require" && target.sslMode !== "verify-full") blocked.push("runtime database URL must require SSL");
      if (target.connectionMode === "SUPABASE_POOLER" && !username.includes(".")) {
        blocked.push("Supabase pooler runtime username must include the project reference");
      }
    } catch {
      blocked.push("runtime application database URL is malformed");
    }
  }

  return {
    ok: blocked.length === 0,
    blocked,
    target,
    username,
    projectRef,
    credentialTransport: "PGPASSWORD",
    passwordInUrl,
    redactedUrl,
  };
}

export function classifyDatabaseError(error: unknown): DatabaseErrorClass {
  const text = `${error instanceof Error ? error.message : String(error)}`.toLowerCase();
  if (text.includes("23505") || text.includes("duplicate key")) return "UNIQUE_CONSTRAINT";
  if (text.includes("23503") || text.includes("foreign key")) return "FOREIGN_KEY";
  if (text.includes("40001") || text.includes("serialization")) return "SERIALIZATION_FAILURE";
  if (text.includes("40p01") || text.includes("deadlock")) return "DEADLOCK";
  if (text.includes("timeout") || text.includes("statement timeout")) return "QUERY_TIMEOUT";
  if (text.includes("permission denied")) return "PERMISSION_DENIED";
  if (text.includes("row-level security") || text.includes("violates row-level security")) return "RLS_OR_FORBIDDEN";
  if (
    text.includes("connection") ||
    text.includes("authentication failed") ||
    text.includes("could not translate host") ||
    text.includes("enotfound") ||
    text.includes("eai_again") ||
    text.includes("econnrefused") ||
    text.includes("econnreset") ||
    text.includes("etimedout") ||
    text.includes("self-signed certificate") ||
    text.includes("enoent") ||
    text.includes("spawn")
  ) return "CONNECTION";
  return "UNKNOWN";
}

export function redactDatabaseDiagnostics<T>(value: T, secrets: Array<string | undefined | null> = []): T {
  const concreteSecrets = secrets.filter((item): item is string => Boolean(item));
  const visit = (item: unknown): unknown => {
    if (typeof item === "string") return redactPostgresPilotText(item, concreteSecrets);
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, visit(entry)]));
    }
    return item;
  };
  return visit(value) as T;
}

function quoteLiteral(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `array[${value.map(quoteLiteral).join(",")}]`;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot serialize non-finite number as SQL literal.");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function bindSqlParameters(sql: string, params: unknown[] = []): string {
  return sql.replace(/\$(\d+)/g, (_match, indexText: string) => {
    const index = Number(indexText) - 1;
    if (index < 0 || index >= params.length) throw new Error(`Missing SQL parameter $${indexText}.`);
    return quoteLiteral(params[index]);
  });
}

export function queryCanReturnRows(sql: string): boolean {
  const normalized = sql.trim().replace(/;+\s*$/, "");
  if (/^\s*with\b/i.test(normalized) && /\b(insert|update|delete)\b/i.test(normalized)) return false;
  return /^\s*(select|with|values|show)\b/i.test(normalized) || /\breturning\b/i.test(normalized);
}

function wrapSqlForJsonRows(sql: string): string {
  return `with __vireon_q as (${sql.trim().replace(/;+\s*$/, "")}) select coalesce(json_agg(row_to_json(__vireon_q)), '[]'::json) from __vireon_q;`;
}

export class PsqlRuntimeClient implements PostgresPilotClient {
  private readonly config: RuntimeDatabaseConfig;
  private readonly logger: (entry: DatabaseOperationLog) => void;

  constructor(input: RuntimeDatabaseConfig & { psqlExecutable?: string; logger?: (entry: DatabaseOperationLog) => void }) {
    const validation = validateRuntimeDatabaseConfig(input);
    if (!validation.ok) {
      throw new Error(`Invalid runtime PostgreSQL configuration: ${validation.blocked.join("; ")}`);
    }
    this.config = input;
    this.logger = input.logger || (() => undefined);
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    if (/^\s*select\s+set_config\(\s*'app\.current_user_id'/i.test(sql)) {
      throw new Error("User scope must be set inside a PostgreSQL transaction session.");
    }
    const rows = await this.queryJsonRows<T>(sql, params);
    return { rows, rowCount: rows.length };
  }

  async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
    const session = new PsqlTransactionClient({
      config: this.config,
      logger: this.logger,
    });
    await session.open();
    try {
      const result = await operation(session);
      await session.commit();
      return result;
    } catch (error) {
      await session.rollback();
      throw error;
    } finally {
      await session.close();
    }
  }

  private async queryJsonRows<T>(sql: string, params: unknown[]): Promise<T[]> {
    const correlationId = this.config.correlationId || randomUUID();
    const started = Date.now();
    const client = createPgClient(this.config);
    const returnsRows = queryCanReturnRows(sql);
    try {
      await withDatabaseTimeout(client.connect(), this.config.queryTimeoutMs || DEFAULT_QUERY_TIMEOUT_MS, client);
      await withDatabaseTimeout(client.query("begin"), this.config.queryTimeoutMs || DEFAULT_QUERY_TIMEOUT_MS, client);
      await withDatabaseTimeout(
        client.query("select set_config('statement_timeout', $1, true)", [statementTimeoutValue(this.config.statementTimeoutMs)]),
        this.config.queryTimeoutMs || DEFAULT_QUERY_TIMEOUT_MS,
        client
      );
      const result = await runPgQuery<T>(client, sql, params, returnsRows, this.config.queryTimeoutMs);
      await client.query("commit");
      this.logger({ correlationId, operation: "postgres.query", durationMs: Date.now() - started, ok: true });
      return result.rows;
    } catch (error) {
      await safeRollback(client);
      const safe = redactPostgresPilotText(error instanceof Error ? error.message : String(error), [this.config.applicationRolePassword]);
      const errorClass = classifyDatabaseError(safe);
      this.logger({ correlationId, operation: "postgres.query", durationMs: Date.now() - started, ok: false, errorClass, safeMessage: safe });
      throw new Error(safe);
    } finally {
      await safeEnd(client);
    }
  }
}

type TransactionClientInput = {
  config: RuntimeDatabaseConfig;
  logger: (entry: DatabaseOperationLog) => void;
};

class PsqlTransactionClient implements PostgresPilotClient {
  private readonly input: TransactionClientInput;
  private client: pg.Client | null = null;
  private closed = false;
  private unusable = false;

  constructor(input: TransactionClientInput) {
    this.input = input;
  }

  async open(): Promise<void> {
    this.client = createPgClient(this.input.config);
    await withDatabaseTimeout(this.client.connect(), this.input.config.queryTimeoutMs || DEFAULT_QUERY_TIMEOUT_MS, this.client);
    await this.executeRaw("begin");
    await this.executeRaw("select set_config('statement_timeout', $1, true)", [statementTimeoutValue(this.input.config.statementTimeoutMs)]);
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    if (/^\s*select\s+set_config\(\s*'app\.current_user_id'/i.test(sql)) {
      await this.executeRaw(sql, params);
      return { rows: [] as T[], rowCount: 0 };
    }
    const returnsRows = queryCanReturnRows(sql);
    const result = await this.executeQuery<T>(sql, params, returnsRows);
    const rows = result.rows;
    return { rows, rowCount: rows.length };
  }

  async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async commit(): Promise<void> {
    await this.executeRaw("commit");
    this.closed = true;
  }

  async rollback(): Promise<void> {
    if (this.closed || this.unusable) return;
    try {
      await this.executeRaw("rollback");
      this.closed = true;
    } catch {
      // The original transaction error is more useful than a rollback failure.
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    await safeEnd(this.client);
  }

  private async executeRaw(sql: string, params: unknown[] = []): Promise<void> {
    await this.executeQuery(sql, params, false);
  }

  private async executeQuery<T = unknown>(sql: string, params: unknown[], returnsRows: boolean): Promise<QueryResult<T>> {
    const client = this.client;
    if (!client || this.closed || this.unusable) return Promise.reject(new Error("PostgreSQL transaction session is closed."));
    const correlationId = this.input.config.correlationId || randomUUID();
    const started = Date.now();
    try {
      const result = await runPgQuery<T>(client, sql, params, returnsRows, this.input.config.queryTimeoutMs);
      this.input.logger({ correlationId, operation: "postgres.transaction", durationMs: Date.now() - started, ok: true });
      return result;
    } catch (error) {
      this.unusable = true;
      const safe = redactPostgresPilotText(error instanceof Error ? error.message : String(error), [this.input.config.applicationRolePassword]);
      const errorClass = classifyDatabaseError(safe);
      this.input.logger({
        correlationId,
        operation: "postgres.transaction",
        durationMs: Date.now() - started,
        ok: false,
        errorClass,
        safeMessage: safe,
      });
      throw new Error(safe);
    }
  }
}

function createPgClient(config: RuntimeDatabaseConfig): pg.Client {
  const target = new URL(config.applicationDatabaseUrl);
  return new PgClient({
    host: target.hostname,
    port: Number(target.port || 5432),
    database: target.pathname.replace(/^\/+/, "") || "postgres",
    user: decodeURIComponent(target.username),
    password: config.applicationRolePassword,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: config.queryTimeoutMs || DEFAULT_QUERY_TIMEOUT_MS,
    statement_timeout: config.statementTimeoutMs || DEFAULT_STATEMENT_TIMEOUT_MS,
    query_timeout: config.queryTimeoutMs || DEFAULT_QUERY_TIMEOUT_MS,
  });
}

function statementTimeoutValue(timeoutMs?: number): string {
  const value = Number.isFinite(timeoutMs) && Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_STATEMENT_TIMEOUT_MS;
  return `${Math.trunc(value)}ms`;
}

async function runPgQuery<T>(client: pg.Client, sql: string, params: unknown[], returnsRows: boolean, timeoutMs?: number): Promise<QueryResult<T>> {
  const normalizedSql = sql.trim().replace(/;+\s*$/, "");
  const statement = returnsRows ? wrapSqlForJsonRows(normalizedSql) : normalizedSql;
  const result: PgQueryResult = await withDatabaseTimeout(
    client.query(statement, params),
    timeoutMs || DEFAULT_QUERY_TIMEOUT_MS,
    client
  );
  if (!returnsRows) return { rows: [], rowCount: result.rowCount ?? 0 };
  const jsonRows = result.rows[0]?.coalesce;
  const rows = Array.isArray(jsonRows) ? (jsonRows as T[]) : [];
  return { rows, rowCount: rows.length };
}

async function withDatabaseTimeout<T>(operation: Promise<T>, timeoutMs: number, client: pg.Client): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          void safeEnd(client);
          reject(new Error("PostgreSQL runtime operation timed out."));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function safeRollback(client: pg.Client): Promise<void> {
  try {
    await client.query("rollback");
  } catch {
    // Preserve the original operation failure.
  }
}

async function safeEnd(client: pg.Client | null): Promise<void> {
  try {
    await client?.end();
  } catch {
    // Connection cleanup failures are logged by the original operation path.
  }
}
