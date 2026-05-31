import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeUpcomingRenewals,
  computeRenewalCalendar,
} from "../../src/lib/services/subscriptionService.js";
import type { SubscriptionRecord } from "../../src/lib/persistence/schema.js";

function sub(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().split("T")[0];
  return {
    id: "s1",
    workspaceId: "ws1",
    transactionId: "t1",
    merchant: "Netflix",
    merchantCanonical: "Netflix",
    amount: 24,
    cadence: "monthly",
    nextRenewalDate: nextWeek,
    cancellationScore: 0,
    pricingAnomalyScore: 0,
    savingsOpportunity: 0,
    active: true,
    createdAt: "2025-01-15T00:00:00.000Z",
    updatedAt: "2025-01-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeUpcomingRenewals", () => {
  it("returns empty array for empty input", () => {
    assert.deepEqual(computeUpcomingRenewals([]), []);
  });

  it("marks renewals within 7 days as urgent", () => {
    const subs = [sub({ nextRenewalDate: new Date(Date.now() + 2 * 86_400_000).toISOString().split("T")[0] })];
    const result = computeUpcomingRenewals(subs);
    assert.equal(result.length, 1);
    assert.equal(result[0].urgent, true);
  });

  it("does not mark renewals beyond 7 days as urgent", () => {
    const subs = [sub({ nextRenewalDate: new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0] })];
    const result = computeUpcomingRenewals(subs);
    assert.equal(result.length, 1);
    assert.equal(result[0].urgent, false);
  });

  it("sorts by nearest renewal first", () => {
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString().split("T")[0];
    const later = new Date(Date.now() + 20 * 86_400_000).toISOString().split("T")[0];
    const subs = [sub({ merchant: "Spotify", nextRenewalDate: later }), sub({ nextRenewalDate: soon })];
    const result = computeUpcomingRenewals(subs);
    assert.ok(result[0].daysUntil <= result[1].daysUntil);
  });

  it("respects limit parameter", () => {
    const subs = Array.from({ length: 5 }, (_, i) =>
      sub({ id: `s${i}`, merchant: `Service${i}`, nextRenewalDate: new Date(Date.now() + (i + 1) * 86_400_000).toISOString().split("T")[0] })
    );
    const result = computeUpcomingRenewals(subs, 3);
    assert.equal(result.length, 3);
  });
});

describe("computeRenewalCalendar", () => {
  it("returns empty calendar months for empty subscriptions", () => {
    const result = computeRenewalCalendar([]);
    assert.ok(result.length >= 1);
    result.forEach((m) => assert.deepEqual(m.events, []));
  });

  it("buckets renewals into correct months", () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const renewalDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-15`;
    const subs = [sub({ nextRenewalDate: renewalDate })];
    const result = computeRenewalCalendar(subs);
    const monthKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;
    const bucket = result.find((m) => m.month === monthKey);
    assert.ok(bucket);
    assert.equal(bucket.events.length, 1);
  });
});
