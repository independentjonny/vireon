import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import type { DocumentType } from "@/lib/financialVaultTypes";
import { ingestFinancialDocument } from "@/lib/financialDocumentIngestion";
import { createFinancialVaultServiceFromEnv, toFinancialVaultSafeError } from "@/server/services/financialVaultPostgresService";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
const MAX_FINANCIAL_VAULT_UPLOAD_BYTES = 5_000_000;

// Next Request.formData() does not expose a streaming multipart byte limiter in
// route handlers. The application rejects oversized Content-Length values before
// parsing, rejects File.size immediately after parsing, and requires deployment
// ingress/proxy request-body limits at or below this same byte cap.

const allowedTypes: DocumentType[] = [
  "bank_statement",
  "payslip",
  "tax_return",
  "mortgage_statement",
  "super_statement",
];

function correlationId(request: Request) {
  return request.headers.get("x-correlation-id") ?? randomUUID();
}

function idempotencyKey(request: Request) {
  return request.headers.get("idempotency-key") ?? request.headers.get("x-idempotency-key") ?? undefined;
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const session = auth.session;
  try {
    const service = createFinancialVaultServiceFromEnv();
    return Response.json({ ok: true, vault: await service.getVault(session, correlationId(request)) });
  } catch (error) {
    const safe = toFinancialVaultSafeError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const session = auth.session;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FINANCIAL_VAULT_UPLOAD_BYTES) {
    return Response.json({ ok: false, error: "Financial Vault upload is too large." }, { status: 413 });
  }
  const form = await request.formData();
  const file = form.get("file");
  const documentType = form.get("documentType");

  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: "file is required" }, { status: 400 });
  }
  if (typeof documentType !== "string" || !allowedTypes.includes(documentType as DocumentType)) {
    return Response.json({ ok: false, error: "valid documentType is required" }, { status: 400 });
  }
  if (file.size > MAX_FINANCIAL_VAULT_UPLOAD_BYTES) {
    return Response.json({ ok: false, error: "Financial Vault upload is too large." }, { status: 413 });
  }
  const allowedMimeTypes = new Set(["text/csv", "text/plain", "application/pdf"]);
  if (!allowedMimeTypes.has(file.type)) {
    return Response.json({ ok: false, error: "Unsupported Financial Vault upload type." }, { status: 400 });
  }

  try {
    const service = createFinancialVaultServiceFromEnv();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const looksLikePdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    const looksLikeText = bytes.slice(0, Math.min(bytes.length, 512)).every((byte) => byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126));
    if (file.type === "application/pdf" ? !looksLikePdf : !looksLikeText) {
      return Response.json({ ok: false, error: "Upload content does not match the declared type." }, { status: 400 });
    }
    const ingestion = ingestFinancialDocument({
      fileName: file.name,
      mimeType: file.type,
      bytes,
      documentType: documentType as DocumentType,
    });
    const vault = await service.addDocument(
      session,
      { fileName: file.name, documentType: documentType as DocumentType, extractedText: ingestion.extractedText, ingestion, idempotencyKey: idempotencyKey(request) },
      correlationId(request),
    );
    return Response.json({ ok: true, vault, ingestion: { format: ingestion.format, status: ingestion.status, warnings: ingestion.warnings, rowCount: ingestion.rowCount } }, { status: 201 });
  } catch (error) {
    const safe = toFinancialVaultSafeError(error);
    return Response.json({ ok: false, error: safe.message, code: safe.code, retryable: safe.retryable }, { status: safe.status });
  }
}
