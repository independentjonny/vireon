export type DocumentType = "bank_statement" | "payslip" | "tax_return" | "mortgage_statement" | "super_statement";

export type DocumentStatus = "uploaded" | "processing" | "extracted" | "needs_review" | "failed";

export type ConfidenceLevel = "high" | "medium" | "low";

export type RiskLevel = "low" | "medium" | "high";

export type SourceTrace = {
  documentId: string;
  fileName: string;
  documentType: DocumentType;
  uploadedAt: string;
  confidence: number;
};

export type UploadedDocument = {
  id: string;
  fileName: string;
  documentType: DocumentType;
  uploadedAt: string;
  status: DocumentStatus;
  extractedText: string;
  extractionConfidence: number;
  sourcePeriodStart: string | null;
  sourcePeriodEnd: string | null;
  ingestionVersion?: string;
  extractionMethod?: "pdf-text-layer" | "csv-structured" | "plain-text";
  ingestionWarnings?: string[];
  importedRowCount?: number | null;
  reviewedSubscriptions?: Array<{ name: string; monthlyAmount: number; approved: boolean }>;
};

export type ProfileValueKey =
  | "incomeMonthly"
  | "incomeAnnual"
  | "employmentType"
  | "employerName"
  | "mortgageBalance"
  | "mortgageRepaymentMonthly"
  | "interestRate"
  | "superBalance"
  | "monthlySpending"
  | "recurringSubscriptions"
  | "liabilities"
  | "assets";

export type FinancialProfile = {
  id: string;
  incomeMonthly: number;
  incomeAnnual: number;
  employmentType: string;
  employerName: string;
  mortgageBalance: number;
  mortgageRepaymentMonthly: number;
  interestRate: number;
  superBalance: number;
  monthlySpending: number;
  recurringSubscriptions: number;
  liabilities: number;
  assets: number;
  lastUpdatedAt: string;
  sources: Partial<Record<ProfileValueKey, SourceTrace>>;
};

export type BorrowingCapacity = {
  profileId: string;
  estimatedMaxBorrowing: number;
  estimatedSafeBorrowing: number;
  monthlyRepaymentAtCurrentRates: number;
  surplusIncome: number;
  riskLevel: RiskLevel;
  assumptions: string[];
  warnings: string[];
};

export type RefinanceOpportunity = {
  profileId: string;
  currentRate: number;
  benchmarkRate: number;
  estimatedMonthlySaving: number;
  estimatedAnnualSaving: number;
  confidence: ConfidenceLevel;
  notes: string[];
};

export type SavingsOpportunity = {
  profileId: string;
  category: string;
  description: string;
  monthlySaving: number;
  annualSaving: number;
  confidence: ConfidenceLevel;
  action: string;
};

export type LenderPack = {
  generatedAt: string;
  borrowerProfile: FinancialProfile;
  incomeSummary: string;
  assetSummary: string;
  liabilitySummary: string;
  cashflowSummary: string;
  mortgageRefinanceSummary: string;
  documentChecklist: { label: string; documentType: DocumentType; available: boolean }[];
  uploadedDocumentIndex: Pick<UploadedDocument, "id" | "fileName" | "documentType" | "uploadedAt" | "status">[];
  missingItems: string[];
  riskFlags: string[];
  assumptions: string[];
};

export type FinancialVaultState = {
  uploaded_documents: UploadedDocument[];
  financial_profile: FinancialProfile;
  borrowing_capacity: BorrowingCapacity;
  refinance_opportunities: RefinanceOpportunity[];
  savings_opportunities: SavingsOpportunity[];
  lender_pack: LenderPack;
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  bank_statement: "Bank Statement",
  payslip: "Payslip",
  tax_return: "Tax Return",
  mortgage_statement: "Mortgage Statement",
  super_statement: "Super Statement",
};

export const REQUIRED_DOCUMENTS: { label: string; documentType: DocumentType }[] = [
  { label: "Recent bank statement", documentType: "bank_statement" },
  { label: "Latest payslip", documentType: "payslip" },
  { label: "Latest tax return", documentType: "tax_return" },
  { label: "Current mortgage statement", documentType: "mortgage_statement" },
  { label: "Super statement", documentType: "super_statement" },
];
