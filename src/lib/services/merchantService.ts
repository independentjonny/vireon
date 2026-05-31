import type { TransactionRecord } from "@/lib/persistence/schema";

export interface MerchantVariant {
  canonical: string;
  variants: string[];
}

export interface MerchantConfidence {
  canonical: string;
  confidence: number;
  txCount: number;
  logoPlaceholder: string;
  domainPlaceholder: string;
}

export interface MerchantCleanupEntry {
  original: string;
  canonical: string;
  count: number;
}

export function computeMerchantVariants(txs: TransactionRecord[]): MerchantVariant[] {
  const variantsMap: Record<string, string[]> = {};
  txs.forEach((t) => {
    const canon = t.merchantCanonical || t.merchant || "Unknown";
    if (!variantsMap[canon]) variantsMap[canon] = [];
    const orig = t.merchant || "";
    if (orig && !variantsMap[canon].includes(orig)) variantsMap[canon].push(orig);
  });
  return Object.entries(variantsMap)
    .filter(([, variants]) => variants.length > 1)
    .map(([canonical, variants]) => ({ canonical, variants }))
    .slice(0, 5);
}

export function computeMerchantConfidence(
  txs: TransactionRecord[]
): MerchantConfidence[] {
  const variantsMap: Record<string, string[]> = {};
  const countMap: Record<string, number> = {};
  txs.forEach((t) => {
    const canon = t.merchantCanonical || t.merchant || "Unknown";
    if (!variantsMap[canon]) variantsMap[canon] = [];
    const orig = t.merchant || "";
    if (orig && !variantsMap[canon].includes(orig)) variantsMap[canon].push(orig);
    countMap[canon] = (countMap[canon] || 0) + 1;
  });
  return Object.entries(variantsMap)
    .map(([canonical, variants]) => ({
      canonical,
      confidence:
        variants.length > 1 ? 88 : variants[0] !== canonical ? 92 : 72,
      txCount: countMap[canonical] || 0,
      logoPlaceholder: `https://logo.clearbit.com/${canonical.toLowerCase().replace(/\s+/g, "")}.com`,
      domainPlaceholder: `${canonical.toLowerCase().replace(/\s+/g, "")}.com`,
    }))
    .sort((a, b) => b.txCount - a.txCount)
    .slice(0, 8);
}

export function computeCleanupEntries(txs: TransactionRecord[]): MerchantCleanupEntry[] {
  const seen = new Set<string>();
  const entries: MerchantCleanupEntry[] = [];
  txs.forEach((t) => {
    const orig = t.merchant || "";
    const canon = (t.merchantCanonical as string | undefined) || "";
    if (orig && canon && orig !== canon) {
      if (!seen.has(orig)) {
        seen.add(orig);
        entries.push({ original: orig, canonical: canon, count: 1 });
      } else {
        const existing = entries.find((e) => e.original === orig);
        if (existing) existing.count++;
      }
    }
  });
  return entries.sort((a, b) => b.count - a.count);
}

export function canonicalMerchantScore(canonical: string, variants: string[]): number {
  if (variants.length === 0) return 60;
  if (variants.length === 1 && variants[0] === canonical) return 72;
  if (variants.length === 1) return 88;
  return Math.min(99, 88 + variants.length * 2);
}
