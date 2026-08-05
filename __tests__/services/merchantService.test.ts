import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeMerchantVariants,
  computeMerchantConfidence,
} from "../../src/lib/services/merchantService.ts";
import type { TransactionRecord } from "../../src/lib/persistence/schema.ts";

function tx(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    id: "t1",
    workspaceId: "ws1",
    userId: "u1",
    date: "2025-01-15",
    amount: -50,
    merchant: "WOOLWORTHS 123",
    merchantCanonical: "Woolworths",
    currency: "AUD",
    category: "Groceries",
    subCategory: "General",
    recurring: false,
    recurringCadence: null,
    duplicate: false,
    confidence: 1,
    rawDescription: "purchase",
    source: "csv",
    createdAt: "2025-01-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeMerchantVariants", () => {
  it("returns empty array for empty input", () => {
    assert.deepEqual(computeMerchantVariants([]), []);
  });

  it("groups variants under canonical merchant", () => {
    const txs = [
      tx({ merchant: "WOOLWORTHS BONDI", merchantCanonical: "Woolworths" }),
      tx({ merchant: "WOOLWORTHS CITY", merchantCanonical: "Woolworths" }),
      tx({ merchant: "Netflix.com", merchantCanonical: "Netflix" }),
    ];
    const result = computeMerchantVariants(txs);
    const woolies = result.find((r) => r.canonical === "Woolworths");
    assert.ok(woolies);
    assert.ok(woolies.variants.length >= 2);
  });

  it("excludes merchants with only one variant", () => {
    const txs = [
      tx({ merchant: "Netflix", merchantCanonical: "Netflix" }),
      tx({ merchant: "Spotify", merchantCanonical: "Spotify" }),
    ];
    const result = computeMerchantVariants(txs);
    assert.equal(result.length, 0);
  });

  it("does not duplicate variants", () => {
    const txs = [
      tx({ merchant: "WOOLWORTHS BONDI", merchantCanonical: "Woolworths" }),
      tx({ merchant: "WOOLWORTHS BONDI", merchantCanonical: "Woolworths" }),
    ];
    const result = computeMerchantVariants(txs);
    assert.equal(result.length, 0);
  });
});

describe("computeMerchantConfidence", () => {
  it("returns empty array for empty input", () => {
    assert.deepEqual(computeMerchantConfidence([]), []);
  });

  it("assigns higher confidence for multi-variant merchants", () => {
    const txs = [
      tx({ merchant: "WOOLWORTHS BONDI", merchantCanonical: "Woolworths" }),
      tx({ merchant: "WOOLWORTHS CITY", merchantCanonical: "Woolworths" }),
    ];
    const result = computeMerchantConfidence(txs);
    const woolies = result.find((r) => r.canonical === "Woolworths");
    assert.ok(woolies);
    assert.ok(woolies.confidence >= 80);
  });
});
