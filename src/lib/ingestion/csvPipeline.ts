import { canonicalizeMerchant } from "./merchantCanonicalizer.ts";
import { categorizeTransaction } from "./categorizer.ts";
import { detectRecurring } from "./recurringDetector.ts";
import { detectDuplicates } from "./duplicateDetector.ts";
import { scoreIngestionHealth } from "./healthScorer.ts";

export type RawCSVRow = {
  date?: string;
  description?: string;
  merchant?: string;
  amount?: string | number;
  debit?: string | number;
  credit?: string | number;
  category?: string;
  reference?: string;
  [key: string]: string | number | undefined;
};

export type NormalizedTransaction = {
  id: string;
  rawDescription: string;
  merchant: string;
  merchantCanonical: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  subCategory: string;
  recurring: boolean;
  recurringCadence: string | null;
  duplicate: boolean;
  confidence: number;
  source: "csv";
};

export type IngestionResult = {
  ok: boolean;
  totalRows: number;
  processedRows: number;
  skippedRows: number;
  transactions: NormalizedTransaction[];
  duplicateCount: number;
  recurringCount: number;
  healthScore: number;
  errors: string[];
  processedAt: string;
};

function parseAmount(row: RawCSVRow): number {
  if (row.amount !== undefined) return Number(row.amount);
  if (row.debit !== undefined && row.credit !== undefined) {
    const debit = Number(row.debit) || 0;
    const credit = Number(row.credit) || 0;
    return credit - debit;
  }
  if (row.debit !== undefined) return -Math.abs(Number(row.debit));
  if (row.credit !== undefined) return Math.abs(Number(row.credit));
  return 0;
}

function parseDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function ingestCSV(rows: RawCSVRow[]): IngestionResult {
  const errors: string[] = [];
  const normalized: NormalizedTransaction[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];
      const rawDescription = String(row.description || row.merchant || "");
      const amount = parseAmount(row);
      const date = parseDate(row.date);
      const merchant = rawDescription;
      const merchantCanonical = canonicalizeMerchant(merchant);
      const { category, subCategory, confidence } = categorizeTransaction(merchantCanonical, amount);

      normalized.push({
        id: `csv-${Date.now()}-${i}`,
        rawDescription,
        merchant,
        merchantCanonical,
        amount,
        currency: "AUD",
        date,
        category,
        subCategory,
        recurring: false,
        recurringCadence: null,
        duplicate: false,
        confidence,
        source: "csv",
      });
    } catch (err) {
      errors.push(`Row ${i}: ${String(err)}`);
    }
  }

  const withRecurring = detectRecurring(normalized);
  const withDuplicates = detectDuplicates(withRecurring);
  const healthScore = scoreIngestionHealth(withDuplicates, errors);

  return {
    ok: errors.length === 0,
    totalRows: rows.length,
    processedRows: withDuplicates.length,
    skippedRows: rows.length - withDuplicates.length,
    transactions: withDuplicates,
    duplicateCount: withDuplicates.filter((t) => t.duplicate).length,
    recurringCount: withDuplicates.filter((t) => t.recurring).length,
    healthScore,
    errors,
    processedAt: new Date().toISOString(),
  };
}
