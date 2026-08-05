import type { NextRequest } from "next/server";
import type { Session } from "@/lib/auth/middleware";
import { authErrorResponse, requirePermission } from "@/lib/auth/middleware";
import { buildModelRegistry, diagnoseModelOrchestrator, estimateModelTask, executeModelTask, modelRunRepository, type ModelTaskRequest } from "@/lib/modelOrchestrator/index";
import { buildCanonicalModelRegistry, buildComparisonReadiness, buildProviderHealthReports, validateCanonicalModelRegistry } from "@/lib/modelOrchestrator/modelRegistry";

export function serverUser(session: Session) {
  return {
    userId: session.userId,
    sessionId: session.workspaceId,
    correlationId: `corr-${Date.now()}`,
  };
}

export function toTaskRequest(session: Session, body: Partial<ModelTaskRequest>): ModelTaskRequest {
  const user = serverUser(session);
  const now = new Date().toISOString();
  return {
    taskId: body.taskId || `task-${Date.now()}`,
    userId: user.userId,
    sessionId: user.sessionId,
    correlationId: body.correlationId || user.correlationId,
    taskType: body.taskType || "conversational-answer",
    purpose: body.purpose || "Model orchestrator task",
    sensitivity: body.sensitivity || "internal",
    riskLevel: body.riskLevel || "low",
    autonomyLevel: body.autonomyLevel || "none",
    serviceClass: body.serviceClass || "normal",
    requiredCapabilities: body.requiredCapabilities || ["text"],
    preferredCapabilities: body.preferredCapabilities || [],
    prohibitedProviders: body.prohibitedProviders || [],
    permittedProviders: body.permittedProviders ?? null,
    contextReferences: body.contextReferences || [],
    evidenceReferences: body.evidenceReferences || [],
    inputPayload: body.inputPayload || {},
    outputSchema: body.outputSchema || null,
    maximumCost: body.maximumCost ?? 0.5,
    maximumLatencyMs: body.maximumLatencyMs ?? 5000,
    minimumConfidence: body.minimumConfidence ?? 0.5,
    professionalReviewRequired: Boolean(body.professionalReviewRequired),
    deterministicEngineRequired: Boolean(body.deterministicEngineRequired || body.taskType === "deterministic-calculation"),
    fallbackAllowed: Boolean(body.fallbackAllowed),
    retryPolicy: body.retryPolicy || { maxAttempts: 1, baseDelayMs: 250, retryableErrors: ["RATE_LIMITED", "TIMEOUT"] },
    createdAt: body.createdAt || now,
  };
}

export async function executeFromRequest(request: NextRequest) {
  const auth = await requirePermission(request, "invoke:agents");
  if (!auth.ok) return authErrorResponse(auth);
  const body = await request.json().catch(() => ({}));
  const task = toTaskRequest(auth.session, body);
  const result = await executeModelTask(task);
  return Response.json({ ok: result.status === "succeeded", result });
}

export async function estimateFromRequest(request: NextRequest) {
  const auth = await requirePermission(request, "invoke:agents");
  if (!auth.ok) return authErrorResponse(auth);
  const body = await request.json().catch(() => ({}));
  const task = toTaskRequest(auth.session, body);
  const result = await estimateModelTask(task);
  return Response.json({ ok: Boolean(result.routing.selectedProvider), ...result });
}

export async function providersResponse(request: NextRequest) {
  const auth = await requirePermission(request, "manage:workspace");
  if (!auth.ok) return authErrorResponse(auth);
  const canonicalRegistry = buildCanonicalModelRegistry();
  return Response.json({
    ok: true,
    providers: buildModelRegistry(),
    canonicalRegistry,
    validation: validateCanonicalModelRegistry(canonicalRegistry),
    comparisonReadiness: buildComparisonReadiness(canonicalRegistry),
  });
}

export async function healthResponse(request: NextRequest) {
  const auth = await requirePermission(request, "manage:workspace");
  if (!auth.ok) return authErrorResponse(auth);
  return Response.json({
    ...diagnoseModelOrchestrator(),
    providerHealth: await buildProviderHealthReports(),
  });
}

export async function runResponse(request: NextRequest, runId: string) {
  const auth = await requirePermission(request, "invoke:agents");
  if (!auth.ok) return authErrorResponse(auth);
  const user = serverUser(auth.session);
  const run = modelRunRepository.getRun(user.userId, runId);
  if (!run) return Response.json({ ok: false, errorCode: "NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true, run });
}
