import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import { createFinancialVaultServiceFromEnv, toFinancialVaultSafeError } from "@/server/services/financialVaultPostgresService";
import { ingestFinancialDocument } from "@/lib/financialDocumentIngestion";
import { setupCategories, suggestSetupEntries, type SetupDraft } from "@/lib/financialSetup";
import { createHash, randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  try { return Response.json({ ok: true, ...await createFinancialVaultServiceFromEnv().getSetup(auth.session) }); }
  catch (error) { const safe = toFinancialVaultSafeError(error); return Response.json({ ok: false, error: safe.message }, { status: safe.status }); }
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  if (Number(request.headers.get("content-length")) > 4_000_000) return Response.json({ error: "Choose a file smaller than 4 MB." }, { status: 413 });
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData(), file = form.get("file");
      if (!(file instanceof File) || file.size === 0 || file.size > 3_900_000) return Response.json({ error: "Choose a non-empty PDF, CSV or text file smaller than 3.9 MB." }, { status: 422 });
      if (!/\.(pdf|csv|txt)$/i.test(file.name)) return Response.json({ error: "Use a PDF, CSV or text file. Photos are not supported yet." }, { status: 422 });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const isCsv = /\.csv$/i.test(file.name);
      const ingestion = ingestFinancialDocument({ fileName: file.name, mimeType: /\.pdf$/i.test(file.name) ? "application/pdf" : isCsv ? "text/csv" : "text/plain", bytes, documentType: "bank_statement" });
      // CSV row ordering and transfers are ambiguous. Never infer a current balance or recurring cash flow from transaction totals.
      const entries = isCsv ? [] : suggestSetupEntries(ingestion.extractedText, file.name);
      const warnings = [...ingestion.warnings];
      if (isCsv) warnings.push("This CSV was read, but transaction totals are not a current balance or monthly income. Add the statement closing balance manually. Transaction-history import remains available in Document Vault.");
      if (!entries.length && !isCsv) warnings.push("No supported labelled amounts were found. Enter the values from your document manually, or try a text-based PDF.");
      if (entries.length) warnings.push("Suggested amounts need your review. Confirm the account name, statement date, ownership and any payment frequency.");
      return Response.json({ ok: true, entries, file: { id: randomUUID(), name: file.name.slice(0,180), hash: createHash("sha256").update(bytes).digest("hex"), warnings, extracted: entries.length } });
    }
    const raw = await request.text();
    if (raw.length > 250_000) return Response.json({ error: "This draft is too large. Confirm a smaller set of changes." }, { status: 413 });
    const body = JSON.parse(raw), draft = body.draft as SetupDraft;
    if (!["save", "confirm"].includes(body.action) || !draft || !/^[0-9a-f-]{36}$/i.test(draft.id) || !Number.isInteger(draft.revision) || draft.revision < 0 || !Array.isArray(draft.entries) || draft.entries.length > 50 || !Array.isArray(draft.files) || draft.files.length > 20) throw new Error("Invalid draft. Use up to 20 files and 50 items.");
    for (const entry of draft.entries) {
      if (!entry || !Object.hasOwn(setupCategories, entry.category) || ["id", "label", "amount", "frequency", "asOfDate", "ownership", "source", "snippet", "replaceId", "replaceUpdatedAt"].some(key => typeof entry[key as keyof typeof entry] !== "string" || String(entry[key as keyof typeof entry]).length > 500) || typeof entry.included !== "boolean") throw new Error("Check the financial information and try again.");
    }
    for (const file of draft.files) if (!file || typeof file.name !== "string" || typeof file.hash !== "string" || !Array.isArray(file.warnings) || file.warnings.some(w => typeof w !== "string")) throw new Error("Invalid file details.");
    const clean: SetupDraft = { id: draft.id, revision: draft.revision, status: "draft", entries: draft.entries, files: draft.files, updatedAt: "" };
    return Response.json({ ok: true, draft: await createFinancialVaultServiceFromEnv().saveSetup(auth.session, clean, body.action === "confirm") });
  } catch (error) {
    const safe = toFinancialVaultSafeError(error);
    return Response.json({ ok: false, error: safe.message }, { status: safe.status });
  }
}
