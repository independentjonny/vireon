import AppShell from "@/app/components/AppShell";
import ForecastTimelineClient from "@/app/components/ForecastTimelineClient";
import { requireServerPageSession } from "@/lib/auth/serverPageSession";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export default async function DigitalTwinTimelinePage() {
  const session = await requireServerPageSession("/digital-twin/timeline");
  const core = createCoreDecisioningServiceFromEnv();
  let baseline;
  try {
    baseline = (await core.readFinancialForecast(session, "12m")).snapshot;
  } catch (error) {
    const safe = core.toSafeError(error);
    return (
      <AppShell active="digital-twin">
        <main className="mx-auto max-w-4xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <h1 className="text-2xl font-semibold">Forecast temporarily unavailable</h1>
          <p className="mt-3 text-sm leading-6">
            Vireon could not load persisted Financial Vault records or save the forecast snapshot. No local fallback was used, so try again once persistence is available.
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide">Reference: {safe.code}</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell active="digital-twin">
      <ForecastTimelineClient initialBaseline={baseline} />
    </AppShell>
  );
}
