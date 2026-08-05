import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { buildAiDecisions } from "@/lib/aiDecisionCentre";
import { getFinancialBalanceSheet } from "@/lib/financialBalanceSheet";
import { createDemoFinancialVaultState } from "@/lib/financialVaultEmptyState";
import { getHousingAffordabilityState } from "@/lib/housingAffordabilityStore";
import {
  ActionWorkflowEngine,
  WorkflowExecutionEngine,
  type ActionWorkflowExecution,
  type ActionWorkflow,
  type ActionWorkflowStepStatus,
  type WorkflowEvidenceInput,
  type WorkflowArtefact,
  type ActionWorkflowSummary,
} from "@/lib/actionWorkflows";
import type { AiDecision } from "@/lib/aiDecisionCentre";
import type { FinancialVaultState } from "@/lib/financialVaultTypes";

export type ActionWorkflowPersistedState = {
  workflows: ActionWorkflow[];
  executions: ActionWorkflowExecution[];
  lastSyncedAt: string;
};

const DATA_DIR = join(process.cwd(), ".ai", "local-data");
const WORKFLOW_FILE = "action-workflows.json";

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(): string {
  if (process.env.VIREON_ACTION_WORKFLOW_STORE_FILE) return process.env.VIREON_ACTION_WORKFLOW_STORE_FILE;
  ensureDataDir();
  return join(DATA_DIR, WORKFLOW_FILE);
}

function nowIso(): string {
  return new Date().toISOString();
}

export function gatherWorkflowDecisions(vault: FinancialVaultState = createDemoFinancialVaultState()): AiDecision[] {
  const housing = getHousingAffordabilityState(vault);
  const balanceSheet = getFinancialBalanceSheet();
  return buildAiDecisions({ vault, housing, balanceSheet });
}

function emptyState(): ActionWorkflowPersistedState {
  return { workflows: [], executions: [], lastSyncedAt: nowIso() };
}

export function writeActionWorkflowState(state: ActionWorkflowPersistedState): void {
  writeFileSync(filePath(), JSON.stringify(state, null, 2), "utf-8");
}

export function getRawActionWorkflowState(): ActionWorkflowPersistedState {
  const path = filePath();
  if (!existsSync(path)) {
    const state = emptyState();
    writeActionWorkflowState(state);
    return state;
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as Partial<ActionWorkflowPersistedState>;
    return {
      workflows: parsed.workflows ?? [],
      executions: parsed.executions ?? [],
      lastSyncedAt: parsed.lastSyncedAt ?? nowIso(),
    };
  } catch {
    const state = emptyState();
    writeActionWorkflowState(state);
    return state;
  }
}

function mergeExecutions(decisions: AiDecision[], existing: ActionWorkflowExecution[], now: string): ActionWorkflowExecution[] {
  const byDecision = new Map(existing.map((execution) => WorkflowExecutionEngine.normalise(execution)).map((execution) => [execution.sourceDecisionId, execution]));
  return decisions.map((decision) => byDecision.get(decision.id) ?? WorkflowExecutionEngine.createFromDecision(decision, now));
}

export function getActionWorkflowState(decisions = gatherWorkflowDecisions()): { workflows: ActionWorkflow[]; executions: ActionWorkflowExecution[]; decisions: AiDecision[]; summary: ActionWorkflowSummary; lastSyncedAt: string } {
  const current = getRawActionWorkflowState();
  const now = nowIso();
  const executions = mergeExecutions(decisions, current.executions, now);
  const workflows = ActionWorkflowEngine.merge(decisions, executions.map(WorkflowExecutionEngine.toWorkflow), now);
  const next = { workflows, executions, lastSyncedAt: now };
  writeActionWorkflowState(next);
  return {
    workflows,
    executions,
    decisions,
    summary: ActionWorkflowEngine.summarise(workflows, decisions),
    lastSyncedAt: next.lastSyncedAt,
  };
}

export function updateActionWorkflowStep(workflowId: string, stepId: string, status: ActionWorkflowStepStatus): ActionWorkflowPersistedState {
  const current = getActionWorkflowState();
  const executionId = workflowId.replace(/^workflow-/, "execution-");
  const executions = current.executions.map((execution) => execution.id === executionId ? WorkflowExecutionEngine.transitionStep(execution, stepId, status, "user", nowIso()).execution : execution);
  const workflows = executions.map(WorkflowExecutionEngine.toWorkflow);
  const next = { workflows, executions, lastSyncedAt: nowIso() };
  writeActionWorkflowState(next);
  return next;
}

export function dismissActionWorkflow(workflowId: string): ActionWorkflowPersistedState {
  const current = getActionWorkflowState();
  const now = nowIso();
  const executionId = workflowId.replace(/^workflow-/, "execution-");
  const executions = current.executions.map((execution) => execution.id === executionId ? WorkflowExecutionEngine.normalise({ ...execution, status: "Cancelled" as const, executionStatus: "Cancelled" as const, lastUpdatedAt: now, auditEvents: [{ id: `audit-cancelled-${now.replace(/[^0-9]/g, "").slice(0, 14)}`, at: now, eventType: "cancelled" as const, summary: "Workflow cancelled by user.", immutable: true, supersedesEventId: null }, ...execution.auditEvents] }) : execution);
  const workflows = executions.map(WorkflowExecutionEngine.toWorkflow);
  const next = { workflows, executions, lastSyncedAt: now };
  writeActionWorkflowState(next);
  return next;
}

export function addActionWorkflowEvidence(workflowId: string, evidence: WorkflowEvidenceInput): ActionWorkflowPersistedState {
  const current = getActionWorkflowState();
  const executionId = workflowId.replace(/^workflow-/, "execution-");
  const executions = current.executions.map((execution) => execution.id === executionId ? WorkflowExecutionEngine.addEvidence(execution, evidence, "user", nowIso()).execution : execution);
  const next = { workflows: executions.map(WorkflowExecutionEngine.toWorkflow), executions, lastSyncedAt: nowIso() };
  writeActionWorkflowState(next);
  return next;
}

export function verifyActionWorkflowOutcome(workflowId: string, actualValue: number | null, evidenceIds: string[], recalculationSucceeded = true): ActionWorkflowPersistedState {
  const current = getActionWorkflowState();
  const executionId = workflowId.replace(/^workflow-/, "execution-");
  const executions = current.executions.map((execution) => execution.id === executionId ? WorkflowExecutionEngine.evaluateOutcome(execution, actualValue, evidenceIds, recalculationSucceeded, nowIso()) : execution);
  const next = { workflows: executions.map(WorkflowExecutionEngine.toWorkflow), executions, lastSyncedAt: nowIso() };
  writeActionWorkflowState(next);
  return next;
}

export function generateActionWorkflowArtefact(workflowId: string, type: WorkflowArtefact["type"]): ActionWorkflowPersistedState {
  const current = getActionWorkflowState();
  const executionId = workflowId.replace(/^workflow-/, "execution-");
  const executions = current.executions.map((execution) => execution.id === executionId ? WorkflowExecutionEngine.generateArtefact(execution, type, nowIso()) : execution);
  const next = { workflows: executions.map(WorkflowExecutionEngine.toWorkflow), executions, lastSyncedAt: nowIso() };
  writeActionWorkflowState(next);
  return next;
}
