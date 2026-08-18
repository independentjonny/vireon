export const FINANCIAL_DATA_RESET_CONFIRMATION = "DELETE MY FINANCIAL DATA";

export type FinancialDataResetResult = {
  completedAt: string;
  deleted: {
    financialRecords: number;
    documentsAndEvidence: number;
    transactionsAndSubscriptions: number;
    calculationsAndReviews: number;
    decisionsGoalsAndWorkflows: number;
    financialOperations: number;
  };
  cancelledAccountDeletionRequests: number;
  retained: string[];
};

export function totalFinancialDataDeleted(result: FinancialDataResetResult): number {
  return Object.values(result.deleted).reduce((sum, value) => sum + value, 0);
}
