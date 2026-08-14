import AppShell from "../../components/AppShell";
import AddFinancialDataClient from "../../components/AddFinancialDataClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";

export const dynamic = "force-dynamic";

export default async function AddFinancialDataPage() {
  await requireServerPageSession("/financial-profile/add-data");

  return (
    <AppShell active="financial-data">
      <AddFinancialDataClient />
    </AppShell>
  );
}
