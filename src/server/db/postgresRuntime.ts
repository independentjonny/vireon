import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
  if (text.includes("connection") || text.includes("authentication failed") || text.includes("could not translate host") || text.includes("enoent") || text.includes("spawn")) return "CONNECTION";
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

function minimalPsqlEnvironment(password: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV || "production" };
  for (const key of ["SystemRoot", "WINDIR", "PATH", "Path", "TEMP", "TMP"]) {
    if (process.env[key] && !env[key]) env[key] = process.env[key];
  }
  env.PGPASSWORD = password;
  env.PGSSLMODE = "require";
  env.PGCONNECT_TIMEOUT = "10";
  return env;
}

export class PsqlRuntimeClient implements PostgresPilotClient {
  private readonly config: RuntimeDatabaseConfig;
  private readonly target: ParsedPostgresTarget;
  private readonly username: string;
  private readonly psqlExecutable: string;
  private readonly logger: (entry: DatabaseOperationLog) => void;

  constructor(input: RuntimeDatabaseConfig & { psqlExecutable?: string; logger?: (entry: DatabaseOperationLog) => void }) {
    const validation = validateRuntimeDatabaseConfig(input);
    if (!validation.ok || !validation.target || !validation.username) {
      throw new Error(`Invalid runtime PostgreSQL configuration: ${validation.blocked.join("; ")}`);
    }
    this.config = input;
    this.target = validation.target;
    this.username = validation.username;
    this.psqlExecutable = resolvePsqlExecutable({ explicit: input.psqlExecutable });
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
      target: this.target,
      username: this.username,
      psqlExecutable: this.psqlExecutable,
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
      session.close();
    }
  }

  private async queryJsonRows<T>(sql: string, params: unknown[]): Promise<T[]> {
    const correlationId = this.config.correlationId || randomUUID();
    const started = Date.now();
    const boundSql = bindSqlParameters(sql, params);
    const returnsRows = queryCanReturnRows(boundSql);
    const statementSql = returnsRows ? wrapSqlForJsonRows(boundSql) : `${boundSql.trim().replace(/;+\s*$/, "")};`;
    const script = [
      "begin;",
      `set local statement_timeout = ${quoteLiteral(this.config.statementTimeoutMs || DEFAULT_STATEMENT_TIMEOUT_MS)};`,
      statementSql,
      "commit;",
    ].join("\n");
    const args = [
      "-X",
      "-w",
      "-h",
      this.target.hostname || "",
      "-p",
      String(this.target.port || 5432),
      "-U",
      this.username,
      "-d",
      this.target.database || "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-q",
    ];

    return new Promise<T[]>((resolve, reject) => {
      const child: ChildProcessWithoutNullStreams = spawn(this.psqlExecutable, args, {
        env: minimalPsqlEnvironment(this.config.applicationRolePassword),
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const timeout = setTimeout(() => {
        child.kill();
      }, this.config.queryTimeoutMs || DEFAULT_QUERY_TIMEOUT_MS);
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.on("error", (error: Error) => {
        clearTimeout(timeout);
        const errorClass = classifyDatabaseError(error);
        this.logger({ correlationId, operation: "psql.query", durationMs: Date.now() - started, ok: false, errorClass, safeMessage: redactPostgresPilotText(error.message, [this.config.applicationRolePassword]) });
        reject(error);
      });
      child.on("close", (code: number | null) => {
        clearTimeout(timeout);
        if (code !== 0) {
          const safe = redactPostgresPilotText(stderr || `psql exited with ${code}`, [this.config.applicationRolePassword]);
          const error = new Error(safe);
          const errorClass = classifyDatabaseError(safe);
          this.logger({ correlationId, operation: "psql.query", durationMs: Date.now() - started, ok: false, errorClass, safeMessage: safe });
          reject(error);
          return;
        }
        this.logger({ correlationId, operation: "psql.query", durationMs: Date.now() - started, ok: true });
        try {
          const trimmed = stdout.trim();
          resolve(returnsRows && trimmed ? (JSON.parse(trimmed) as T[]) : []);
        } catch (error) {
          reject(error);
        }
      });
      child.stdin.end(`${script}\n`);
    });
  }
}

type TransactionClientInput = {
  config: RuntimeDatabaseConfig;
  target: ParsedPostgresTarget;
  username: string;
  psqlExecutable: string;
  logger: (entry: DatabaseOperationLog) => void;
};

class PsqlTransactionClient implements PostgresPilotClient {
  private readonly input: TransactionClientInput;
  private child: ChildProcessWithoutNullStreams | null = null;
  private stdout = "";
  private stderr = "";
  private closed = false;
  private unusable = false;

  constructor(input: TransactionClientInput) {
    this.input = input;
  }

  async open(): Promise<void> {
    const args = [
      "-X",
      "-w",
      "-h",
      this.input.target.hostname || "",
      "-p",
      String(this.input.target.port || 5432),
      "-U",
      this.input.username,
      "-d",
      this.input.target.database || "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
      "-q",
    ];
    this.child = spawn(this.input.psqlExecutable, args, {
      env: minimalPsqlEnvironment(this.input.config.applicationRolePassword),
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.stdout += chunk;
    });
    this.child.stderr.on("data", (chunk: string) => {
      this.stderr += chunk;
    });
    await this.executeRaw([
      "begin;",
      `set local statement_timeout = ${quoteLiteral(this.input.config.statementTimeoutMs || DEFAULT_STATEMENT_TIMEOUT_MS)};`,
    ].join("\n"));
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const boundSql = bindSqlParameters(sql, params).trim().replace(/;+\s*$/, "");
    if (/^\s*select\s+set_config\(\s*'app\.current_user_id'/i.test(sql)) {
      await this.executeRaw(`${boundSql};`);
      return { rows: [] as T[], rowCount: 0 };
    }
    const returnsRows = queryCanReturnRows(boundSql);
    const output = await this.executeRaw(returnsRows ? wrapSqlForJsonRows(boundSql) : `${boundSql};`);
    const trimmed = output.trim();
    const rows = returnsRows && trimmed ? (JSON.parse(trimmed) as T[]) : [];
    return { rows, rowCount: rows.length };
  }

  async transaction<T>(operation: (client: PostgresPilotClient) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async commit(): Promise<void> {
    await this.executeRaw("commit;");
  }

  async rollback(): Promise<void> {
    if (this.closed || this.unusable) return;
    try {
      await this.executeRaw("rollback;");
    } catch {
      // The original transaction error is more useful than a rollback failure.
    }
  }

  close(): void {
    this.closed = true;
    this.child?.stdin.end();
  }

  private executeRaw(sql: string): Promise<string> {
    const child = this.child;
    if (!child || this.closed || this.unusable) return Promise.reject(new Error("PostgreSQL transaction session is closed."));
    const correlationId = this.input.config.correlationId || randomUUID();
    const marker = randomUUID().replace(/-/g, "");
    const startMarker = `__VIREON_TX_START_${marker}__`;
    const endMarker = `__VIREON_TX_END_${marker}__`;
    const started = Date.now();
    const previousStdoutLength = this.stdout.length;
    const previousStderrLength = this.stderr.length;

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.unusable = true;
        child.kill();
        const safe = redactPostgresPilotText("PostgreSQL transaction query timed out.", [
          this.input.config.applicationRolePassword,
        ]);
        this.input.logger({
          correlationId,
          operation: "psql.transaction",
          durationMs: Date.now() - started,
          ok: false,
          errorClass: "QUERY_TIMEOUT",
          safeMessage: safe,
        });
        cleanup();
        reject(new Error(safe));
      }, this.input.config.queryTimeoutMs || DEFAULT_QUERY_TIMEOUT_MS);

      const finish = () => {
        if (this.closed || this.unusable || settled) return;
        const newStdout = this.stdout.slice(previousStdoutLength);
        const endIndex = newStdout.indexOf(endMarker);
        if (endIndex < 0) return;
        const newStderr = this.stderr.slice(previousStderrLength);
        if (newStderr.trim()) {
          fail(new Error(newStderr));
          return;
        }
        settled = true;
        clearTimeout(timeout);
        const startIndex = newStdout.indexOf(startMarker);
        const contentStart = startIndex >= 0 ? startIndex + startMarker.length : 0;
        const content = newStdout.slice(contentStart, endIndex).trim();
        this.input.logger({ correlationId, operation: "psql.transaction", durationMs: Date.now() - started, ok: true });
        cleanup();
        resolve(content);
      };

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        this.unusable = true;
        clearTimeout(timeout);
        const safe = redactPostgresPilotText(
          this.stderr.slice(previousStderrLength) || error.message,
          [this.input.config.applicationRolePassword]
        );
        const errorClass = classifyDatabaseError(safe);
        this.input.logger({
          correlationId,
          operation: "psql.transaction",
          durationMs: Date.now() - started,
          ok: false,
          errorClass,
          safeMessage: safe,
        });
        cleanup();
        reject(new Error(safe));
      };

      const cleanup = () => {
        child.stdout.off("data", finish);
        child.stderr.off("data", onStderr);
        child.off("error", fail);
        child.off("close", onClose);
      };
      const onStderr = () => undefined;
      const onClose = (code: number | null) => fail(new Error(`psql exited with ${code}`));

      child.stdout.on("data", finish);
      child.stderr.on("data", onStderr);
      child.on("error", fail);
      child.on("close", onClose);
      child.stdin.write(`\\echo ${startMarker}\n${sql}\n\\echo ${endMarker}\n`);
      finish();
    });
  }
}
