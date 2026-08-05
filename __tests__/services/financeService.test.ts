import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeFinanceSummary,
  computeCategoryMap,
  computeMerchantMap,
  computeMonthSummaries,
  computeCashflowForecast,
  generateInsights,
} from "../../src/lib/services/financeService.ts";
import type { TransactionRecord, SubscriptionRecord } from "../../src/lib/persistence/schema.ts";

function tx(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return {
    id: "t1",
    workspaceId: "ws1",
    userId: "u1",
    date: "2025-01-15",
    amount: -50,
    merchant: "Test",
    merchantCanonical: "Test",
    currency: "AUD",
    category: "Other",
    subCategory: "General",
    recurring: false,
    recurringCadence: null,
    duplicate: false,
    confidence: 1,
    rawDescription: "Test txn",
    source: "csv",
    createdAt: "2025-01-15T00:00:00.000Z",
    ...overrides,
  };
}

function sub(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    id: "s1",
    workspaceId: "ws1",
    transactionId: "t1",
    merchant: "Netflix",
    merchantCanonical: "Netflix",
    amount: 24,
    cadence: "monthly",
    nextRenewalDate: "2025-02-15",
    cancellationScore: 0,
    pricingAnomalyScore: 0,
    savingsOpportunity: 0,
    active: true,
    createdAt: "2025-01-15T00:00:00.000Z",
    updatedAt: "2025-01-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeFinanceSummary", () => {
  it("returns zeros on empty input", () => {
    const result = computeFinanceSummary([], []);
    assert.equal(result.income, 0);
    assert.equal(result.spend, 0);
    assert.equal(result.net, 0);
    assert.equal(result.subsMonthly, 0);
    assert.equal(result.healthLabel, "Stable");
  });

  it("computes income/spend/net correctly", () => {
    const txs = [
      tx({ amount: 5000 }),
      tx({ amount: -1000 }),
      tx({ amount: -500 }),
    ];
    const result = computeFinanceSummary(txs, []);
    assert.equal(result.income, 5000);
    assert.equal(result.spend, 1500);
    assert.equal(result.net, 3500);
  });

  it("computes savings rate correctly", () => {
    const txs = [tx({ amount: 1000 }), tx({ amount: -700 })];
    const result = computeFinanceSummary(txs, []);
    assert.ok(result.savingsRate > 0);
    assert.ok(result.savingsRate <= 100);
  });

  it("applies health score adjustments for high savings rate", () => {
    const txs = [tx({ amount: 10000 }), tx({ amount: -3000 })];
    const result = computeFinanceSummary(txs, []);
    assert.ok(result.healthScore >= 84);
  });

  it("returns Needs Attention for negative net with data", () => {
    const txs = [tx({ amount: -5000 }), tx({ amount: -5000 }), tx({ amount: 100 })];
    const manyTxs = Array.from({ length: 5 }, () => tx({ amount: -200 }));
    const result = computeFinanceSummary([...txs, ...manyTxs], []);
    assert.ok(result.healthScore < 100);
  });
});

describe("computeCategoryMap", () => {
  it("groups by category and returns spend amounts", () => {
    const txs = [
      tx({ category: "Food", amount: -50 }),
      tx({ category: "Food", amount: -30 }),
      tx({ category: "Transport", amount: -20 }),
    ];
    const result = computeCategoryMap(txs);
    const food = result.find((c) => c.cat === "Food");
    assert.ok(food);
    assert.equal(food.spend, 80);
    assert.equal(food.count, 2);
  });

  it("ignores income transactions", () => {
    const txs = [tx({ amount: 5000, category: "Income" }), tx({ amount: -200, category: "Dining" })];
    const result = computeCategoryMap(txs);
    assert.equal(result.find((c) => c.cat === "Income"), undefined);
  });

  it("returns empty array for empty input", () => {
    assert.deepEqual(computeCategoryMap([]), []);
  });
});

describe("computeMerchantMap", () => {
  it("aggregates spend by canonical merchant", () => {
    const txs = [
      tx({ merchantCanonical: "Woolworths", amount: -100 }),
      tx({ merchantCanonical: "Woolworths", amount: -50 }),
      tx({ merchantCanonical: "Netflix", amount: -24 }),
    ];
    const result = computeMerchantMap(txs);
    const woolies = result.find((m) => m.merchant === "Woolworths");
    assert.ok(woolies);
    assert.equal(woolies.total, 150);
    assert.equal(woolies.count, 2);
  });
});

describe("computeMonthSummaries", () => {
  it("returns monthly buckets sorted by month", () => {
    const txs = [
      tx({ date: "2025-01-10", amount: 5000 }),
      tx({ date: "2025-01-20", amount: -1000 }),
      tx({ date: "2025-02-10", amount: -500 }),
    ];
    const result = computeMonthSummaries(txs);
    assert.ok(result.length >= 1);
    const jan = result.find((m) => m.month === "2025-01");
    assert.ok(jan);
    assert.equal(jan.income, 5000);
    assert.equal(jan.spend, 1000);
  });
});

describe("computeCashflowForecast", () => {
  it("returns empty array for less than 2 months", () => {
    assert.deepEqual(computeCashflowForecast([]), []);
    assert.deepEqual(
      computeCashflowForecast([{ month: "2025-01", income: 5000, spend: 3000, net: 2000 }]),
      []
    );
  });

  it("returns 3 future months", () => {
    const months = [
      { month: "2025-01", income: 5000, spend: 3000, net: 2000 },
      { month: "2025-02", income: 5500, spend: 3200, net: 2300 },
    ];
    const result = computeCashflowForecast(months);
    assert.equal(result.length, 3);
    assert.ok(result[0].month > "2025-02");
  });
});

describe("generateInsights", () => {
  it("returns import prompt when no transactions", () => {
    const result = generateInsights([], [], computeFinanceSummary([], []));
    assert.ok(result.length > 0);
    assert.equal(result[0].id, "import-data");
  });

  it("detects subscription spend", () => {
    const txs = [tx({ amount: 5000 })];
    const subs = [sub({ amount: 200 }), sub({ amount: 50 })];
    const summary = computeFinanceSummary(txs, subs);
    const insights = generateInsights(txs, subs, summary);
    const subInsight = insights.find((i) => i.id === "sub-spend");
    assert.ok(subInsight);
  });
});
