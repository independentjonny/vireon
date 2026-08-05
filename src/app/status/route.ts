import { hasLocalData } from "@/lib/localStore";
import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import { createFinancialPositionReadServiceFromEnv } from "@/server/services/financialPositionReadService";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const localData = hasLocalData();
  let readModel;
  try {
    readModel = await createFinancialPositionReadServiceFromEnv().read(auth.session);
  } catch {
    return Response.json({
      ok: false,
      app: "vireon",
      status: "financial-data-unavailable",
      localData,
      financialVault: {
        source: "PostgreSQL",
        unavailable: true,
      },
      checkedAt: new Date().toISOString(),
    }, { status: 503 });
  }
  const vault = readModel.vault;
  const housing = await createCoreDecisioningServiceFromEnv().readHousingAffordability(auth.session);

  return Response.json({
    ok: true,
    app: "vireon",
    status: "ok",
    localData,
    financialVault: {
      source: "PostgreSQL",
      documentsUploaded: vault.uploaded_documents.length,
      profileUpdatedAt: vault.financial_profile.lastUpdatedAt,
      lenderPackReadyItems: vault.lender_pack.documentChecklist.filter((item) => item.available).length,
      activeImportCount: readModel.documentImportStatus.activeImportCount,
      staleFactCount: readModel.staleDataSummary.staleFactCount,
    },
    housingScenarios: {
      scenarios: housing.housing_scenarios.length,
      readinessScore: housing.house_readiness_score.score,
      readinessBand: housing.house_readiness_score.band,
    },
    checkedAt: new Date().toISOString(),
  });
}
