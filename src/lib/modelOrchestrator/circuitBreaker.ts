import type { CircuitBreakerState, ModelErrorCode, ModelProvider } from "./types.ts";

export type CircuitBreakerRecord = {
  provider: ModelProvider;
  model: string;
  state: CircuitBreakerState;
  consecutiveFailures: number;
  rateLimitFailures: number;
  timeouts: number;
  malformedOutputRate: number;
  validationFailureRate: number;
  latencyDegraded: boolean;
  lastHealthCheck: string;
  reason: string | null;
};

export function initialCircuitBreaker(provider: ModelProvider, model: string): CircuitBreakerRecord {
  return {
    provider,
    model,
    state: provider === "disabled" ? "disabled" : "closed",
    consecutiveFailures: 0,
    rateLimitFailures: 0,
    timeouts: 0,
    malformedOutputRate: 0,
    validationFailureRate: 0,
    latencyDegraded: false,
    lastHealthCheck: "not-run",
    reason: null,
  };
}

export function recordCircuitBreakerFailure(record: CircuitBreakerRecord, errorCode: ModelErrorCode): CircuitBreakerRecord {
  const next = { ...record, consecutiveFailures: record.consecutiveFailures + 1 };
  if (errorCode === "RATE_LIMITED") next.rateLimitFailures += 1;
  if (errorCode === "TIMEOUT") next.timeouts += 1;
  if (errorCode === "INVALID_STRUCTURED_OUTPUT") next.validationFailureRate = Math.min(1, next.validationFailureRate + 0.25);
  if (next.consecutiveFailures >= 3 || next.rateLimitFailures >= 3 || next.timeouts >= 2 || next.validationFailureRate >= 0.5) {
    next.state = "open";
    next.reason = `opened after ${next.consecutiveFailures} consecutive failures`;
  }
  return next;
}

export function recordCircuitBreakerSuccess(record: CircuitBreakerRecord): CircuitBreakerRecord {
  return {
    ...record,
    state: record.state === "half-open" ? "closed" : record.state,
    consecutiveFailures: 0,
    reason: null,
  };
}

export function circuitBreakerAllows(record: CircuitBreakerRecord) {
  return record.state === "closed" || record.state === "half-open";
}
