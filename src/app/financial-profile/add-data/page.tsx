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
  const savedProperties = position.propertyDetails
    .map((property) => buildExistingPropertyDraft(position, property.id))
    .filter((property): property is NonNullable<typeof property> => property !== null);
  const existingProperty = params.propertyId
    ? savedProperties.find((property) => property.recordId === params.propertyId) ?? null
    : savedProperties[0] ?? null;

  return (
    <AppShell active="financial-data">
      <AddFinancialDataClient summary={summary} existingProperty={existingProperty} savedProperties={savedProperties} />
    </AppShell>
  );
}
