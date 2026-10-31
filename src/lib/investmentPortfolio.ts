import { confirmedBalance, knownTotal } from "@/lib/confirmedPositionSummary";
import type { CanonicalFinancialRecord } from "./manualFinancialDataPlatform";
import type { FinancialPositionReadModel } from "../server/services/financialPositionReadService";

export function investmentPortfolio(position: FinancialPositionReadModel) {
  const groups = [
    { label: "Investment property", items: [] as CanonicalFinancialRecord[], color: "#3894c2" },
    { label: "Investments", items: [] as CanonicalFinancialRecord[], color: "#65b4c8" },
    { label: "Superannuation", items: [] as CanonicalFinancialRecord[], color: "#4b57ee" },
  ];
  const superIds = new Set(position.superannuation.map(item => item.id));
  const propertyIds = new Set(position.propertyDetails.map(item => item.id));
  const seen = new Set<string>();
  for (const item of position.assets) {
    if (seen.has(item.id) || item.userId !== position.userId || !item.provenance.userConfirmed || item.superseded || item.approximate || position.staleDataSummary.staleRecordIds.includes(item.id)) continue;
    seen.add(item.id);
    // Membership takes precedence over words such as "fund" in a holding's name.
    if (superIds.has(item.id) || /superannuation|super-fund/i.test(item.subtype)) groups[2].items.push(item);
    else if (propertyIds.has(item.id)) {
      if (/investment|rental/i.test(`${item.label} ${item.subtype}`)) groups[0].items.push(item);
    } else if (/share|investment|etf|fund|bond|fixed/i.test(`${item.label} ${item.subtype}`)) groups[1].items.push(item);
  }
  const populated = groups.filter(group => group.items.length).map(group => ({...group, value: knownTotal(group.items)}));
  const items = populated.flatMap(group => group.items);
  return { groups: populated, total: knownTotal(items), balance: confirmedBalance };
}
