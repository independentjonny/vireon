# Goal funding in Control Centre

Local implementation, 3 November 2026. This change is not deployed.

## Entry points and ownership

- `/` and `/control-centre` render Control Centre. It remains the first direct desktop/mobile navigation item. `/dashboard-old` preserves the previous screen, titled `Dashboard_Old`, including the empty-record state, and is absent from navigation.
- `goalFundingInputs.ts` reads only eligible confirmed records from the existing PostgreSQL read model: owned, current, not superseded, not approximate, user-confirmed. It does not infer an account from a mortgage's offset-balance field. Funding uses canonical account IDs.
- `goalFundingModel.ts` is the active deterministic ledger and comparison owner. Current and proposed goals use identical starting facts and the proposed plan's shared assumptions. Widgets, goal assessments, chart data and consequence summaries consume its results. No AI produces financial amounts.
- Today uses confirmed facts and saved reservations. Assumption edits never replace confirmed figures. Recorded account interest is excluded from regular forecast income when explicitly identifiable, while the confirmed current monthly surplus is preserved. Users must confirm that modelled regular income excludes separately modelled bank interest.
- Existing retirement wealth targets are not automatically turned into spending goals. They enter the payment ledger only if they already have explicit funding instructions. Retirement income/spending remain a separate model transition.

## Ledger and boundaries

- Supported horizon: today through 720 calendar months. Start/end define the comparison period; the selected endpoint determines row two. Projection always starts from today's records. Reversed periods and unsupported horizons are rejected.
- Goal payments have one date and are spending, not asset purchases. No borrowing, redraw, investment sale, bank-feed ingestion, staged payments, optimisation or financial execution is performed.
- Existing account money is reserved by critical/high/medium/low priority, then stable goal ID. The tie-break deliberately does not change when Save first changes a payment date. Reservations reduce uncommitted cash and leave balances/net position unchanged. The same money cannot be reserved twice.
- Future contributions use available positive surplus, share one allocation budget, and stop at their specified required amount or payment date. Contributions before today are not inferred from old plans: existing earmarked balances must be entered as account funding sources.
- At payment, a fully funded goal debits its named accounts. An unaffordable goal remains unpaid at its full cost with a payment-date shortfall; it is never silently scaled down. Unassigned funding instructions are reported even if account/loan inputs are missing.
- Replenishment starts after payment, transfers surplus to the selected owned account, and is capped at the original account-funded amount. The selected-date shortfall is scheduled replenishment due less the amount restored. Transfers never create income, spending or net wealth.
- Account interest is credited daily at a constant entered rate using Actual/365 Fixed. Mortgage interest accrues daily using the same denominator. Combined eligible offset balances are percentage-weighted and capped at the linked outstanding principal. Reserved offset funds keep providing relief until withdrawal.
- Regular monthly income, living spending, contributions and replenishment accrue pro rata within each calendar month. This preserves twelve months of income through leap years. Loan payments occur on monthly anniversaries of the starting date, clamped to month end. This is a planning approximation, not bank transaction reconciliation.
- P&I repayments retain the scheduled amount; interest changes alter principal reduction. Principal reduces cash and debt together, so it is not counted twice as a net-position loss. Interest-only payments are capped at accrued interest and the entered scheduled amount, without principal reduction. No automatic repayment increase is assumed.
- Repayments cannot invent funds or establish a payoff using unavailable cash. A funding shortfall, uncovered interest or an unpaid balance at term end makes subsequent arrears/maturity projections unavailable rather than assuming new borrowing/refinancing terms.
- Retirement replaces salary and living costs with explicitly entered retirement income/spending, expressed in today's dollars and inflated. Already-retired users select a future review date. Withdrawals from assets already counted must not be treated as new income. Tax changes, fees and drawdown strategies are not modelled; interest comparisons are before tax.
- Essential living spending is distinct from total living spending. Buffer = available uncommitted accessible cash / essential monthly spending including scheduled loan repayments. Missing essential spending produces an unavailable buffer; zero essential spending has no finite months denominator.
- Input goal costs and funding instructions use whole cents. Internal cash-flow/interest precision is retained; amounts are rounded for display, and loan principal rounds to cents at repayment. Shortfalls display cents rather than rounding a small shortfall to zero.

## Comparisons and alternatives

Exactly three main metric rows show Today, selected date and retirement/review. Future widgets show current/proposed values and a calculated difference. Accessible cash expands into balances, commitments and available amounts. Existing Financial Position stays below the control workspace; Your next step is last. The old dashboard's separate goal assessment and wealth illustration do not compete with the funding model.

