import type { CanonicalFinancialRecord } from "./manualFinancialDataPlatform";
import type { FinancialPositionReadModel } from "../server/services/financialPositionReadService";

export function confirmedBalance(record: CanonicalFinancialRecord): number | null {
  const keys = record.kind === "liability" ? ["balance", "principal", "amount", "value"] : ["marketValue", "balance", "amount", "value"];
  for (const key of keys) {
    const raw = record.value[key];
    if (typeof raw !== "number" && typeof raw !== "string") continue;
    if (typeof raw === "string" && !raw.trim()) continue;
    const value = typeof raw === "number" ? raw : Number(raw.replace(/[$,\s]/g, ""));
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function knownTotal(records: CanonicalFinancialRecord[]): number | null {
  const values = records.map(confirmedBalance).filter((value): value is number => value !== null);
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}

export function confirmedPositionSummary(position: FinancialPositionReadModel) {
  const eligible = (record: CanonicalFinancialRecord) => record.userId === position.userId && record.provenance.userConfirmed && !record.superseded && !record.approximate && !position.staleDataSummary.staleRecordIds.includes(record.id);
  const assets = position.assets.filter(eligible), liabilities = position.liabilities.filter(eligible);
  const groups = [
    { label: "Property", color: "#3894c2", records: [] as CanonicalFinancialRecord[] },
    { label: "Investments & super", color: "#7185df", records: [] as CanonicalFinancialRecord[] },
    { label: "Cash & savings", color: "#9daac8", records: [] as CanonicalFinancialRecord[] },
    { label: "Other assets", color: "#d1ad67", records: [] as CanonicalFinancialRecord[] },
  ];
  for (const record of assets) {
    const label = `${record.subtype} ${record.label}`;
    const index = /property|home|house|apartment|unit/i.test(label) ? 0 : /investment|shares?|etf|super/i.test(label) ? 1 : record.kind === "account" || /cash|savings|deposit/i.test(label) ? 2 : 3;
    groups[index].records.push(record);
  }
  const assetTotal = knownTotal(assets), liabilityTotal = knownTotal(liabilities);
  // Confirmed records do not prove that every asset and debt has been supplied.
  return {
    assets: assetTotal, liabilities: liabilityTotal, liabilityRecords: liabilities,
    netPosition: assetTotal !== null && liabilityTotal !== null ? assetTotal - liabilityTotal : null,
    assetGroups: groups.map(({ label, color, records }) => ({ label, color, value: knownTotal(records) })),
    note: "Known records only. Missing, stale or unconfirmed information may change your overall position.",
  };
}
