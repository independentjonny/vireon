export type ModelProvider = "openai" | "anthropic" | "gemini" | "deterministic" | "mock" | "disabled";
export type ProviderAvailability = "available" | "degraded" | "unavailable";
export type ProviderHealthStatus = "healthy" | "degraded" | "unhealthy" | "disabled";
export type RelativeCostClass = "free" | "low" | "medium" | "high";
export type RelativeLatencyClass = "fast" | "normal" | "slow";
export type DataSensitivity = "public" | "internal" | "personal" | "financial-sensitive" | "identity-sensitive" | "highly-restricted";
export type ModelRiskLevel = "low" | "medium" | "high" | "critical";
export type AutonomyLevel = "none" | "inform-only" | "prepare" | "execute-after-approval" | "fully-automatic";
export type ServiceClass = "interactive" | "normal" | "background" | "batch";
export type ModelRunStatus = "succeeded" | "blocked" | "failed" | "cancelled" | "provider-unavailable" | "validation-failed" | "budget-blocked" | "incomplete";
export type OutputClassification = "deterministic" | "calculated" | "evidence-backed" | "estimated" | "speculative" | "professional-review-required";
export type CircuitBreakerState = "closed" | "open" | "half-open" | "disabled";
export type ModelPromotionState = "unconfigured" | "experimental" | "evaluation" | "approved" | "preferred" | "deprecated" | "disabled";
export type ModelExecutionMode = "PRODUCTION" | "INTERNAL_EVALUATION" | "OFFLINE_TEST" | "MOCK";

export type ModelTaskType =
  | "conversational-answer"
  | "financial-synthesis"
  | "document-extraction"
  | "document-summary"
  | "financial-document-analysis"
  | "plan-generation"
  | "recommendation-drafting"
  | "recommendation-critique"
  | "workflow-planning"
  | "scenario-explanation"
  | "timeline-explanation"
  | "anomaly-explanation"
  | "structured-classification"
  | "evidence-mapping"
  | "rule-grounding"
  | "user-communication"
  | "deterministic-calculation"
  | "verification-review";

export type ModelCapability =
  | "text"
  | "vision"
  | "documents"
  | "structured-output"
  | "tool-calling"
  | "long-context"
  | "reasoning"
  | "streaming"
  | "batch"
  | "deterministic-engine";

export type ModelErrorCode =
  | "PROVIDER_NOT_CONFIGURED"
  | "MODEL_NOT_AVAILABLE"
  | "MODEL_NOT_REGISTERED"
  | "MODEL_UNHEALTHY"
  | "MODEL_RESTRICTED_PRODUCTION"
  | "MODEL_NOT_ELIGIBLE_FOR_EVALUATION"
  | "EVALUATION_ENVIRONMENT_MISSING"
  | "CANDIDATE_CONTEXT_MISSING"
  | "EXECUTION_ENVELOPE_MISMATCH"
  | "CHILD_PROCESS_CONFIGURATION_MISMATCH"
  | "TASK_RESTRICTED_PRODUCTION"
  | "TASK_NOT_ELIGIBLE_FOR_EVALUATION"
  | "PROVIDER_UNAVAILABLE"
  | "CAPABILITY_UNAVAILABLE"
  | "POLICY_BLOCKED"
  | "SENSITIVITY_BLOCKED"
  | "BUDGET_EXCEEDED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "CONTEXT_TOO_LARGE"
  | "INVALID_STRUCTURED_OUTPUT"
  | "VALIDATION_FAILED"
  | "REVIEW_FAILED"
  | "DETERMINISTIC_ENGINE_FAILED"
  | "FALLBACK_EXHAUSTED"
  | "CANCELLED"
  | "INTERNAL_ORCHESTRATOR_ERROR";

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  retryableErrors: ModelErrorCode[];
};

export type JsonSchema = {
  type: "object";
  required?: string[];
  additionalProperties?: boolean;
  properties: Record<string, { type: "string" | "number" | "boolean" | "array" | "object"; enum?: string[]; items?: Record<string, unknown> }>;
};

export type PromptEnvelope = {
  systemPolicy: string;
  taskInstruction: string;
  userGoal: string;
  relevantFinancialContext: Record<string, unknown>;
  deterministicOutputs: Record<string, unknown>;
  evidence: string[];
  rulesAndProvenance: string[];
  missingInformation: string[];
  permittedTools: string[];
  prohibitedBehaviours: string[];
  outputSchema: JsonSchema | null;
  confidenceRequirements: string[];
};

