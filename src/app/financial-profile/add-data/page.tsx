import AppShell from "../../components/AppShell";
import AddFinancialDataClient from "../../components/AddFinancialDataClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { buildAddFinancialDataSummary, buildExistingPropertyDraft } from "@/lib/addFinancialDataStatus";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";

export const dynamic = "force-dynamic";

export default async function AddFinancialDataPage({ searchParams }: { searchParams: Promise<{ category?: string; propertyId?: string }> }) {
  const params = await searchParams;
  const session = await requireServerPageSession("/financial-profile/add-data");
  const position = await createFinancialPositionReadServiceFromEnv().read(session);
  const summary = buildAddFinancialDataSummary(position);
  const existingProperty = buildExistingPropertyDraft(position, params.propertyId);

  return (
    <AppShell active="financial-data">
      <AddFinancialDataClient summary={summary} existingProperty={existingProperty} />
    </AppShell>
  );
}
