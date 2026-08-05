import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";
import { ingestCSV, type RawCSVRow } from "@/lib/ingestion/csvPipeline";
import { getIngestionHealthReport } from "@/lib/ingestion/healthScorer";
import { createTransactionsSubscriptionsServiceFromEnv, toSafeTransactionsError } from "@/server/services/transactionsSubscriptionsPostgresService";

const MAX_BODY_BYTES = 1_000_000;
const MAX_ROWS = 5_000;
const MAX_FIELD_LENGTH = 512;
const SUPPORTED_CURRENCIES = new Set(["AUD", "USD", "NZD", "GBP", "EUR"]);

function validateRows(rows: RawCSVRow[]): string | null {
  if (rows.length === 0) return "No rows provided - send { rows: RawCSVRow[] }";
  if (rows.length > MAX_ROWS) return `Too many rows. Maximum is ${MAX_ROWS}.`;

  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return `Row ${index} is invalid.`;
    const keys = Object.keys(row);
    if (keys.length > 32) return `Row ${index} has too many fields.`;
    for (const [key, value] of Object.entries(row)) {
      if (key.length > 64) return `Row ${index} has an invalid field name.`;
      if (typeof value !== "string" && typeof value !== "number" && value !== undefined) {
        return `Row ${index} has an unsupported value type.`;
      }
      if (typeof value === "string" && value.length > MAX_FIELD_LENGTH) {
        return `Row ${index} has a field that is too long.`;
      }
    }
    const amount = row.amount ?? row.debit ?? row.credit;
    if (amount !== undefined && !Number.isFinite(Number(amount))) return `Row ${index} has an invalid amount.`;
    if (Math.abs(Number(amount ?? 0)) > 100_000_000) return `Row ${index} amount is outside supported limits.`;
    if (row.date && Number.isNaN(new Date(String(row.date)).getTime())) return `Row ${index} has an invalid date.`;
    const currency = "currency" in row ? String(row.currency ?? "AUD") : "AUD";
    if (!SUPPORTED_CURRENCIES.has(currency.toUpperCase())) return `Row ${index} has an unsupported currency.`;
  }
  return null;
}

export async function POST(req: Request) {
  const auth = await requirePermission(req, "write:transactions");
  if (!auth.ok) return authErrorResponse(auth);
  const session = auth.session;

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "Ingestion request is too large." }, { status: 413 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rows: RawCSVRow[] = Array.isArray(body.rows) ? (body.rows as RawCSVRow[]) : [];
  const mode: "dryRun" | "persist" = body.mode === "persist" ? "persist" : "dryRun";
  const forgedOwnership =
    (typeof body.workspaceId === "string" && body.workspaceId !== session.workspaceId) ||
    (typeof body.userId === "string" && body.userId !== session.userId);

  if (forgedOwnership) {
    return Response.json(
      { ok: false, error: "Client-supplied ownership does not match the authenticated session." },
      { status: 403 }
    );
  }

  const rowError = validateRows(rows);
  if (rowError) return Response.json({ ok: false, error: rowError }, { status: 400 });

  const result = ingestCSV(rows);
  const healthReport = getIngestionHealthReport(result.transactions, result.errors);

  let persisted = false;
  let persistedCount = 0;
  const persistWarning: string | null = null;
  let persistMessage = "dryRun mode - pass mode=persist to write to PostgreSQL";
  const storageMode = "postgres";
  let replayed = false;
  let importId: string | null = null;

  if (mode === "persist") {
    try {
      const service = createTransactionsSubscriptionsServiceFromEnv();
      const persistedResult = await service.persistTransactionsFromIngestion(session, {
        transactions: result.transactions,
        ingestion: {
          totalRows: result.totalRows,
          processedRows: result.processedRows,
          duplicateCount: result.duplicateCount,
          recurringCount: result.recurringCount,
          healthScore: result.healthScore,
          errors: result.errors,
          processedAt: result.processedAt,
        },
        idempotencyKey: req.headers.get("idempotency-key"),
        sourceChecksum: null,
      });
      persisted = persistedResult.persisted;
      persistedCount = persistedResult.persistedCount;
      replayed = persistedResult.replayed;
      importId = persistedResult.importId;
      persistMessage = replayed
        ? "PostgreSQL import replayed from idempotency key; no duplicate transactions created."
        : `${persistedCount} transaction(s) persisted to PostgreSQL.`;
    } catch (error) {
      const safe = toSafeTransactionsError(error);
      return Response.json(
        {
          ok: false,
          error: safe.message,
          code: safe.code === "DATABASE_UNAVAILABLE" ? "POSTGRES_UNAVAILABLE" : safe.code,
          retryable: safe.retryable,
        },
        { status: safe.status }
      );
    }
  }

  const recurringCandidates = result.transactions.filter((t) => t.recurring);
  const duplicateCandidates = result.transactions.filter((t) => t.duplicate);

  return Response.json({
    ok: result.ok,
    mode,
    storageMode,
    context: { workspaceId: session.workspaceId, userId: session.userId },
    persisted,
    persistedCount,
    replayed,
    importId,
    persistMessage,
    persistWarning,
    ingestion: {
      totalRows: result.totalRows,
      processedRows: result.processedRows,
      skippedRows: result.skippedRows,
      duplicateCount: result.duplicateCount,
      recurringCount: result.recurringCount,
      healthScore: result.healthScore,
      healthGrade: healthReport.grade,
      issues: healthReport.issues,
      recommendations: healthReport.recommendations,
      processedAt: result.processedAt,
    },
    transactions: result.transactions,
    recurringCandidates,
    duplicateCandidates,
    errors: result.errors,
  });
}
