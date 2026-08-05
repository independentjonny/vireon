import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import type { HousingScenarioInput, PurchaseState } from "@/lib/housingAffordabilityTypes";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

const states: PurchaseState[] = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseInput(payload: Record<string, unknown>): HousingScenarioInput {
  const purchaseState = states.includes(payload.purchaseState as PurchaseState) ? (payload.purchaseState as PurchaseState) : "NSW";
  return {
    propertyPrice: numberValue(payload.propertyPrice, 1300000),
    deposit: numberValue(payload.deposit, 250000),
    purchaseState,
    estimatedInterestRate: numberValue(payload.estimatedInterestRate, 6.24),
    loanTermYears: numberValue(payload.loanTermYears, 30),
    stampDutyOverride: payload.stampDutyOverride === null || payload.stampDutyOverride === "" ? null : numberValue(payload.stampDutyOverride, 0),
    expectedRentalIncome: numberValue(payload.expectedRentalIncome, 0),
    partnerIncome: numberValue(payload.partnerIncome, 0),
    futureSalaryIncrease: numberValue(payload.futureSalaryIncrease, 0),
  };
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const core = createCoreDecisioningServiceFromEnv();
  return Response.json({
    ok: true,
    housing: await core.readHousingAffordability(auth.session),
    openAiAvailable: Boolean(process.env.OPENAI_API_KEY),
  });
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const current = auth.session;
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  if (payload.action === "generate-report") {
    const scenarioId = typeof payload.scenarioId === "string" ? payload.scenarioId : "";
    return Response.json({ ok: true, housing: await createCoreDecisioningServiceFromEnv().generateHousingReport(current, scenarioId) });
  }

  const input = parseInput(payload);
  if (input.propertyPrice <= 0 || input.deposit < 0 || input.loanTermYears <= 0 || input.estimatedInterestRate <= 0) {
    return Response.json({ ok: false, error: "Scenario inputs must be positive numbers." }, { status: 400 });
  }

  const housing = await createCoreDecisioningServiceFromEnv().createHousingScenario(current, input);
  return Response.json({ ok: true, housing });
}
