import type { DocumentType, UploadedDocument } from "./financialVaultTypes.ts";

export const FINANCIAL_DOCUMENT_INGESTION_VERSION = "financial-document-ingestion-v1";
export const MAX_FINANCIAL_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_FINANCIAL_DOCUMENT_TEXT_CHARS = 100_000;
export const MAX_FINANCIAL_DOCUMENT_CSV_ROWS = 5_000;
export const MAX_FINANCIAL_DOCUMENT_CSV_COLUMNS = 64;
export const MAX_FINANCIAL_DOCUMENT_CSV_CELL_CHARS = 2_000;
export const MAX_FINANCIAL_DOCUMENT_PDF_TEXT_FRAGMENTS = 10_000;

export type FinancialDocumentFormat = "pdf" | "csv" | "text";

export type FinancialDocumentIngestionResult = {
  format: FinancialDocumentFormat;
  extractedText: string;
  extractionMethod: "pdf-text-layer" | "csv-structured" | "plain-text";
  status: UploadedDocument["status"];
  warnings: string[];
  rowCount: number | null;
};

function extension(fileName: string): string {
  return fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
}

function safeText(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\u0000/g, "").trim();
  if (text.length > MAX_FINANCIAL_DOCUMENT_TEXT_CHARS) throw new Error("Extracted document text exceeds supported limits.");
  return text;
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      if (cell.length > MAX_FINANCIAL_DOCUMENT_CSV_CELL_CHARS) throw new Error("CSV cell exceeds supported limits.");
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[index + 1] === "\n") index++;
      if (cell.length > MAX_FINANCIAL_DOCUMENT_CSV_CELL_CHARS) throw new Error("CSV cell exceeds supported limits.");
      row.push(cell.trim());
      if (row.length > MAX_FINANCIAL_DOCUMENT_CSV_COLUMNS) throw new Error("CSV has too many columns.");
      if (row.some(Boolean)) rows.push(row);
      if (rows.length > MAX_FINANCIAL_DOCUMENT_CSV_ROWS + 1) throw new Error("CSV has too many rows.");
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell.length > MAX_FINANCIAL_DOCUMENT_CSV_CELL_CHARS) throw new Error("CSV cell exceeds supported limits.");
  row.push(cell.trim());
  if (row.length > MAX_FINANCIAL_DOCUMENT_CSV_COLUMNS) throw new Error("CSV has too many columns.");
  if (row.some(Boolean)) rows.push(row);
  if (rows.length > MAX_FINANCIAL_DOCUMENT_CSV_ROWS + 1) throw new Error("CSV has too many rows.");
  return rows;
}

