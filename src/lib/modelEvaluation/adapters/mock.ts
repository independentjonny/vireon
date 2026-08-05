import type { EvaluationFixture, EvaluationRunOptions } from "../types.ts";
import { executeFixtureThroughOrchestrator } from "./orchestrator.ts";

export async function runMockFixture(fixture: EvaluationFixture, options: EvaluationRunOptions = {}) {
  return executeFixtureThroughOrchestrator(fixture, { ...options, executionMode: options.executionMode ?? "offline-mock", provider: options.provider ?? "mock" });
}
