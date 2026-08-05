import { createHash, randomUUID } from "crypto";
import type { ModelAuditEvent, ModelRunRecord, ModelTaskRequest, ModelTaskResult, PromptEnvelope, RoutingDecision } from "./types.ts";

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class InMemoryModelRunRepository {
  private runs = new Map<string, ModelRunRecord>();
  private auditEvents: ModelAuditEvent[] = [];

  createRun(input: { request: ModelTaskRequest; routingDecision: RoutingDecision; prompt: PromptEnvelope; provider: string; model: string; now: string }): ModelRunRecord {
    const runId = `model-run-${randomUUID()}`;
    const record: ModelRunRecord = {
      runId,
      userId: input.request.userId,
      taskId: input.request.taskId,
      correlationId: input.request.correlationId,
      provider: input.provider as ModelRunRecord["provider"],
      model: input.model,
      status: "incomplete",
      promptHash: hash(input.prompt),
      responseHash: null,
      rawPromptStored: false,
      rawResponseStored: false,
      routingDecision: input.routingDecision,
      result: null,
      createdAt: input.now,
    };
    this.runs.set(runId, record);
    this.appendAudit(runId, "route-selected", `Selected ${input.provider}/${input.model}`, input.request.correlationId, input.now);
    return record;
  }

  completeRun(runId: string, result: ModelTaskResult): ModelRunRecord {
    const run = this.runs.get(runId);
    if (!run) throw new Error("Model run not found");
    const updated = { ...run, status: result.status, responseHash: hash(result.structuredOutput ?? result.displayText), result };
    this.runs.set(runId, updated);
    this.appendAudit(runId, result.status === "succeeded" ? "final-result-accepted" : "execution-blocked", `Final status ${result.status}`, result.correlationId, result.completedAt);
    return updated;
  }

  getRun(userId: string, runId: string): ModelRunRecord | null {
    const run = this.runs.get(runId);
    if (!run || run.userId !== userId) return null;
    return run;
  }

  listRuns(userId: string): ModelRunRecord[] {
    return [...this.runs.values()].filter((run) => run.userId === userId);
  }

  appendAudit(runId: string, eventType: ModelAuditEvent["eventType"], summary: string, correlationId: string, now: string): ModelAuditEvent {
    const event: ModelAuditEvent = {
      id: `model-audit-${randomUUID()}`,
      runId,
      eventType,
      summary,
      correlationId,
      createdAt: now,
      immutable: true,
    };
    this.auditEvents.push(event);
    return event;
  }

  listAudit(runId: string) {
    return this.auditEvents.filter((event) => event.runId === runId);
  }
}

export const modelRunRepository = new InMemoryModelRunRepository();

export function auditReference(runId: string) {
  return `model-audit:${runId}`;
}
