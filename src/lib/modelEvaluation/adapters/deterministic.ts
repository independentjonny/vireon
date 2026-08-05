import type { EvaluationFixture, EvaluationRunOptions } from "../types.ts";
import { executeFixtureThroughOrchestrator } from "./orchestrator.ts";

export async function runDeterministicFixture(fixture: EvaluationFixture, options: EvaluationRunOptions = {}) {
  return executeFixtureThroughOrchestrator(fixture, { ...options, executionMode: options.executionMode ?? "deterministic-only", provider: "deterministic" });
}
