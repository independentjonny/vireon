# Digital Twin Persistence

Status: CORE DECISIONING DOMAIN COMPLETE

Target tables:

- `digital_twin_scenarios`
- `simulation_runs`
- `timeline_events`
- `calculation_snapshots`

Digital Twin scenarios, deterministic simulation runs, forecast timeline events and source snapshots must survive restarts and remain isolated by user.

Scenario changes should version material assumptions without mutating confirmed financial facts.

Implemented boundary:

- Active Digital Twin page loads scenarios and simulation history from PostgreSQL through `src/server/services/coreDecisioningPostgresService.ts`.
- `/api/digital-twin` persists scenario saves and deterministic simulation runs.
- Simulation writes append `calculation_snapshots` and `simulation_runs`; prior runs are not overwritten.
- Timeline events for scenario activity are persisted in `timeline_events`.
- Verified financial inputs come from the PostgreSQL-backed Financial Vault read model.
- Assumptions remain scenario payload data and are not written back as Financial Vault facts.
- Active app/server code no longer imports `financialDigitalTwinStore`; that legacy module is retained only for test/demo isolation.

Private-beta activation hardening update:

- Forecast-specific `/api/financial-forecast` now persists deterministic forecast scenarios through `digital_twin_scenarios` and forecast runs through `simulation_runs` plus `calculation_snapshots`.
- The legacy filesystem forecast state remains only as an engine-level test helper and is not used by active forecast routes or the Digital Twin timeline page.
