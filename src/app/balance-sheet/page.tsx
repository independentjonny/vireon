import AppShell from "../components/AppShell";
import FinancialBalanceSheet from "../components/FinancialBalanceSheet";
import { getFinancialBalanceSheet } from "@/lib/financialBalanceSheet";

export const dynamic = "force-dynamic";

export default function BalanceSheetPage() {
  return (
    <AppShell active="workspace">
      <FinancialBalanceSheet sheet={getFinancialBalanceSheet()} />
    </AppShell>
  );
}
