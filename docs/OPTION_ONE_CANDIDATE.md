# Option 1 Preview candidate

## Baseline and scope

Source: deployed `agent/dashboard-data-trust` commit `6fb5b18b0a3a4eaeb4c195e45b5dfb80dcfe4a4e`. Live Vercel metadata was checked before work. Existing project: `vireon3/vireon-rc1-hosted-test`, project `prj_xPCMbngu6B7BHup5VMbPA0BZgphR`. Production branch is `main` and is excluded.

The approved image was inspected directly in the Financial position projection conversation (Option 1 full website mockup, viewer image 3). Its numbers and alternative logo were not used as financial/brand authority.

## Requirement ledger

| Category | Requirement | Result |
|---|---|---|
| Must preserve | Existing logo | SHA256 B11220720A74B2FCD92F6AC3BF7901B436FEEC8C406954C533D9630F8049AF48, identical to baseline |
| Must preserve | Dashboard `/`, routes, navigation, empty/reset flow | Page and navigation definitions unchanged; temporary QA route removed |
| Must preserve | Auth, invite-only access, user scoping, recovery | No auth changes |
| Must preserve | Existing deterministic calculations and persistence | No existing engine, service, API, schema or migration changes |
| Must not change | Production, environment/access settings, live AI, Open Banking | No changes |
| Must change | Answer-first layout and NOW/FUTURE/IMPROVE/DECIDE | Implemented on populated dashboard |
| Must change | KPI, composition, goals, current insight | Wired to existing confirmed data props; missing stays unavailable |
| Must change | Decision impact and scenario comparison | User-entered isolated compound-growth illustration, not full wealth forecasting |
| Must change | Progressive disclosure and mobile access | Native details, labelled numeric inputs, focus styles and mobile reflow |
| Unresolved | Personal age-65 wealth, trajectory/range and retirement readiness | Not implemented; explicit unavailable state |
| Unresolved | Ranked wealth-improvement actions with personal age-65 benefits | Data checks shown; no fabricated benefit ranking |
| Unresolved | All decisions share a full financial model | Tester is explicitly isolated; no saved scenario/plan update |
| Unresolved | Exact mockup match | Structure compared; scenic banner absent, four rather than six KPIs, more vertical space, data-gated chart/readiness states |
| Unresolved | Empty account design | Existing empty/reset dashboard retained |
| Unresolved | Authenticated deployed verification | Requires a session on the new Preview origin |

## Model findings

The legacy Digital Twin hardcodes current age 36 and retirement age 60, minimum cash/investment balances and other assets. The forecast engine also contains default rates, debt repayments and a fixed super contribution rate. These were not copied into the new dashboard as personal financial facts. A verified retirement input/model contract is still needed before the outcome, trajectory, readiness and personalised action impacts can be completed.

The decision tester requires current age, one-off amount and annual return from the user. It uses annual compounding to 65. Spending is compared against investing that same amount. Total future value forgone and its growth component are separate. It excludes tax, fees, inflation, debt and changes in income and does not modify the saved plan. This calculation lives in a shared, tested module and does not replace existing engines.

## Validation

- Typecheck: PASS.
- Lint: PASS, 0 errors / 29 existing warnings.
- Build: PASS. Initial restricted-network font download failure resolved by allowing the existing build's font fetch.
- Focused decision-impact, confirmed-position, goal and reset tests: 44/44 PASS.
- Full suite: 944 tests; 905 passed, 38 failed, 1 skipped.
- Untouched baseline: 940 tests; 901 passed, 38 failed, 1 skipped. Failure names compared: identical; no new failing tests.
- Existing failures include legacy source-shape assertions, missing live-evaluation fixture artifacts and the hardcoded API-route count. No live AI evaluation was initiated.
- Logo hash and existing route/source preservation checked.
- Real-browser component QA using clearly labelled synthetic records: desktop 1440×1000, mobile 390×844 and narrow 320×740. Full desktop and mobile page visually inspected. Narrow KPI wrapping fixed. No horizontal component overflow. No app console errors; unrelated browser extension warnings observed.
- Tested investment/spending signs, 51→65 with 6% and $10,000 ($22,609), range inputs (4%/7%), invalid age 66, zero return, age 65, disclosure controls, section links and existing mobile menu.
- Synthetic QA route and data are excluded from deployment. This component QA is not an authenticated live-data acceptance test.

Overall status: **CANDIDATE**, not VERIFIED.