export type ModelTaskRequest = {
  taskId: string;
  userId: string;
  sessionId: string;
  correlationId: string;
  taskType: ModelTaskType;
  purpose: string;
  sensitivity: DataSensitivity;
  riskLevel: ModelRiskLevel;
  autonomyLevel: AutonomyLevel;
  serviceClass?: ServiceClass;
  requiredCapabilities: ModelCapability[];
  preferredCapabilities: ModelCapability[];
  prohibitedProviders: ModelProvider[];
  permittedProviders: ModelProvider[] | null;
  permittedModels?: string[] | null;
  contextReferences: string[];
  evidenceReferences: string[];
  inputPayload: Record<string, unknown>;
  outputSchema: JsonSchema | null;
  maximumCost: number;
  maximumLatencyMs: number;
  minimumConfidence: number;
  professionalReviewRequired: boolean;
  deterministicEngineRequired: boolean;
  fallbackAllowed: boolean;
  retryPolicy: RetryPolicy;
  createdAt: string;
  executionMode?: ModelExecutionMode;
};

export type ModelTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type ValidationResult = {
  name: string;
  passed: boolean;
  detail: string;
};

export type ModelTaskResult = {
  taskId: string;
  runId: string;
  provider: ModelProvider;
  model: string;
  modelVersionOrAlias: string;
  status: ModelRunStatus;
  structuredOutput: Record<string, unknown> | null;
  displayText: string;
  evidenceUsed: string[];
  evidenceMissing: string[];
  assumptions: string[];
  confidence: number;
  classification: OutputClassification[];
  professionalReviewRequired: boolean;
  deterministicResultsReferenced: string[];
  validationResults: ValidationResult[];
  fallbackHistory: RoutingFallbackRecord[];
  tokenUsage: ModelTokenUsage;
  estimatedCost: number;
  latencyMs: number;
  startedAt: string;
  completedAt: string;
  correlationId: string;
  auditReference: string;
  errorCode: ModelErrorCode | null;
};

export type ModelRecord = {
  provider: ModelProvider;
  model: string;
  enabled: boolean;
  availability: ProviderAvailability;
  supportsText: boolean;
  supportsVision: boolean;
  supportsDocuments: boolean;
  supportsStructuredOutput: boolean;
  supportsToolCalling: boolean;
  supportsLongContext: boolean;
  supportsReasoning: boolean;
  supportsStreaming: boolean;
  supportsBatch: boolean;
  maximumInputTokens: number;
  maximumOutputTokens: number;
  relativeCostClass: RelativeCostClass;
  relativeLatencyClass: RelativeLatencyClass;
  dataRegion: string;
  retentionPolicy: string;
  approvedSensitivityLevels: DataSensitivity[];
  approvedTaskTypes: ModelTaskType[];
  healthStatus: ProviderHealthStatus;
  lastHealthCheck: string;
  configurationSource: string;
  promotionState: ModelPromotionState;
};

export type RejectedCandidate = {
  provider: ModelProvider;
  model: string;
  reasons: string[];
};

export type RoutingDecision = {
  selectedProvider: ModelProvider | null;
  selectedModel: string | null;
  routingScore: number;
  routingReasons: string[];
  rejectedCandidates: RejectedCandidate[];
  fallbackCandidates: ModelRecord[];
  policyVersion: string;
};

export type RoutingFallbackRecord = {
  provider: ModelProvider;
  model: string;
  reason: string;
  at: string;
};

export type ModelAdapterEstimate = {
  estimatedCost: number;
  estimatedLatencyMs: number;
  estimatedTokens: number;
};

export interface ModelProviderAdapter {
  provider: ModelProvider;
  healthCheck(): Promise<ProviderHealthStatus>;
  estimate(request: ModelTaskRequest, model: ModelRecord): Promise<ModelAdapterEstimate>;
  execute(request: ModelTaskRequest, model: ModelRecord, prompt: PromptEnvelope): Promise<ModelTaskResult>;
  stream?(request: ModelTaskRequest, model: ModelRecord, prompt: PromptEnvelope): AsyncIterable<string>;
  cancel?(runId: string): Promise<boolean>;
  normalizeResult(raw: unknown, request: ModelTaskRequest, model: ModelRecord): ModelTaskResult;
  classifyError(error: unknown): ModelErrorCode;
  supports(model: ModelRecord, capability: ModelCapability): boolean;
}

export type ModelRunRecord = {
  runId: string;
  userId: string;
  taskId: string;
  correlationId: string;
  provider: ModelProvider;
  model: string;
  status: ModelRunStatus;
  promptHash: string;
  responseHash: string | null;
  rawPromptStored: false;
  rawResponseStored: false;
  routingDecision: RoutingDecision;
  result: ModelTaskResult | null;
  createdAt: string;
};

export type ModelAuditEvent = {
  id: string;
  runId: string;
  eventType:
    | "route-selected"
    | "provider-attempted"
    | "provider-failed"
    | "fallback-selected"
    | "validation-failed"
    | "review-completed"
    | "execution-blocked"
    | "budget-blocked"
    | "user-approval-requested"
    | "final-result-accepted";
  summary: string;
  correlationId: string;
  createdAt: string;
  immutable: true;
};
