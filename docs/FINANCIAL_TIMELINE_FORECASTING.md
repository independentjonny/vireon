# Financial Timeline & Forecasting v1

Financial Timeline & Forecasting v1 converts confirmed Financial Vault records and explicit assumptions into deterministic cash-flow, debt and net-worth projections. It does not depend on Open Banking or live AI calls.

## Implementation Note

Reusable logic:

- Manual Financial Data Platform already provides confirmed canonical records, provenance, source confidence and confirmed-only Digital Twin sync.
- Financial Health Engine v1 provides deterministic cash-flow, debt, safety and wealth metrics from the same confirmed-record boundary.
- Existing Financial Digital Twin supports annual scenario simulation and milestone events, but uses the older profile Vault and seeded assumptions.
- Existing timeline models provide immutable event and evidence structures that are suitable for historical explainability.

Duplicated calculations:

- Cash-flow and debt concepts existed in Financial Health, Financial Vault borrowing capacity and Digital Twin. Forecasting v1 keeps its own projection math but uses confirmed canonical records as the canonical input.
- Debt and net-worth calculations are now separated into forecast projections, while Health Engine remains current-state focused.

Missing structures addressed:

- Canonical forecast input model.
- Assumption provenance model.
- Monthly forecast rows.
- Event timeline model for projected events.
- Scenario deltas and baseline comparison.
- Forecast-quality classification.
- Persisted forecast snapshots and deterministic hashes through PostgreSQL `calculation_snapshots` and `simulation_runs`.

Known inconsistencies:

- Digital Twin remains annual and scenario-life focused.
- Forecasting v1 is monthly and near/medium-term operational.
- Health Engine uses current confirmed records; Forecasting v1 projects those records forward with explicit assumptions.

Files modified:

- `src/lib/financialForecasting.ts`
- `src/app/api/financial-forecast/route.ts`
- `src/app/digital-twin/timeline/page.tsx`
- `src/app/components/ForecastTimelineClient.tsx`
- `src/app/components/AppShell.tsx`
- `src/server/services/coreDecisioningPostgresService.ts`
- `__tests__/lib/financialForecasting.test.ts`
- `tests/financial-forecasting.spec.ts`

## Forecast Inputs

Inputs are restricted to:

- User-confirmed canonical records.
- Trusted deterministic imports after user confirmation.
- Explicitly accepted extracted values.
- User-defined or default assumptions with provenance.

Forecast inputs include opening balances, recurring income, recurring expenses, debts, goals, one-off events, forecast start date, horizon and assumptions for inflation, returns, super and salary growth.

## Horizons

- `30d`: one projected month, daily-labelled horizon.
- `90d`: three projected months, weekly-labelled horizon.
- `12m`: 12 monthly projections.
- `3y`: 36 monthly projections.
- `5y`: 60 monthly projections.
- `custom`: caller-supplied month count.

Current implementation stores monthly projection rows for every horizon. Short horizons can later render daily/weekly event labels without changing the calculation contract.

## Outputs

- Projected income, expenses, debt repayments, interest, surplus and cash balance.
- Debt amortisation, payoff events and interest burden.
- Net-worth projection across cash, property, super, investments, vehicles, other assets and debts.
- Projected events for salary, debt repayments, one-off scenario events, emergency-fund risks, shortfalls and goal milestones.
- Scenario comparison against the baseline.
- Forecast-quality warnings and deterministic Decision Centre findings.
- AI CFO context facts with assumption provenance.

## Safety

Forecasts are projected and assumption-driven. Vireon must not describe them as guaranteed returns, tax outcomes, approved borrowing, guaranteed refinancing or personal regulated financial advice. AI CFO may explain forecast outputs but must not change deterministic values or hide low-quality assumptions.

## Persistence

The active forecast route and Digital Twin timeline page use the PostgreSQL-backed core decisioning service. Confirmed Financial Vault records are loaded from the persisted financial read model, deterministic forecast outputs are written to `calculation_snapshots`, forecast run payloads are written to `simulation_runs`, and user scenario assumptions are written to `digital_twin_scenarios`.

The legacy `.vireon/financial-forecasting` helper remains only for isolated deterministic-engine round-trip tests. It is not an active runtime fallback; PostgreSQL unavailability returns an explicit unavailable state.
