import { subscriptionSummary } from "@/lib/subscriptionEngine";
import {
  getLocalSubscriptions,
  upsertLocalSubscription,
  getStorageMode,
} from "@/lib/localStore";
import type { SubscriptionRecord } from "@/lib/persistence/schema";
import { detectCadence } from "@/lib/subscriptions/cadenceDetector";
import { predictRenewals } from "@/lib/subscriptions/renewalPredictor";
import { generateSavingsRecommendations } from "@/lib/subscriptions/savingsRecommender";

function getNextRenewalDate(cadence: "monthly" | "quarterly" | "annual"): string {
  const now = new Date();
  if (cadence === "monthly") now.setMonth(now.getMonth() + 1);
  else if (cadence === "quarterly") now.setMonth(now.getMonth() + 3);
  else now.setFullYear(now.getFullYear() + 1);
  return now.toISOString();
}

function estimateSavingsOpportunity(
  amount: number,
  cadence: "monthly" | "quarterly" | "annual"
): number {
  const monthly =
    cadence === "monthly" ? amount : cadence === "quarterly" ? amount / 3 : amount / 12;
  return Math.round(monthly * 12 * 0.15 * 100) / 100;
}

function buildDetectionResults(subs: SubscriptionRecord[]) {
  if (subs.length === 0) return null;

  const cadenceDays: Record<string, number> = { monthly: 30, quarterly: 90, annual: 365 };

  const cadences = subs.map((s) => ({
    merchant: s.merchant,
    cadence: s.cadence,
    confidence: 0.85,
    nextExpected: s.nextRenewalDate,
    averageDaysBetween: cadenceDays[s.cadence] ?? 30,
  }));

  const renewals = predictRenewals(
    subs.map((s) => ({
      merchant: s.merchant,
      amounts: [s.amount, s.amount],
      dates: [
        new Date(Date.now() - cadenceDays[s.cadence] * 24 * 60 * 60 * 1000).toISOString(),
        s.nextRenewalDate,
      ],
    }))
  );

  const savingsInput = subs.map((s) => ({
    merchant: s.merchant,
    amount: s.amount,
    duplicateOf: undefined as string | undefined,
  }));

  const seen = new Map<string, string>();
  for (const item of savingsInput) {
    const key = item.amount.toFixed(2);
    if (seen.has(key)) {
      item.duplicateOf = seen.get(key);
    } else {
      seen.set(key, item.merchant);
    }
  }

  const savings = generateSavingsRecommendations(savingsInput);
  const duplicates = savingsInput.filter((s) => s.duplicateOf);

  return {
    cadences,
    renewals,
    savings,
    duplicateRisks: duplicates,
    detectedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const storageMode = getStorageMode();
  const localSubs = getLocalSubscriptions();

  if (localSubs.length > 0) {
    const detectionResults = buildDetectionResults(localSubs);
    const monthlySpend = localSubs.reduce((sum, s) => sum + s.amount, 0);

    return Response.json({
      ok: true,
      storageMode,
      dataSource: "local-persistent",
      subscriptions: localSubs,
      monthlySpend: Math.round(monthlySpend * 100) / 100,
      annualisedSpend: Math.round(monthlySpend * 12 * 100) / 100,
      optimisationCount: localSubs.length,
      detectionResults,
    });
  }

  const mockSummary = subscriptionSummary();
  return Response.json({
    ok: true,
    storageMode,
    dataSource: "mock",
    ...mockSummary,
    detectionResults: null,
  });
}

export async function POST(request: Request) {
  let body: {
    merchant?: string;
    amount?: number;
    cadence?: "monthly" | "quarterly" | "annual";
    workspaceId?: string;
    transactionId?: string;
  } = {};

  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.merchant || body.amount === undefined) {
    return Response.json(
      { ok: false, error: "merchant and amount are required" },
      { status: 400 }
    );
  }

  const cadence = body.cadence ?? "monthly";
  const workspaceId = body.workspaceId ?? "dev-workspace-001";
  const nextRenewalDate = getNextRenewalDate(cadence);
  const savingsOpportunity = estimateSavingsOpportunity(body.amount, cadence);
  const hasDb = Boolean(process.env.DATABASE_URL);
  const storageMode = getStorageMode();

  const annualisedCost =
    cadence === "monthly"
      ? body.amount * 12
      : cadence === "quarterly"
      ? body.amount * 4
      : body.amount;

  const subscription: SubscriptionRecord = {
    id: `sub-${Date.now()}`,
    workspaceId,
    transactionId: body.transactionId ?? "",
    merchant: body.merchant,
    merchantCanonical: body.merchant.toLowerCase().replace(/\s+/g, "-"),
    amount: body.amount,
    cadence,
    nextRenewalDate,
    cancellationScore: 0,
    pricingAnomalyScore: 0,
    savingsOpportunity,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let persisted = false;
  let persistMessage: string;

  if (hasDb) {
    persistMessage = "DATABASE_URL present — install @prisma/client and call subscriptionRepository.upsert() to persist";
  } else {
    const saved = upsertLocalSubscription(subscription);
    persisted = true;
    persistMessage = `local-persistent mode — subscription for ${saved.merchant} written to .ai/local-data/subscriptions.json`;
  }

  return Response.json(
    {
      ok: true,
      storageMode,
      subscription: { ...subscription, annualisedCost },
      persisted,
      persistMessage,
    },
    { status: 201 }
  );
}
