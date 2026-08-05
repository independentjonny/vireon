import AppShell from "../components/AppShell";
import StructureOptimiserClient from "../components/StructureOptimiserClient";
import { StructureComparisonEngine } from "@/lib/structureComparisonEngine";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";

export const dynamic = "force-dynamic";

export default async function StructureOptimiserPage() {
  const session = await requireServerPageSession();
  const vault = (await createFinancialPositionReadServiceFromEnv().read(session)).vault;
  const assumptions = StructureComparisonEngine.buildStructureAssumptionsFromVault(vault);

  return (
    <AppShell active="workspace">
      <StructureOptimiserClient initialAssumptions={assumptions} />
    </AppShell>
  );
}
