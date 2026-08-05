import {
  buildLenderPack,
  calculateBorrowingCapacity,
  detectRefinanceOpportunities,
  detectSavingsOpportunities,
  emptyFinancialProfile,
} from "@/lib/financialVaultEngine";
import type { FinancialVaultState } from "@/lib/financialVaultTypes";

export function createEmptyFinancialVaultState(now = new Date().toISOString()): FinancialVaultState {
  const profile = emptyFinancialProfile(now);
  const documents: FinancialVaultState["uploaded_documents"] = [];
  const borrowing = calculateBorrowingCapacity(profile);
  const refinance = detectRefinanceOpportunities(profile);
  const savings = detectSavingsOpportunities(profile);
  return {
    uploaded_documents: documents,
    financial_profile: profile,
    borrowing_capacity: borrowing,
    refinance_opportunities: refinance,
    savings_opportunities: savings,
    lender_pack: buildLenderPack(documents, profile, borrowing, refinance, savings),
  };
}

export function createDemoFinancialVaultState(now = "2026-07-31T00:00:00.000Z"): FinancialVaultState {
  const profile = {
    ...emptyFinancialProfile(now),
    id: "profile-demo",
    incomeMonthly: 14500,
    incomeAnnual: 174000,
    employmentType: "PAYG employee",
    employerName: "Synthetic Employer",
    mortgageBalance: 275000,
    mortgageRepaymentMonthly: 2150,
    interestRate: 6.24,
    superBalance: 355000,
    monthlySpending: 6200,
    recurringSubscriptions: 268,
    liabilities: 297677,
    assets: 2112860,
  };
  const documents: FinancialVaultState["uploaded_documents"] = [
    { id: "demo-bank", fileName: "synthetic-bank-statement.pdf", documentType: "bank_statement", uploadedAt: now, status: "extracted", extractedText: "", extractionConfidence: 0.93, sourcePeriodStart: "2026-07-01", sourcePeriodEnd: "2026-07-31" },
    { id: "demo-payslip", fileName: "synthetic-payslip.pdf", documentType: "payslip", uploadedAt: now, status: "extracted", extractedText: "", extractionConfidence: 0.94, sourcePeriodStart: "2026-07-01", sourcePeriodEnd: "2026-07-31" },
    { id: "demo-mortgage", fileName: "synthetic-mortgage-statement.pdf", documentType: "mortgage_statement", uploadedAt: now, status: "extracted", extractedText: "", extractionConfidence: 0.92, sourcePeriodStart: "2026-07-01", sourcePeriodEnd: "2026-07-31" },
    { id: "demo-super", fileName: "synthetic-super-statement.pdf", documentType: "super_statement", uploadedAt: now, status: "extracted", extractedText: "", extractionConfidence: 0.91, sourcePeriodStart: "2026-07-01", sourcePeriodEnd: "2026-07-31" },
  ];
  profile.sources = {
    incomeAnnual: { documentId: "demo-payslip", fileName: "synthetic-payslip.pdf", documentType: "payslip", uploadedAt: now, confidence: 0.94 },
    incomeMonthly: { documentId: "demo-payslip", fileName: "synthetic-payslip.pdf", documentType: "payslip", uploadedAt: now, confidence: 0.94 },
    employerName: { documentId: "demo-payslip", fileName: "synthetic-payslip.pdf", documentType: "payslip", uploadedAt: now, confidence: 0.94 },
    mortgageBalance: { documentId: "demo-mortgage", fileName: "synthetic-mortgage-statement.pdf", documentType: "mortgage_statement", uploadedAt: now, confidence: 0.92 },
    mortgageRepaymentMonthly: { documentId: "demo-mortgage", fileName: "synthetic-mortgage-statement.pdf", documentType: "mortgage_statement", uploadedAt: now, confidence: 0.92 },
    interestRate: { documentId: "demo-mortgage", fileName: "synthetic-mortgage-statement.pdf", documentType: "mortgage_statement", uploadedAt: now, confidence: 0.92 },
    superBalance: { documentId: "demo-super", fileName: "synthetic-super-statement.pdf", documentType: "super_statement", uploadedAt: now, confidence: 0.91 },
    monthlySpending: { documentId: "demo-bank", fileName: "synthetic-bank-statement.pdf", documentType: "bank_statement", uploadedAt: now, confidence: 0.93 },
    recurringSubscriptions: { documentId: "demo-bank", fileName: "synthetic-bank-statement.pdf", documentType: "bank_statement", uploadedAt: now, confidence: 0.93 },
    assets: { documentId: "demo-bank", fileName: "synthetic-bank-statement.pdf", documentType: "bank_statement", uploadedAt: now, confidence: 0.93 },
    liabilities: { documentId: "demo-mortgage", fileName: "synthetic-mortgage-statement.pdf", documentType: "mortgage_statement", uploadedAt: now, confidence: 0.92 },
  };
  const borrowing = calculateBorrowingCapacity(profile);
  const refinance = detectRefinanceOpportunities(profile);
  const savings = detectSavingsOpportunities(profile);
  return {
    uploaded_documents: documents,
    financial_profile: profile,
    borrowing_capacity: borrowing,
    refinance_opportunities: refinance,
    savings_opportunities: savings,
    lender_pack: buildLenderPack(documents, profile, borrowing, refinance, savings),
  };
}
