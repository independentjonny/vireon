# Goals & Scenario Planning v1

Goals & Scenario Planning v1 converts user-defined goals, confirmed Financial Vault records and explicit assumptions into deterministic feasibility analysis, milestones, scenario comparisons, Decision Centre actions and AI CFO context. It does not depend on Open Banking or live AI calls.

## Implementation Note

Reusable components:

- Manual Financial Data Platform provides confirmed canonical records, goal record kind, provenance, confidence and confirmed-only trust boundaries.
- Financial Timeline & Forecasting v1 provides the baseline cash-flow forecast, forecast-quality class, timeline event type and AI CFO context conventions.
- Financial Health Engine provides current-state safety and debt signals that align with goal conflict rules.
- Existing Decision Centre action patterns are reused as deterministic goal decisions with calculations and source assumptions.

Duplicated goal logic:

- Digital Twin had broad annual goal scores for house, retirement, emergency fund and passive income.
- Autonomous Operations had internal worker goals, but those are operational goals, not user financial goals.
- Forecasting v1 generated basic goal milestone events from confirmed goal records, but it did not evaluate feasibility or scenario trade-offs.

Incomplete models addressed:

- Canonical user financial goal model.
- Goal assumptions and provenance.
- Required contribution and contribution shortfall.
- Probability-free feasibility class.
- Dedicated emergency fund, home purchase, debt repayment and retirement calculations.
- Goal scenario variants and baseline comparison.
- Goal milestones and timeline events.
- Goal Decision Centre actions and AI CFO context.
- Local deterministic persistence for goals, versions, scenarios, snapshots and status history.

Known boundaries:

- This is deterministic planning, not regulated product advice.
- Borrowing outputs are indicative and must not be presented as approval or credit advice.
- Retirement outputs are indicative and must not be presented as tax, superannuation or retirement advice.
- Goal priorities remain user controlled; Vireon only presents deterministic conflict and safety indicators.

Minimum vertical slice delivered:

- Emergency-fund goal.
- Home-purchase goal.
- Debt-repayment goal.
- Goal feasibility and contribution path.
- Goal-to-forecast integration.
- Scenario comparison.
- Timeline milestones.
- Decision Centre actions.
- AI CFO context.
- Persistence.
- `/goals` UI.
- Unit and browser tests.

Files modified:

- `src/lib/goalPlanning.ts`
- `src/app/api/goals/route.ts`
- `src/app/goals/page.tsx`
- `src/app/components/GoalsPlanningClient.tsx`
- `__tests__/lib/goalPlanning.test.ts`
- `tests/goals-planning.spec.ts`
- `docs/FEATURE_STATUS.md`

## Canonical Goal Model

Every goal stores user ID, type, title, target amount, current amount, target date, priority, status, linked accounts/assets/liabilities, linked scenario, contribution amount and frequency, assumptions, provenance, timestamps and archival state.

Goal types include emergency fund, debt repayment, home purchase, vehicle purchase, education, travel, retirement, investment, income, savings and custom goals.

Goal statuses include draft, active, at risk, on track, achieved, paused and archived.

## Feasibility

The engine calculates:

- Required monthly contribution.
- Projected completion date.
- Funding gap.
- Current progress.
- Feasibility class.
- Contribution shortfall.
- Delayed-start impact.
- Increased-contribution impact.
- One-off deposit impact.
- Cash-flow impact.
- Emergency-fund impact.
- Debt impact.
- Competing-goal conflicts.

Feasibility classes are `ACHIEVABLE`, `STRETCHED`, `UNLIKELY` and `INSUFFICIENT_DATA`. They are not statistical probabilities.

## Scenarios

Goal scenario variants preserve the original goal and baseline forecast. Variants may change contribution amount, one-off deposit, start delay, income change or expense reduction. Scenario comparison reports completion timing, required-contribution delta, cash-flow delta, emergency-fund delta and risk direction.

## Dedicated Planners

Home purchase:

- Calculates deposit gap, estimated purchase costs, indicative loan amount, indicative repayments, projected deposit date, cash remaining, emergency-fund position, debt-to-income indicator and cash-flow effect.
- Labels borrowing outputs as indicative, not approval or credit advice.

Retirement:

- Projects balance from current balance, contributions, assumed net return, fees and target date.
- Reports contribution gap and assumption sensitivity.
- Does not provide tax or retirement advice.

Debt repayment:

- Calculates required repayment, projected payoff date, estimated interest saved, cash-flow impact and emergency-fund impact.
- Does not recommend regulated credit products.

## AI CFO Context

The AI CFO receives structured facts only:

- Active goals.
- Progress.
- Feasibility.
- Target dates.
- Funding gaps.
- Required contribution.
- Conflicts.
- Scenario comparisons.
- Milestones.
- Forecast-quality warnings.

The AI CFO may explain these values but must not invent inputs, alter calculations, guarantee achievement, hide conflicts, imply borrowing approval or present tax/investment outcomes as certain.

## Safety

Goal outputs are planning estimates based on confirmed records and explicit assumptions. They must not be presented as guaranteed achievement, approved borrowing, guaranteed refinancing, guaranteed investment returns, tax advice, credit advice or personal regulated financial advice.