The single comparison chart switches among available cash, net position and loan balance, with current/proposed event text and markers for goal payments, retirement, payoff and emergency breaches. A textual endpoint/lowest-cash summary is available without interpreting the chart.

The consequence summary contains at most three entries, ordered by unfunded goals/negative cash, emergency breaches, other-goal shortfalls, mortgage costs and retirement effects. Details include period interest, savings interest, endpoint debt, payoff dates, lowest cash/date, days below the chosen minimum, payment-date goal assessments, replenishment and retirement differences. No goal is described as delayed without a computed alternative date.

Savings, offset and 50/50 split previews preserve the selected cost/date and show infeasibility. They use the corresponding accessible linked account in the workspace; users can edit a multi-account split explicitly. Save first reserves only future available surplus under the same priority rules, finds the first funded ledger date within 60 years, and states when none is feasible. Alternatives are not ranked as best.

## PostgreSQL persistence and safety

`/api/goals/funding` uses the existing session and `/api/goals/:path*` permission boundary, unchanged. The new service sets transaction-local `app.current_user_id` and includes the trusted user ID in every read/write. Source accounts and loans are checked against a fresh confirmed read model before saving.

- Canonical goal title/cost/date/priority/funding instructions live in existing `goals` columns and `payload.funding`. The legacy monthly-contribution fields mirror adopted surplus instructions. Other goal metadata and lifecycle status are preserved.
- Retirement date, monthly income and monthly expenses belong to Goals, stored as immutable `migration_runs` snapshots with target `retirement-goals-v1`. Control Centre reads those settings after plan preferences, so older alternatives cannot replace the saved retirement goal. The account update explicitly requested on 3 November 2026 saved 3 November 2040, $2,000 income/month and $1,500 expenses/month for boardn@hotmail.com; a fresh scoped database read verified them. Essential retirement spending remains a separate explicit assumption, never inferred from total expenses.
- Shared plan assumptions live in `user_preferences`, key `goal-funding-assumptions-v1`. They are plan assumptions, not financial facts.
- Named alternatives use immutable `timeline_events` entries of type `goal_funding_alternative`, following existing goal-scenario persistence patterns. Saving an alternative does not alter active goals.
- Adoption updates goals and assumptions atomically and appends `goal_funding_plan` history with prior/next plans. Prior plans load as previews; newer saved goals are retained rather than silently deleted by recovery.
- A revision hash covers goal versions, settings and current financial inputs. A per-user transaction advisory lock and goal-row locks protect writes. Stale revisions return conflict; request IDs are idempotent and reject changed payload replays. History failures roll back the adoption.
- No confirmed facts, fact versions, balances or actual transactions are written. No schema migration, authentication change, account reset or deployment is part of this change.
- Browser state is an unsaved preview/cache only. Saved plans never use local files, browser storage or process memory as authority.

## Verification and account acceptance

Tests cover account inputs, savings/offset/split funding, reservations/spending, transfers/principal, allocation competition, interest, caps, fixed repayments, replenishment, retirement, missing versus zero, dates, Save first, idempotency, revisions, rollback, reload and user isolation.

The live PostgreSQL test uses the existing application role and an always-rolled-back synthetic fixture transaction. It exercises actual schema writes, a fresh service read, history, alternative save and raw RLS isolation; a subsequent transaction verifies no fixture rows remain. It does not claim a committed production restart or an authenticated browser account journey.

Desktop/mobile journeys use an isolated synthetic component screen and mocked API responses; backend persistence is checked separately by the contract and live PostgreSQL tests. The temporary screen is removed before production build. Evidence is in `D:\Vireon\testing-goal-funding-20261103`.

No reusable authenticated `boardn@hotmail.com` session was present, so the authenticated browser acceptance journey remains unavailable. No new login, authentication change or reset was performed. The later explicit retirement-settings request was completed through the scoped PostgreSQL service after verifying the account email; this is account-maintenance read-back evidence, not authenticated browser acceptance. The open hosted page remains the previously deployed interface; these UI changes have not been deployed.

## Layout revision

The three main rows are Current State, Take Control and Retirement. Four metric columns align within 1px on desktop; at 390px and 320px they use two columns. Take Control has a pale teal background, Change goals, exact date selectors and a thin slider with a horizontal Retirement marker. Comparisons and cash breakdowns remain expandable. Retirement links to Goals. The supplied image is a layout reference only; no illustrative amounts become account data.
