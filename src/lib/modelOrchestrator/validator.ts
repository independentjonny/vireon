import type { JsonSchema, ModelTaskRequest, ModelTaskResult, OutputClassification, ValidationResult } from "./types.ts";

const allowedClassifications: OutputClassification[] = ["deterministic", "calculated", "evidence-backed", "estimated", "speculative", "professional-review-required"];
const prohibitedStructuredFields = ["verified", "realisedImpact", "calculationSnapshot", "auditHistory", "timelineHistory", "mutateFinancialFact"];

export const MODEL_OUTPUT_SCHEMAS: Record<string, JsonSchema> = {
  FinancialSynthesis: {
    type: "object",
    required: ["summary", "evidenceIds", "classification", "confidence"],
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      evidenceIds: { type: "array" },
      classification: { type: "array" },
      confidence: { type: "number" },
    },
  },
  DocumentExtraction: {
    type: "object",
    required: ["fields", "evidenceIds", "confidence"],
    additionalProperties: false,
    properties: {
      fields: { type: "object" },
      evidenceIds: { type: "array" },
      confidence: { type: "number" },
    },
  },
  RecommendationDraft: {
    type: "object",
    required: ["recommendation", "evidenceIds", "risks", "classification"],
    additionalProperties: false,
    properties: {
      recommendation: { type: "string" },
      evidenceIds: { type: "array" },
      risks: { type: "array" },
      classification: { type: "array" },
    },
  },
  RecommendationReview: {
    type: "object",
    required: ["accepted", "unsupportedClaims", "professionalReviewRequired"],
    additionalProperties: false,
    properties: {
      accepted: { type: "boolean" },
      unsupportedClaims: { type: "array" },
      professionalReviewRequired: { type: "boolean" },
    },
  },
  Plan: {
    type: "object",
    required: ["strategy", "tasks", "verification"],
    additionalProperties: false,
    properties: {
      strategy: { type: "string" },
      tasks: { type: "array" },
      verification: { type: "array" },
    },
  },
  WorkflowProposal: {
    type: "object",
    required: ["workflowTitle", "steps", "evidenceRequired"],
    additionalProperties: false,
    properties: {
      workflowTitle: { type: "string" },
      steps: { type: "array" },
      evidenceRequired: { type: "array" },
    },
  },
  EvidenceMap: {
    type: "object",
    required: ["evidenceIds", "claims"],
    additionalProperties: false,
    properties: {
      evidenceIds: { type: "array" },
      claims: { type: "array" },
    },
  },
  AnomalyExplanation: {
    type: "object",
    required: ["explanation", "expectedRange", "actualValue"],
    additionalProperties: false,
    properties: {
      explanation: { type: "string" },
      expectedRange: { type: "string" },
      actualValue: { type: "number" },
    },
  },
  TimelineExplanation: {
    type: "object",
    required: ["whatChanged", "why", "evidenceIds"],
    additionalProperties: false,
    properties: {
      whatChanged: { type: "string" },
      why: { type: "string" },
      evidenceIds: { type: "array" },
    },
  },
  UserBriefing: {
    type: "object",
    required: ["headline", "summary", "actions"],
    additionalProperties: false,
    properties: {
      headline: { type: "string" },
      summary: { type: "string" },
      actions: { type: "array" },
    },
  },
  VerificationReview: {
    type: "object",
    required: ["result", "evidenceIds", "confidence"],
    additionalProperties: false,
    properties: {
      result: { type: "string" },
      evidenceIds: { type: "array" },
      confidence: { type: "number" },
    },
  },
};

function matchesType(value: unknown, expected: string) {
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  return typeof value === expected;
}

export function validateStructuredOutput(schema: JsonSchema | null, output: Record<string, unknown> | null): ValidationResult[] {
  if (!schema) return [{ name: "schema", passed: true, detail: "No structured schema required." }];
  if (!output) return [{ name: "schema", passed: false, detail: "Structured output missing." }];
  const results: ValidationResult[] = [];
  for (const field of schema.required ?? []) {
    results.push({ name: `required:${field}`, passed: Object.hasOwn(output, field), detail: Object.hasOwn(output, field) ? "present" : "missing" });
  }
  for (const [key, value] of Object.entries(output)) {
    const prop = schema.properties[key];
    if (!prop) {
      results.push({ name: `field:${key}`, passed: schema.additionalProperties !== false, detail: "unknown field" });
      continue;
    }
    results.push({ name: `type:${key}`, passed: matchesType(value, prop.type), detail: `expected ${prop.type}` });
  }
  for (const field of prohibitedStructuredFields) {
    if (Object.hasOwn(output, field)) results.push({ name: `prohibited:${field}`, passed: false, detail: "models cannot set server-owned fields" });
  }
  return results;
}

export function validateModelResult(request: ModelTaskRequest, result: ModelTaskResult): ValidationResult[] {
  const validations: ValidationResult[] = [
    ...validateStructuredOutput(request.outputSchema, result.structuredOutput),
    {
      name: "confidence",
      passed: result.confidence >= 0 && result.confidence <= 1 && result.confidence >= request.minimumConfidence,
      detail: `confidence=${result.confidence}`,
    },
    {
      name: "classification",
      passed: result.classification.every((item) => allowedClassifications.includes(item)),
      detail: result.classification.join(", "),
    },
    {
      name: "professional-review",
      passed: !request.professionalReviewRequired || result.professionalReviewRequired || result.classification.includes("professional-review-required"),
      detail: request.professionalReviewRequired ? "required" : "not required",
    },
    {
      name: "evidence-references",
      passed: result.evidenceUsed.every((id) => request.evidenceReferences.includes(id)),
      detail: "used evidence must be provided by request",
    },
    {
      name: "claimed-calculations",
      passed: !result.classification.includes("calculated") || result.deterministicResultsReferenced.length > 0 || request.deterministicEngineRequired,
      detail: "calculated outputs require deterministic references",
    },
  ];
  return validations;
}

export function validationPassed(results: ValidationResult[]) {
  return results.every((item) => item.passed);
}
