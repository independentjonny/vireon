import assert from "node:assert/strict";
import test from "node:test";
import {
  ingestFinancialDocument,
  MAX_FINANCIAL_DOCUMENT_BYTES,
  MAX_FINANCIAL_DOCUMENT_CSV_ROWS,
  MAX_FINANCIAL_DOCUMENT_TEXT_CHARS,
} from "../../src/lib/financialDocumentIngestion.ts";
import { analyzeDocumentText } from "../../src/lib/financialVaultEngine.ts";

const bytes = (value: string) => new TextEncoder().encode(value);

test("structured bank CSV handles quoted fields and produces Vault-ready totals", () => {
  const result = ingestFinancialDocument({
    fileName: "statement.csv",
    mimeType: "text/csv",
    documentType: "bank_statement",
    bytes: bytes('date,description,amount,balance\n2026-07-01,"Salary, employer",5000,7000\n2026-07-02,"Rent",-1800,5200\n'),
  });
  assert.equal(result.format, "csv");
  assert.equal(result.rowCount, 2);
  assert.match(result.extractedText, /Monthly spending: \$1800\.00/);
  assert.match(result.extractedText, /Account balance: \$5200\.00/);
});

test("malformed and financially irrelevant CSV files fail safely", () => {
  assert.throws(() => ingestFinancialDocument({ fileName: "bad.csv", mimeType: "text/csv", documentType: "bank_statement", bytes: bytes("name,note\nA,hello") }), /amount, debit\/credit, or balance/);
  assert.throws(() => ingestFinancialDocument({ fileName: "duplicate.csv", mimeType: "text/csv", documentType: "bank_statement", bytes: bytes("amount,amount\n1,2") }), /duplicate column/);
});

test("text-layer PDF extraction feeds payslip analysis", () => {
  const pdf = "%PDF-1.4\n1 0 obj <<>> stream\nBT (Payslip. Employer: Northstar Pty Ltd. Annual salary: $145,000.) Tj ET\nendstream endobj\n%%EOF";
  const result = ingestFinancialDocument({ fileName: "payslip.pdf", mimeType: "application/pdf", documentType: "payslip", bytes: bytes(pdf) });
  const analysis = analyzeDocumentText("payslip.pdf", "payslip", result.extractedText);
  assert.equal(result.status, "extracted");
  assert.equal(analysis.values.incomeAnnual, 145000);
  assert.equal(analysis.values.employerName, "Northstar Pty Ltd. Annual salary");
});

test("scanned PDF is retained for review rather than reported as extracted", () => {
  const result = ingestFinancialDocument({ fileName: "tax-return.pdf", mimeType: "application/pdf", documentType: "tax_return", bytes: bytes("%PDF-1.4\n/image-only\n%%EOF") });
  assert.equal(result.status, "needs_review");
  assert.match(result.warnings[0], /OCR or manual review/);
});

test("encrypted, spoofed, unsupported, empty and oversized files are rejected", () => {
  assert.throws(() => ingestFinancialDocument({ fileName: "tax.pdf", mimeType: "application/pdf", documentType: "tax_return", bytes: bytes("not a pdf") }), /signature/);
  assert.throws(() => ingestFinancialDocument({ fileName: "tax.pdf", mimeType: "application/pdf", documentType: "tax_return", bytes: bytes("%PDF-1.4 /Encrypt") }), /Password-protected/);
  assert.throws(() => ingestFinancialDocument({ fileName: "photo.jpg", mimeType: "image/jpeg", documentType: "payslip", bytes: bytes("image") }), /Supported formats/);
  assert.throws(() => ingestFinancialDocument({ fileName: "empty.txt", mimeType: "text/plain", documentType: "payslip", bytes: new Uint8Array() }), /empty/);
  assert.throws(() => ingestFinancialDocument({ fileName: "large.txt", mimeType: "text/plain", documentType: "payslip", bytes: new Uint8Array(MAX_FINANCIAL_DOCUMENT_BYTES + 1) }), /10 MB/);
});

test("parser complexity limits reject oversized text, row counts and cells", () => {
  assert.throws(
    () => ingestFinancialDocument({ fileName: "huge.txt", mimeType: "text/plain", documentType: "payslip", bytes: bytes("a".repeat(MAX_FINANCIAL_DOCUMENT_TEXT_CHARS + 1)) }),
    /text exceeds supported limits/
  );
  assert.throws(
    () => ingestFinancialDocument({
      fileName: "rows.csv",
      mimeType: "text/csv",
      documentType: "bank_statement",
      bytes: bytes(`amount\n${Array.from({ length: MAX_FINANCIAL_DOCUMENT_CSV_ROWS + 1 }, () => "1").join("\n")}`),
    }),
    /too many rows/
  );
  assert.throws(
    () => ingestFinancialDocument({ fileName: "cell.csv", mimeType: "text/csv", documentType: "bank_statement", bytes: bytes(`amount,note\n1,${"x".repeat(2_001)}`) }),
    /cell exceeds supported limits/
  );
});
