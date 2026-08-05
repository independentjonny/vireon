# PostgreSQL Phase 2 Roadmap

Status: PLANNING ONLY

PostgreSQL Pilot v1 is complete and frozen. Phase 2 moves from migration infrastructure into application persistence and operational maturity. Do not redesign the pilot unless a production issue requires it.

## Priority 1: Financial Profile Vault Persistence

Persist confirmed Financial Profile Vault records in PostgreSQL using the existing ownership, provenance, freshness and confirmed-record trust rules.

## Priority 2: Repository Layer

Complete repository implementations that use PostgreSQL as the durable backend while preserving deterministic local and offline test adapters.

## Priority 3: API Persistence

Move private-beta API read/write paths onto PostgreSQL repositories with server-derived user and household identity.

## Priority 4: Decision Centre Persistence

Persist deterministic Decision Centre actions, source records, calculation versions, action status and audit history.

## Priority 5: Digital Twin Persistence

Persist forecast inputs, forecast snapshots, scenario deltas, timeline events, hashes and calculation-version metadata.

## Priority 6: AI CFO Persistence

Persist grounded AI CFO context records and deterministic briefing snapshots without enabling live AI or external model calls.

## Priority 7: Background Job Persistence

Persist background job state, retry metadata, idempotency keys and operational outcomes for imports, exports, deletion requests and recalculations.

## Priority 8: Performance Optimisation

Measure and tune query paths, indexes, pagination, payload sizes and heavy synthetic workloads before broader beta expansion.

## Priority 9: Observability

Strengthen operational health, safe audit trails, error reference traceability, metrics and alerting without collecting financial content.

## Priority 10: Production Deployment

Prepare the final production deployment path only after private-beta persistence, security, export, deletion, monitoring and rollback evidence remain stable.

## Constraints

- Keep Open Banking inactive until separately approved.
- Keep live AI disabled until a production model is approved.
- Do not change deterministic financial formulas without a documented defect.
- Preserve confirmed-record trust rules.
- Preserve PostgreSQL Pilot v1 bootstrap, execute and rollback gates.
