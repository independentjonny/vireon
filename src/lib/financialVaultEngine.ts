import {
  DOCUMENT_TYPE_LABELS,
  REQUIRED_DOCUMENTS,
  type BorrowingCapacity,
  type DocumentType,
  type FinancialProfile,
  type LenderPack,
  type RefinanceOpportunity,
  type SavingsOpportunity,
  type SourceTrace,
  type UploadedDocument,
} from "@/lib/financialVaultTypes";

type ExtractedValues = Partial<{
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
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
}>;

export type DocumentAnalysis = {
  detectedType: DocumentType;
  confidence: number;
  status: UploadedDocument["status"];
  values: ExtractedValues;
  notes: string[];
};

const benchmarkRate = 5.89;

export function emptyFinancialProfile(now = new Date().toISOString()): FinancialProfile {
  return {
    id: "profile-local",
    incomeMonthly: 0,
    incomeAnnual: 0,
    employmentType: "",
    employerName: "",
    mortgageBalance: 0,
    mortgageRepaymentMonthly: 0,
    interestRate: 0,
    superBalance: 0,
    monthlySpending: 0,
    recurringSubscriptions: 0,
    liabilities: 0,
    assets: 0,
    lastUpdatedAt: now,
    sources: {},
  };
}

function parseMoney(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = Number(match[1].replace(/[$,\s]/g, ""));
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function parsePercent(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = Number(match[1].replace("%", ""));
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function detectDocumentType(fileName: string, text: string, taggedType: DocumentType): DocumentType {
  const haystack = `${fileName} ${text}`.toLowerCase();
  if (haystack.includes("payslip") || haystack.includes("employer") || haystack.includes("gross pay")) return "payslip";
  if (haystack.includes("mortgage") || haystack.includes("home loan") || haystack.includes("interest rate")) return "mortgage_statement";
  if (haystack.includes("superannuation") || haystack.includes("super balance")) return "super_statement";
  if (haystack.includes("tax return") || haystack.includes("taxable income")) return "tax_return";
  if (haystack.includes("account balance") || haystack.includes("bank statement")) return "bank_statement";
  return taggedType;
}

export function analyzeDocumentText(fileName: string, taggedType: DocumentType, text: string): DocumentAnalysis {
  const normalizedText = text.replace(/\r/g, "\n");
  const detectedType = detectDocumentType(fileName, normalizedText, taggedType);
  const values: ExtractedValues = {};
  const notes: string[] = [];

  const annualIncome = parseMoney(normalizedText, [
    /annual(?:ised)?\s+(?:salary|income)[:\s$]*([\d,]+(?:\.\d{1,2})?)/i,
    /taxable income[:\s$]*([\d,]+(?:\.\d{1,2})?)/i,
    /salary[:\s$]*([\d,]+(?:\.\d{1,2})?)/i,
  ]);
  const monthlyIncome = parseMoney(normalizedText, [
    /monthly\s+(?:income|salary)[:\s$]*([\d,]+(?:\.\d{1,2})?)/i,
    /net pay[:\s$]*([\d,]+(?:\.\d{1,2})?)/i,
  ]);
  const employer = normalizedText.match(/employer[:\s]+([A-Za-z0-9 &.'-]+)/i)?.[1]?.trim();
  const balance = parseMoney(normalizedText, [
    /(?:closing|account)\s+balance[:\s$]*([\d,]+(?:\.\d{1,2})?)/i,
    /assets?[:\s$]*([\d,]+(?:\.\d{1,2})?)/i,
  ]);
  const mortgageBalance = parseMoney(normalizedText, [
    /mortgage\s+balance[:\s$]*([\d,]+(?:\.\d{1,2})?)/i,
    /loan\s+balance[:\s$]*([\d,]+(?:\.\d{1,2})?)/i,
  ]);
  const repayment = parseMoney(normalizedText, [
    /monthly\s+repayment[:\s$]*([\d,]+(?:\.\d{1,2})?)/i,
    /repayment[:\s$]*([\d,]+(?:\.\d{1,2})?)/i,
  ]);
  const interestRate = parsePercent(normalizedText, [/interest\s+rate[:\s]*([\d.]+)%?/i]);
  const superBalance = parseMoney(normalizedText, [/super(?:annuation)?\s+balance[:\s$]*([\d,]+(?:\.\d{1,2})?)/i]);
  const monthlySpending = parseMoney(normalizedText, [/monthly\s+spending[:\s$]*([\d,]+(?:\.\d{1,2})?)/i]);
  const recurring = parseMoney(normalizedText, [/recurring\s+(?:subscriptions|expenses)[:\s$]*([\d,]+(?:\.\d{1,2})?)/i]);
  const liabilities = parseMoney(normalizedText, [/liabilities[:\s$]*([\d,]+(?:\.\d{1,2})?)/i]);

  if (annualIncome) {
    values.incomeAnnual = annualIncome;
    values.incomeMonthly = Math.round((annualIncome / 12) * 100) / 100;
  }
  if (monthlyIncome) {
    values.incomeMonthly = monthlyIncome;
    values.incomeAnnual = Math.round(monthlyIncome * 12);
  }
  if (employer) {
    values.employerName = employer;
    values.employmentType = normalizedText.match(/contractor|self-employed/i) ? "Self-employed" : "PAYG employee";
  }
  if (balance) values.assets = balance;
  if (mortgageBalance) values.mortgageBalance = mortgageBalance;
  if (repayment) values.mortgageRepaymentMonthly = repayment;
  if (interestRate) values.interestRate = interestRate;
  if (superBalance) values.superBalance = superBalance;
  if (monthlySpending) values.monthlySpending = monthlySpending;
  if (recurring) values.recurringSubscriptions = recurring;
  if (liabilities) values.liabilities = liabilities;

  const foundCount = Object.keys(values).length;
  let confidence = Math.min(0.96, 0.42 + foundCount * 0.09);
  if (detectedType !== taggedType) {
    confidence -= 0.08;
    notes.push(`Tagged as ${DOCUMENT_TYPE_LABELS[taggedType]}, detected as ${DOCUMENT_TYPE_LABELS[detectedType]}.`);
  }
  if (normalizedText.length < 40) confidence = Math.min(confidence, 0.35);
  if (foundCount === 0) notes.push("No structured values were detected in this first-pass parser.");

  return {
    detectedType,
    confidence: Math.max(0.15, Math.round(confidence * 100) / 100),
    status: confidence >= 0.68 ? "extracted" : "needs_review",
    values,
    notes,
  };
}

export function mergeProfileWithExtraction(
  current: FinancialProfile,
  doc: UploadedDocument,
  values: ExtractedValues
): FinancialProfile {
  const next: FinancialProfile = { ...current, sources: { ...current.sources }, lastUpdatedAt: new Date().toISOString() };
  const source: SourceTrace = {
    documentId: doc.id,
    fileName: doc.fileName,
    documentType: doc.documentType,
    uploadedAt: doc.uploadedAt,
    confidence: doc.extractionConfidence,
  };

  for (const [key, value] of Object.entries(values)) {
    if (key === "sourcePeriodStart" || key === "sourcePeriodEnd" || value === undefined || value === null) continue;
    const typedKey = key as keyof FinancialProfile["sources"];
    const existing = current[typedKey as keyof FinancialProfile];
    if (existing === 0 || existing === "" || doc.extractionConfidence >= (current.sources[typedKey]?.confidence ?? 0)) {
      Object.assign(next, { [key]: value });
      next.sources[typedKey] = source;
    }
  }

  return next;
}

function monthlyRepayment(principal: number, annualRate: number, years = 30): number {
  if (!principal || !annualRate) return 0;
  const monthlyRate = annualRate / 100 / 12;
  const payments = years * 12;
  return Math.round((principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -payments)));
}

export function calculateBorrowingCapacity(profile: FinancialProfile): BorrowingCapacity {
  const estimatedTaxMonthly = profile.incomeAnnual > 0 ? profile.incomeMonthly * 0.27 : 0;
  const livingExpenses = Math.max(profile.monthlySpending || 0, 3200);
  const liabilities = Math.max(profile.liabilities * 0.015, 0);
  const surplusIncome = Math.round(profile.incomeMonthly - estimatedTaxMonthly - livingExpenses - profile.mortgageRepaymentMonthly - liabilities);
  const assessmentRate = 8.75;
  const maxBorrowing = Math.max(0, surplusIncome * 12 * 6.2);
  const safeBorrowing = maxBorrowing * 0.82;
  const riskLevel = surplusIncome < 1800 ? "high" : surplusIncome < 3600 ? "medium" : "low";

  return {
    profileId: profile.id,
    estimatedMaxBorrowing: Math.round(maxBorrowing),
    estimatedSafeBorrowing: Math.round(safeBorrowing),
    monthlyRepaymentAtCurrentRates: monthlyRepayment(Math.round(safeBorrowing), assessmentRate),
    surplusIncome,
    riskLevel,
    assumptions: [
      "Planning estimate only, not financial, tax, credit, or lending advice.",
      "Uses a 27% estimated tax allowance and a conservative 8.75% assessment rate.",
      "Minimum living expenses are assumed at $3,200/month until verified by documents.",
      "No lender approval, product eligibility, or credit policy outcome is implied.",
    ],
    warnings: riskLevel === "high" ? ["Low verified surplus income may materially reduce serviceability."] : [],
  };
}

export function detectRefinanceOpportunities(profile: FinancialProfile): RefinanceOpportunity[] {
  if (!profile.mortgageBalance || !profile.interestRate) return [];
  const currentMonthly = monthlyRepayment(profile.mortgageBalance, profile.interestRate);
  const benchmarkMonthly = monthlyRepayment(profile.mortgageBalance, benchmarkRate);
  const estimatedMonthlySaving = Math.max(0, currentMonthly - benchmarkMonthly);

  return [
    {
      profileId: profile.id,
      currentRate: profile.interestRate,
      benchmarkRate,
      estimatedMonthlySaving,
      estimatedAnnualSaving: estimatedMonthlySaving * 12,
      confidence: profile.sources.interestRate && profile.sources.mortgageBalance ? "high" : "medium",
      notes: [
        "Benchmark is a local placeholder and should become configurable later.",
        "Break-even depends on discharge fees, application fees, valuation costs, and cashback offers.",
      ],
    },
  ];
}

export function detectSavingsOpportunities(profile: FinancialProfile): SavingsOpportunity[] {
  const opportunities: SavingsOpportunity[] = [];
  if (profile.recurringSubscriptions > 120) {
    opportunities.push({
      profileId: profile.id,
      category: "Subscriptions",
      description: "Recurring subscriptions are high enough to justify a cancellation review.",
      monthlySaving: Math.round(profile.recurringSubscriptions * 0.22),
      annualSaving: Math.round(profile.recurringSubscriptions * 0.22 * 12),
      confidence: "medium",
      action: "Review duplicate or unused recurring services.",
    });
  }
  if (profile.monthlySpending > 7000) {
    opportunities.push({
      profileId: profile.id,
      category: "Cashflow leakage",
      description: "Monthly spending is elevated relative to the seeded profile benchmark.",
      monthlySaving: 420,
      annualSaving: 5040,
      confidence: "medium",
      action: "Review discretionary categories, utilities, and insurance renewals.",
    });
  }
  if (profile.interestRate > benchmarkRate && profile.mortgageBalance > 0) {
    opportunities.push({
      profileId: profile.id,
      category: "Mortgage",
      description: "Current mortgage rate is above the local benchmark assumption.",
      monthlySaving: detectRefinanceOpportunities(profile)[0]?.estimatedMonthlySaving ?? 0,
      annualSaving: detectRefinanceOpportunities(profile)[0]?.estimatedAnnualSaving ?? 0,
      confidence: "high",
      action: "Compare refinance options and calculate fee break-even.",
    });
  }
  return opportunities;
}

export function buildLenderPack(
  documents: UploadedDocument[],
  profile: FinancialProfile,
  borrowing: BorrowingCapacity,
  refinance: RefinanceOpportunity[],
  savings: SavingsOpportunity[]
): LenderPack {
  const documentTypes = new Set(documents.filter((doc) => doc.status === "extracted").map((doc) => doc.documentType));
  const documentChecklist = REQUIRED_DOCUMENTS.map((item) => ({
    ...item,
    available: documentTypes.has(item.documentType),
  }));
  const missingItems = documentChecklist.filter((item) => !item.available).map((item) => item.label);

  return {
    generatedAt: new Date().toISOString(),
    borrowerProfile: profile,
    incomeSummary: `Verified income estimate: $${Math.round(profile.incomeAnnual).toLocaleString()}/year from ${profile.employerName || "unverified employer"}.`,
    assetSummary: `Assets: $${Math.round(profile.assets).toLocaleString()}, super: $${Math.round(profile.superBalance).toLocaleString()}.`,
    liabilitySummary: `Mortgage balance: $${Math.round(profile.mortgageBalance).toLocaleString()}, other liabilities: $${Math.round(profile.liabilities).toLocaleString()}.`,
    cashflowSummary: `Estimated monthly surplus: $${borrowing.surplusIncome.toLocaleString()}.`,
    mortgageRefinanceSummary: refinance[0]
      ? `Potential refinance saving: $${refinance[0].estimatedMonthlySaving.toLocaleString()}/month at ${refinance[0].benchmarkRate}%.`
      : "No refinance opportunity detected until mortgage documents are uploaded.",
    documentChecklist,
    uploadedDocumentIndex: documents.map(({ id, fileName, documentType, uploadedAt, status }) => ({
      id,
      fileName,
      documentType,
      uploadedAt,
      status,
    })),
    missingItems,
    riskFlags: [
      ...borrowing.warnings,
      ...(missingItems.length ? [`Missing lender checklist items: ${missingItems.join(", ")}.`] : []),
      ...(savings.length ? ["Savings estimates are inferred from recurring and spending patterns."] : []),
    ],
    assumptions: borrowing.assumptions,
  };
}
