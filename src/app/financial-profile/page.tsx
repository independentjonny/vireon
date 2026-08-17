import AppShell from "../components/AppShell";
import FinancialProfileBuilderClient from "../components/FinancialProfileBuilderClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";

export const dynamic = "force-dynamic";

export default async function FinancialPositionPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const params = await searchParams;
  const session = await requireServerPageSession("/financial-profile");
  const position = await createFinancialPositionReadServiceFromEnv().read(session);

  return (
    <AppShell active="financial-position">
      <FinancialProfileBuilderClient position={position} savedProperty={params.saved === "property"} />
    </AppShell>
  );
}
