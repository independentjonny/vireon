import AppShell from "../components/AppShell";
import BaselineCashFlow from "../components/BaselineCashFlow";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";

export const dynamic = "force-dynamic";

export default async function CashFlowPage() {
  const session = await requireServerPageSession("/cash-flow");
  const position = await createFinancialPositionReadServiceFromEnv().read(session);
  return <AppShell active="workspace"><BaselineCashFlow cashFlow={position.monthlyCashFlow} /></AppShell>;
}
