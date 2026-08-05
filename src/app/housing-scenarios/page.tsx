import AppShell from "../components/AppShell";
import HousingScenariosClient from "../components/HousingScenariosClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export default async function HousingScenariosPage() {
  const session = await requireServerPageSession();
  const housing = await createCoreDecisioningServiceFromEnv().readHousingAffordability(session);

  return (
    <AppShell active="housing-scenarios">
      <HousingScenariosClient initialHousing={housing} openAiAvailable={Boolean(process.env.OPENAI_API_KEY)} />
    </AppShell>
  );
}
