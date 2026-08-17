import type { FinancialPositionReadModel } from "@/server/services/financialPositionReadService";

export type AddFinancialDataCategoryId = "bank" | "employment" | "property" | "loans" | "tax" | "super" | "other";
export type AddFinancialDataCategoryStatus = "Confirmed" | "Needs review" | "Missing" | "Not added" | "Optional";

export type AddFinancialDataSummary = {
  categoryStatuses: Record<AddFinancialDataCategoryId, AddFinancialDataCategoryStatus>;
  confirmedSources: number;
  needsReview: number;
  reviewedPercent: number;
  recommendedCategory: AddFinancialDataCategoryId;
  recommendation: string;
  recommendationAction: string;
};

function hasDocument(position: FinancialPositionReadModel, documentType: string) {
  return position.documentImportStatus.documents.some((document) => document.documentType === documentType);
}

export function buildAddFinancialDataSummary(position: FinancialPositionReadModel): AddFinancialDataSummary {
  const statuses: AddFinancialDataSummary["categoryStatuses"] = {
    bank: position.cashPosition.sourceRecordIds.length > 0 ? "Confirmed" : hasDocument(position, "bank_statement") ? "Needs review" : "Missing",
    employment: position.income.length > 0 ? "Confirmed" : hasDocument(position, "payslip") ? "Needs review" : "Missing",
    property: position.propertyDetails.length > 0 ? "Confirmed" : hasDocument(position, "mortgage_statement") ? "Needs review" : "Missing",
    loans: position.liabilities.length > 0 ? "Confirmed" : hasDocument(position, "mortgage_statement") ? "Needs review" : "Missing",
    tax: hasDocument(position, "tax_return") ? "Needs review" : "Not added",
    super: position.superannuation.length > 0 ? "Confirmed" : hasDocument(position, "super_statement") ? "Needs review" : "Missing",
    other: "Optional",
  };
  const confirmedSources = position.provenanceSummary.sourceRecordIds.length;
  const needsReview = position.documentImportStatus.unresolvedExtractionReviewCount + position.confidenceSummary.lowConfidenceFactCount;
  const total = confirmedSources + needsReview;
  const reviewedPercent = total === 0 ? 0 : Math.round((confirmedSources / total) * 100);
  const recommended = ([
    ["employment", "Review employment income", "Confirm your employment income to improve cash-flow and borrowing guidance."],
    ["loans", "Review loans & credit", "Confirm current loan and credit balances so liabilities stay accurate."],
    ["property", "Add property details", "Add property and mortgage details to complete your net worth."],
    ["bank", "Add bank & savings", "Add current accounts and statements to complete your cash position."],
    ["super", "Add superannuation", "Add current superannuation details to complete your asset position."],
    ["tax", "Add tax information", "Add current tax evidence for future tax and lending workflows."],
  ] as const).find(([id]) => statuses[id] !== "Confirmed");

  return {
    categoryStatuses: statuses,
    confirmedSources,
    needsReview,
    reviewedPercent,
    recommendedCategory: recommended?.[0] ?? "other",
    recommendationAction: recommended?.[1] ?? "Review supporting evidence",
    recommendation: recommended?.[2] ?? "Your core current position is confirmed. Add any supporting evidence that will make future reviews easier.",
  };
}