function money(value: string): number | null {
  const normalized = value.replace(/[,$\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function csvToFinancialText(text: string): { text: string; rowCount: number; warnings: string[] } {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error("CSV must contain a header and at least one data row.");
  const headers = rows[0].map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate column names.");
  const find = (...names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const amountIndex = find("amount", "transaction_amount", "value");
  const debitIndex = find("debit", "withdrawal", "money_out");
  const creditIndex = find("credit", "deposit", "money_in");
  const balanceIndex = find("balance", "closing_balance", "account_balance");
  if (amountIndex < 0 && debitIndex < 0 && creditIndex < 0 && balanceIndex < 0) {
    throw new Error("CSV needs an amount, debit/credit, or balance column.");
  }
  let spending = 0;
  let income = 0;
  let closingBalance: number | null = null;
  for (const row of rows.slice(1)) {
    if (row.length > headers.length) throw new Error("CSV row has more values than the header.");
    const amount = amountIndex >= 0 ? money(row[amountIndex] ?? "") : null;
    const debit = debitIndex >= 0 ? money(row[debitIndex] ?? "") : null;
    const credit = creditIndex >= 0 ? money(row[creditIndex] ?? "") : null;
    const balance = balanceIndex >= 0 ? money(row[balanceIndex] ?? "") : null;
    if (debit != null) spending += Math.abs(debit);
    else if (amount != null && amount < 0) spending += Math.abs(amount);
    if (credit != null) income += Math.abs(credit);
    else if (amount != null && amount > 0) income += amount;
    if (balance != null) closingBalance = balance;
  }
  const lines = ["Bank statement CSV.", `Transaction rows: ${rows.length - 1}.`, `Monthly spending: $${spending.toFixed(2)}.`, `Monthly income: $${income.toFixed(2)}.`];
  if (closingBalance != null) lines.push(`Account balance: $${closingBalance.toFixed(2)}.`);
  return { text: lines.join(" "), rowCount: rows.length - 1, warnings: [] };
}

function unescapePdfString(value: string): string {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, code: string) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" }[code] ?? code))
    .replace(/\\[0-7]{1,3}/g, (match) => String.fromCharCode(parseInt(match.slice(1), 8)));
}

function extractPdfText(bytes: Uint8Array): { text: string; warnings: string[] } {
  const binary = new TextDecoder("latin1").decode(bytes);
  if (!binary.startsWith("%PDF-")) throw new Error("The file extension says PDF but the PDF signature is missing.");
  if (/\/Encrypt\b/.test(binary)) throw new Error("Password-protected PDFs are not supported.");
  const fragments: string[] = [];
  for (const stream of binary.matchAll(/BT([\s\S]*?)ET/g)) {
    for (const literal of stream[1].matchAll(/\(((?:\\.|[^\\)])*)\)\s*(?:Tj|'|")/g)) {
      if (fragments.length >= MAX_FINANCIAL_DOCUMENT_PDF_TEXT_FRAGMENTS) throw new Error("PDF text extraction exceeds supported limits.");
      fragments.push(unescapePdfString(literal[1]));
    }
    for (const array of stream[1].matchAll(/\[((?:[^\]]|\\\])*)\]\s*TJ/g)) {
      for (const literal of array[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)) {
        if (fragments.length >= MAX_FINANCIAL_DOCUMENT_PDF_TEXT_FRAGMENTS) throw new Error("PDF text extraction exceeds supported limits.");
        fragments.push(unescapePdfString(literal[1]));
      }
    }
  }
  const text = fragments.join(" ").replace(/\s+/g, " ").trim();
  if (text.length > MAX_FINANCIAL_DOCUMENT_TEXT_CHARS) throw new Error("Extracted document text exceeds supported limits.");
  if (text.length < 20) return { text, warnings: ["No usable PDF text layer was found. OCR or manual review is required."] };
  return { text, warnings: [] };
}

export function ingestFinancialDocument(input: { fileName: string; mimeType: string; bytes: Uint8Array; documentType: DocumentType }): FinancialDocumentIngestionResult {
  if (input.bytes.byteLength === 0) throw new Error("The uploaded document is empty.");
  if (input.bytes.byteLength > MAX_FINANCIAL_DOCUMENT_BYTES) throw new Error("Financial documents must be 10 MB or smaller.");
  const ext = extension(input.fileName);
  if (ext === ".csv" || input.mimeType === "text/csv") {
    const result = csvToFinancialText(safeText(input.bytes));
    return { format: "csv", extractedText: result.text, extractionMethod: "csv-structured", status: "extracted", warnings: result.warnings, rowCount: result.rowCount };
  }
  if (ext === ".pdf" || input.mimeType === "application/pdf") {
    const result = extractPdfText(input.bytes);
    return { format: "pdf", extractedText: result.text, extractionMethod: "pdf-text-layer", status: result.warnings.length ? "needs_review" : "extracted", warnings: result.warnings, rowCount: null };
  }
  if ([".txt", ".text"].includes(ext) || input.mimeType.startsWith("text/")) {
    const text = safeText(input.bytes);
    if (text.length < 20) throw new Error("The document does not contain enough text to extract financial facts.");
    return { format: "text", extractedText: text, extractionMethod: "plain-text", status: "extracted", warnings: [], rowCount: null };
  }
  throw new Error("Supported formats are PDF, CSV, and plain text.");
}
