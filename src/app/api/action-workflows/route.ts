import { NextRequest, NextResponse } from "next/server";
import type { ActionWorkflowStepStatus, WorkflowArtefact, WorkflowEvidenceInput } from "@/lib/actionWorkflows";
import { authErrorResponse, requireSession } from "@/lib/auth/middleware";
import { createCoreDecisioningServiceFromEnv } from "@/server/services/coreDecisioningPostgresService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const current = auth.session;
  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    service = createCoreDecisioningServiceFromEnv();
    return NextResponse.json(await service.readWorkflows(current));
  } catch (error) {
    const safe = service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable.", code: "POSTGRES_UNAVAILABLE", status: 503 };
    return NextResponse.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    workflowId?: string;
    stepId?: string;
    status?: ActionWorkflowStepStatus;
    dismiss?: boolean;
    evidence?: WorkflowEvidenceInput;
    verifyOutcome?: { actualValue: number | null; evidenceIds: string[]; recalculationSucceeded?: boolean };
    artefactType?: WorkflowArtefact["type"];
  };

  const auth = await requireSession(request);
  if (!auth.ok) return authErrorResponse(auth);
  const current = auth.session;
  let service: ReturnType<typeof createCoreDecisioningServiceFromEnv> | null = null;
  try {
    service = createCoreDecisioningServiceFromEnv();
    if (body.workflowId && body.dismiss) return NextResponse.json(await service.dismissWorkflow(current, body.workflowId));
    if (body.workflowId && body.stepId && body.status) return NextResponse.json(await service.updateWorkflowStep(current, body.workflowId, body.stepId, body.status));
    if (body.workflowId && body.evidence) return NextResponse.json(await service.addWorkflowEvidence(current, body.workflowId, body.evidence));
    if (body.workflowId && body.verifyOutcome) return NextResponse.json(await service.verifyWorkflowOutcome(current, body.workflowId, body.verifyOutcome.actualValue, body.verifyOutcome.evidenceIds, body.verifyOutcome.recalculationSucceeded === true));
    if (body.workflowId && body.artefactType) return NextResponse.json(await service.generateWorkflowArtefact(current, body.workflowId, body.artefactType));
    return NextResponse.json(await service.readWorkflows(current));
  } catch (error) {
    const safe = service?.toSafeError(error) ?? { message: "PostgreSQL persistence is unavailable.", code: "POSTGRES_UNAVAILABLE", status: 503 };
    return NextResponse.json({ ok: false, error: safe.message, code: safe.code }, { status: safe.status });
  }
}
