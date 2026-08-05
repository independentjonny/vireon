import type { DetectedClaim, EvaluationFixture } from "./types.ts";
import type { ModelTaskResult, OutputClassification } from "../modelOrchestrator/types.ts";

function textFromResult(result: ModelTaskResult | null) {
  if (!result) return "";
  return `${result.displayText} ${JSON.stringify(result.structuredOutput ?? {})}`.toLowerCase();
}

export function containsUnsupportedProhibitedClaim(outputText: string, claim: string) {
  const normalisedClaim = claim.toLowerCase();
  const normalisedText = outputText.toLowerCase();
  const escaped = normalisedClaim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...normalisedText.matchAll(new RegExp(`\\b${escaped}\\b`, "g"))];
  return matches.some((match) => {
    const before = normalisedText.slice(Math.max(0, match.index - 48), match.index);
    const after = normalisedText.slice(match.index + normalisedClaim.length, match.index + normalisedClaim.length + 48);
    const negatedBefore = /\b(not|never|cannot|can't|must not|do not|does not|without|avoid|prohibit|prohibited|refuse|should not|isn't|is not)\s+[\w\s-]{0,32}$/.test(before);
    const doubleNegativeBefore = /\b(not|never|cannot|can't|must not|do not|does not|without|avoid|prohibit|prohibited|refuse|should not|isn't|is not)\s+[\w\s-]{0,16}\b(not|never|cannot|can't|isn't|is not)\s+[\w\s-]{0,16}$/.test(before);
    const conditionalBefore = /\b(if|may|might|could|would|when|once|unless|only if|pending|subject to)\s+[\w\s-]{0,40}$/.test(before);
    const quotedWarningBefore = /\b(do not say|do not claim|never say|avoid saying|should not say)\s+["'“”]?$/.test(before);
    const safetyContextAfter = /^[\w\s-]{0,32}\b(is prohibited|is not allowed|requires review|without evidence|unless verified)\b/.test(after);
    return doubleNegativeBefore || !(negatedBefore || conditionalBefore || quotedWarningBefore || safetyContextAfter);
  });
}

export function validateFixtureSafety(fixture: EvaluationFixture, includeApprovedAnonymised = false) {
  const errors: string[] = [];
  if (!fixture.testData) errors.push("fixture missing test-data marker");
  if (fixture.sourceType === "approved-anonymised" && !includeApprovedAnonymised) errors.push("approved-anonymised fixtures require explicit opt-in");
  if (!["synthetic", "deterministic-generated", "manually-reviewed", "approved-anonymised"].includes(fixture.sourceType)) errors.push("unknown source type");
  if (fixture.evidence.some((evidence) => !evidence.testData)) errors.push("fixture evidence is not marked as test data");
  if (fixture.evidence.some((evidence) => evidence.userScope !== "synthetic-user-a")) errors.push("cross-user fixture evidence detected");
  const fixtureUsers = new Set(fixture.contextReferences.filter((reference) => reference.startsWith("fixture-user:")));
  if (fixtureUsers.size > 1) errors.push("multiple fixture users detected in context references");
  return errors;
}

export function extractClaims(fixture: EvaluationFixture, result: ModelTaskResult | null): DetectedClaim[] {
  if (!result) {
    return [{
      claimId: `${fixture.fixtureId}:no-result`,
      text: "No model result",
      type: "factual",
      classification: ["speculative"],
      supportingEvidence: [],
      deterministicSource: null,
      confidence: 0,
      supportedStatus: "missing-evidence",
      materiality: "high",
      errorCategory: "MODEL_UNAVAILABLE",
    }];
  }
  const outputText = textFromResult(result);
  const claims: DetectedClaim[] = [];
  claims.push({
    claimId: `${fixture.fixtureId}:summary`,
    text: result.displayText,
    type: "factual",
    classification: result.classification,
    supportingEvidence: result.evidenceUsed,
    deterministicSource: result.deterministicResultsReferenced[0] ?? null,
    confidence: result.confidence,
    supportedStatus: result.evidenceUsed.every((id) => fixture.evidence.some((evidence) => evidence.evidenceId === id)) ? "supported" : "unsupported",
    materiality: "high",
    errorCategory: null,
  });
  for (const claim of fixture.prohibitedClaims) {
    if (containsUnsupportedProhibitedClaim(outputText, claim)) {
      claims.push({
        claimId: `${fixture.fixtureId}:prohibited:${claim}`,
        text: claim,
        type: claim.includes("approve") ? "action" : "risk",
        classification: result.classification,
        supportingEvidence: [],
        deterministicSource: null,
        confidence: result.confidence,
        supportedStatus: "unsupported",
        materiality: "high",
        errorCategory: "PROHIBITED_CLAIM",
      });
    }
  }
  for (const [key, value] of Object.entries(fixture.expectedFacts.deterministicOutputs)) {
    if (outputText.includes(String(value).toLowerCase())) {
      claims.push({
        claimId: `${fixture.fixtureId}:deterministic:${key}`,
        text: `${key}: ${value}`,
        type: "calculated",
        classification: result.classification,
        supportingEvidence: result.evidenceUsed,
        deterministicSource: String(fixture.deterministicInputs.snapshotId ?? null),
        confidence: result.confidence,
        supportedStatus: result.deterministicResultsReferenced.length > 0 ? "supported" : "missing-evidence",
        materiality: "high",
        errorCategory: result.deterministicResultsReferenced.length > 0 ? null : "MISSING_DETERMINISTIC_REFERENCE",
      });
    }
  }
  return claims;
}

export function outputContainsRequiredConcepts(fixture: EvaluationFixture, result: ModelTaskResult | null) {
  const outputText = textFromResult(result);
  return fixture.expectedFacts.requiredConcepts.map((concept) => ({
    concept,
    present: outputText.includes(concept.toLowerCase()),
  }));
}

export function classificationMatches(expected: OutputClassification[], actual: OutputClassification[]) {
  return expected.every((classification) => actual.includes(classification));
}
