import type { Session } from "@/lib/auth/middleware";
import { FINANCIAL_DATA_RESET_CONFIRMATION, type FinancialDataResetResult } from "@/lib/financialDataReset";
import type { PostgresPilotClient } from "@/lib/postgresPilotPersistence";
import { classifyDatabaseError, createRuntimeDatabaseConfigFromEnv, PsqlRuntimeClient } from "@/server/db/postgresRuntime";
import { uuidFromTrustedUserId } from "@/server/services/financialVaultPostgresService";

if (typeof window !== "undefined") throw new Error("Financial-data reset PostgreSQL service is server-only.");

export class FinancialDataResetError extends Error {
  public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "PREVIEW_ONLY" | "CONFIRMATION_REQUIRED" | "DATABASE_UNAVAILABLE" | "MIGRATION_REQUIRED" | "RESET_FAILED";
  public readonly status: number;
  public readonly retryable: boolean;

  constructor(code: FinancialDataResetError["code"], message: string, status: number, retryable = false) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function financialDataResetEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.VERCEL_ENV === "preview" || env.VIREON_ENVIRONMENT === "preview";
}

function authenticatedUserId(session: Session): string {
  if (!session.userId) throw new FinancialDataResetError("UNAUTHENTICATED", "Sign in is required.", 401);
  return uuidFromTrustedUserId(session.userId);
}

export function toFinancialDataResetSafeError(error: unknown): FinancialDataResetError {
  if (error instanceof FinancialDataResetError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/reset_current_user_financial_data.*does not exist|undefined function|42883/i.test(message)) {
    return new FinancialDataResetError("MIGRATION_REQUIRED", "The Preview financial-data reset migration is not installed.", 503, false);
  }
  if (/financial_data_reset_confirmation_required|confirmation/i.test(message)) {
    return new FinancialDataResetError("CONFIRMATION_REQUIRED", `Type ${FINANCIAL_DATA_RESET_CONFIRMATION} exactly to continue.`, 422, false);
  }
  const kind = classifyDatabaseError(error);
  if (kind === "CONNECTION" || kind === "QUERY_TIMEOUT") {
    return new FinancialDataResetError("DATABASE_UNAVAILABLE", "The Preview database is unavailable. No data was deleted.", 503, true);
  }
  return new FinancialDataResetError("RESET_FAILED", "Financial data could not be reset. The transaction was rolled back.", 422, false);
}

export function createFinancialDataResetServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return createFinancialDataResetPostgresService(new PsqlRuntimeClient(createRuntimeDatabaseConfigFromEnv(env)), env);
}

export function createFinancialDataResetPostgresService(client: PostgresPilotClient, env: NodeJS.ProcessEnv) {
  return {
    toSafeError: toFinancialDataResetSafeError,
    async reset(session: Session, confirmation: string): Promise<FinancialDataResetResult> {
      if (!financialDataResetEnabled(env)) {
        throw new FinancialDataResetError("PREVIEW_ONLY", "Financial-data reset is available only in Preview.", 403);
      }
      if (session.role !== "owner") {
        throw new FinancialDataResetError("FORBIDDEN", "Only the Vireon account owner can delete financial data.", 403);
      }
      if (confirmation !== FINANCIAL_DATA_RESET_CONFIRMATION) {
        throw new FinancialDataResetError("CONFIRMATION_REQUIRED", `Type ${FINANCIAL_DATA_RESET_CONFIRMATION} exactly to continue.`, 422);
      }

      try {
        return await client.transaction(async (tx) => {
          const userId = authenticatedUserId(session);
          await tx.query("select set_config('app.current_user_id', $1, true)", [userId]);
          const result = await tx.query<{ reset: FinancialDataResetResult }>(
            `select public.reset_current_user_financial_data($1) as reset`,
            [confirmation],
          );
          if (!result.rows[0]?.reset) throw new Error("FINANCIAL_DATA_RESET_RESULT_MISSING");
          return result.rows[0].reset;
        });
      } catch (error) {
        throw toFinancialDataResetSafeError(error);
      }
    },
  };
}
