import type { FinancialPositionReadModel } from "@/server/services/financialPositionReadService";

export type AddFinancialDataCategoryId = "bank" | "employment" | "property" | "loans" | "tax" | "super" | "other";
export type AddFinancialDataCategoryStatus = "Confirmed" | "Needs review" | "In progress" | "Missing" | "Not added" | "Optional";

export type AddFinancialDataSummary = {
  categoryStatuses: Record<AddFinancialDataCategoryId, AddFinancialDataCategoryStatus>;
  availableDocuments: FinancialPositionReadModel["documentImportStatus"]["documents"];
  confirmedSources: number;
  needsReview: number;
  reviewedPercent: number;
  recommendedCategory: AddFinancialDataCategoryId;
  recommendation: string;
  recommendationAction: string;
};

export type ExistingPropertyDraft = {
  recordId: string;
  address: string;
  addressId: string;
  addressLocality: string;
  addressState: string;
  addressPostcode: string;
  addressSource: "manual" | "geoscape-gnaf";
  propertyType: string;
  ownership: string;
  primaryUse: string;
  estimatedValue: string;
  purchaseDate: string;
  rentalIncome: boolean;
  rentalIncomeAmount: string;
  rentalIncomeFrequency: string;
  hasMortgage: boolean;
  lender: string;
  loanBalance: string;
  interestRate: string;
  repaymentAmount: string;
  repaymentFrequency: string;
  repaymentType: string;
  rateType: string;
  offsetBalance: string;
  selectedDocuments: FinancialPositionReadModel["documentImportStatus"]["documents"];
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function editableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" ? value : "";
}

function sourceDocumentIds(value: Record<string, unknown>) {
  return Array.isArray(value.sourceDocumentIds)
    ? value.sourceDocumentIds.filter((item): item is string => typeof item === "string")
    : [];
}

export function buildExistingPropertyDraft(position: FinancialPositionReadModel, requestedRecordId?: string): ExistingPropertyDraft | null {
  const property = requestedRecordId
    ? position.propertyDetails.find((record) => record.id === requestedRecordId)
    : position.propertyDetails[0];
  if (!property) return null;
  const propertyEntityKey = stringValue(property.value.entityKey);
  const mortgage = position.mortgageDetails.find((record) => record.value.propertyEntityKey === propertyEntityKey)
    ?? (position.propertyDetails.length === 1 && position.mortgageDetails.length === 1 ? position.mortgageDetails[0] : undefined);
  const linkedIds = new Set([...sourceDocumentIds(property.value), ...(mortgage ? sourceDocumentIds(mortgage.value) : [])]);

  return {
    recordId: property.id,
    address: stringValue(property.value.address) || property.label,
    addressId: stringValue(property.value.addressId),
    addressLocality: stringValue(property.value.locality),
    addressState: stringValue(property.value.state),
    addressPostcode: stringValue(property.value.postcode),
    addressSource: property.value.addressSource === "geoscape-gnaf" ? "geoscape-gnaf" : "manual",
    propertyType: stringValue(property.value.propertyType) || "House",
    ownership: stringValue(property.value.ownership) || "Joint",
    primaryUse: stringValue(property.value.primaryUse) || "Owner occupied",
    estimatedValue: editableNumber(property.value.marketValue),
    purchaseDate: stringValue(property.value.purchaseDate),
    rentalIncome: property.value.rentalIncome === true,
    rentalIncomeAmount: editableNumber(property.value.rentalIncomeAmount),
    rentalIncomeFrequency: stringValue(property.value.rentalIncomeFrequency) || "Weekly",
    hasMortgage: Boolean(mortgage),
    lender: stringValue(mortgage?.value.lender),
    loanBalance: editableNumber(mortgage?.value.balance),
    interestRate: editableNumber(mortgage?.value.interestRate),
    repaymentAmount: editableNumber(mortgage?.value.repaymentAmount),
    repaymentFrequency: stringValue(mortgage?.value.repaymentFrequency) || "Monthly",
    repaymentType: stringValue(mortgage?.value.repaymentType) || "Principal and interest",
    rateType: stringValue(mortgage?.value.rateType) || "Variable",
    offsetBalance: editableNumber(mortgage?.value.offsetBalance),
    selectedDocuments: position.documentImportStatus.documents.filter((document) => linkedIds.has(document.id)),
  };
}

function documentStatus(position: FinancialPositionReadModel, documentType: string): "Needs review" | "In progress" | null {
  const documents = position.documentImportStatus.documents.filter((document) => document.documentType === documentType);
  if (documents.some((document) => document.status === "needs_review")) return "Needs review";
  return documents.length > 0 ? "In progress" : null;
}

export function buildAddFinancialDataSummary(position: FinancialPositionReadModel): AddFinancialDataSummary {
  const statuses: AddFinancialDataSummary["categoryStatuses"] = {
    bank: position.cashPosition.sourceRecordIds.length > 0 ? "Confirmed" : documentStatus(position, "bank_statement") ?? "Missing",
    employment: position.income.length > 0 ? "Confirmed" : documentStatus(position, "payslip") ?? "Missing",
    property: position.propertyDetails.length > 0 ? "Confirmed" : documentStatus(position, "mortgage_statement") ?? "Missing",
    loans: position.liabilities.length > 0 ? "Confirmed" : documentStatus(position, "mortgage_statement") ?? "Missing",
    tax: documentStatus(position, "tax_return") ?? "Not added",
    super: position.superannuation.length > 0 ? "Confirmed" : documentStatus(position, "super_statement") ?? "Missing",
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
    availableDocuments: position.documentImportStatus.documents,
    confirmedSources,
    needsReview,
    reviewedPercent,
    recommendedCategory: recommended?.[0] ?? "other",
    recommendationAction: recommended?.[1] ?? "Review supporting evidence",
    recommendation: recommended?.[2] ?? "Your core current position is confirmed. Add any supporting evidence that will make future reviews easier.",
  };
}
