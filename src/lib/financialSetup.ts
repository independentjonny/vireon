import type { CanonicalFinancialRecord } from "./manualFinancialDataPlatform";

export const setupCategories = {
  bank: { label: "Bank & savings", kind: "account", subtype: "cash" },
  income: { label: "Income after tax", kind: "income", subtype: "employment" },
  expenses: { label: "Living expenses", kind: "expense", subtype: "living-expense" },
  loans: { label: "Loans & credit", kind: "liability", subtype: "loan" },
  property: { label: "Property", kind: "asset", subtype: "property" },
  investments: { label: "Investments", kind: "asset", subtype: "investment" },
  super: { label: "Superannuation", kind: "asset", subtype: "superannuation" },
} as const;
export type SetupCategory = keyof typeof setupCategories;
export type SetupEntry = {
  id: string; category: SetupCategory; label: string; amount: string; frequency: string;
  asOfDate: string; ownership: string; source: string; snippet: string;
  replaceId: string; replaceUpdatedAt: string; included: boolean;
};
export type SetupFile = { id: string; name: string; hash: string; warnings: string[]; extracted: number };
export type SetupDraft = { id: string; revision: number; status: "draft" | "confirmed"; entries: SetupEntry[]; files: SetupFile[]; updatedAt: string; confirmedCount?: number };

export function validateSetupEntries(entries: SetupEntry[]) {
  if (!entries.some(e => e.included)) throw new Error("Add at least one item to confirm.");
  const identities = new Set<string>(), replacements = new Set<string>();
  for (const entry of entries.filter(e => e.included)) {
    if (!Object.hasOwn(setupCategories, entry.category)) throw new Error("Choose a valid information type.");
    if (!entry.label.trim()) throw new Error("Give each item an account or descriptive name.");
    if (!entry.amount.trim() || !Number.isFinite(Number(entry.amount)) || Number(entry.amount) < 0 || Number(entry.amount) > 1e12) throw new Error(`Enter a valid non-negative amount for ${entry.label}.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.asOfDate) || !Number.isFinite(Date.parse(entry.asOfDate)) || new Date(entry.asOfDate).toISOString().slice(0,10) !== entry.asOfDate || entry.asOfDate > new Date().toISOString().slice(0,10)) throw new Error(`Enter a valid date, no later than today, for ${entry.label}.`);
    if (!["Sole", "My share of joint"].includes(entry.ownership)) throw new Error(`Confirm whose amount this is for ${entry.label}.`);
    if (["income", "expenses"].includes(entry.category) && !["weekly", "fortnightly", "monthly", "annual"].includes(entry.frequency)) throw new Error(`Choose the payment frequency for ${entry.label}.`);
    const identity = `${entry.category}:${entry.label.trim().toLowerCase()}`;
    if (identities.has(identity) || (entry.replaceId && replacements.has(entry.replaceId))) throw new Error("Two items appear to update the same information. Remove the duplicate before confirming.");
    identities.add(identity); if (entry.replaceId) replacements.add(entry.replaceId);
  }
}

export function setupRecordValue(entry: SetupEntry) {
  return { ...(["income", "expenses"].includes(entry.category) ? { amount: Number(entry.amount), frequency: entry.frequency } : entry.category === "property" ? { marketValue: Number(entry.amount) } : { balance: Number(entry.amount) }),
    asOfDate: entry.asOfDate, ownership: entry.ownership, currency: "AUD", setupCategory: entry.category,
    ...(entry.category === "income" ? { incomeBasis: "net" } : {}), sourceName: entry.source };
}

export function categoryForRecord(record: CanonicalFinancialRecord): SetupCategory | null {
  if (record.value.setupCategory && String(record.value.setupCategory) in setupCategories) return record.value.setupCategory as SetupCategory;
  if (record.kind === "income") return "income";
  if (record.kind === "expense") return "expenses";
  if (record.kind === "liability") return "loans";
  if (/super/i.test(record.subtype)) return "super";
  if (/property/i.test(record.subtype)) return "property";
  if (/investment|shares|etf/i.test(record.subtype)) return "investments";
  if (record.kind === "account") return "bank";
  return null;
}

// Propose only explicit labelled amounts. Never turn transaction totals into recurring income.
export function suggestSetupEntries(text: string, fileName: string): SetupEntry[] {
  const patterns: Array<[SetupCategory, RegExp]> = [
    ["bank", /(?:closing|account|available) balance\s*[:\-]?\s*\$?([\d,]+\.\d{2})/i],
    ["super", /(?:super(?:annuation)? balance|total super balance)\s*[:\-]?\s*\$?([\d,]+\.\d{2})/i],
    ["loans", /(?:loan balance|mortgage balance|amount owing)\s*[:\-]?\s*\$?([\d,]+\.\d{2})/i],
    ["income", /(?:net pay|take.home pay)\s*[:\-]?\s*\$?([\d,]+\.\d{2})/i],
  ];
  return patterns.flatMap(([category, pattern]) => {
    const match = text.match(pattern);
    if (!match) return [];
    return [{ id: crypto.randomUUID(), category, label: "", amount: match[1].replaceAll(",", ""), frequency: "", asOfDate: "", ownership: "", source: fileName, snippet: match[0], replaceId: "", replaceUpdatedAt: "", included: true }];
  });
}
