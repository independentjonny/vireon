import type { SubscriptionRecord } from "@/lib/persistence/schema";

export interface RenewalEvent {
  id: string;
  merchant: string;
  amount: number;
  cadence: string;
  nextRenewalDate: string;
  daysUntil: number;
  urgent: boolean;
}

export function computeUpcomingRenewals(subs: SubscriptionRecord[], limit = 8): RenewalEvent[] {
  const now = Date.now();
  return [...subs]
    .sort(
      (a, b) =>
        new Date(a.nextRenewalDate).getTime() - new Date(b.nextRenewalDate).getTime()
    )
    .slice(0, limit)
    .map((s) => {
      const ms = new Date(s.nextRenewalDate).getTime() - now;
      const daysUntil = Math.round(ms / 86_400_000);
      return {
        id: s.id,
        merchant: s.merchant,
        amount: s.amount,
        cadence: s.cadence,
        nextRenewalDate: s.nextRenewalDate,
        daysUntil,
        urgent: daysUntil <= 7,
      };
    });
}

export function computeRenewalCalendar(
  subs: SubscriptionRecord[]
): { month: string; events: RenewalEvent[] }[] {
  const now = new Date();
  const calMap: Record<string, RenewalEvent[]> = {};
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    calMap[key] = [];
  }
  subs.forEach((s) => {
    const d = new Date(s.nextRenewalDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in calMap) {
      const daysUntil = Math.round((d.getTime() - now.getTime()) / 86_400_000);
      calMap[key].push({
        id: s.id,
        merchant: s.merchant,
        amount: s.amount,
        cadence: s.cadence,
        nextRenewalDate: s.nextRenewalDate,
        daysUntil,
        urgent: daysUntil <= 7,
      });
    }
  });
  return Object.entries(calMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, events]) => ({ month, events }));
}

export function totalMonthlyCost(subs: SubscriptionRecord[]): number {
  return subs.reduce((s, sub) => s + sub.amount, 0);
}

export function totalSavingsOpportunity(subs: SubscriptionRecord[]): number {
  return subs.reduce((s, sub) => s + (sub.savingsOpportunity || 0), 0);
}

export function findDuplicateRisk(subs: SubscriptionRecord[]): SubscriptionRecord[] {
  const counts: Record<string, number> = {};
  subs.forEach((s) => {
    const key = s.merchant.toLowerCase().trim();
    counts[key] = (counts[key] || 0) + 1;
  });
  return subs.filter((s) => counts[s.merchant.toLowerCase().trim()] > 1);
}
