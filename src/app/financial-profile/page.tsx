import AppShell from "../components/AppShell";
import BaselineFinancialPosition from "../components/BaselineFinancialPosition";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";

export const dynamic = "force-dynamic";

export default async function FinancialPositionPage() {
  const session = await requireServerPageSession("/financial-profile");
  const position = await createFinancialPositionReadServiceFromEnv().read(session);

  return (
    <AppShell active="financial-position">
      <BaselineFinancialPosition position={position} />
    </AppShell>
  );
}
