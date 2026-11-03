# Repeatable Control Centre checks

Run `npm run check:control-centre` from the repository. It exits nonzero on a failed stage and writes a source-fingerprinted outcome receipt to `.verification/control-centre/receipt.json`. After a failure, fix the reported issue and run the same command again. No stage rewrites application code, resets accounts, logs in or deploys.

The executable acceptance plan is `.ai/verification-task.json`. With `VIREON_VERIFICATION_RECEIPT=.verification/control-centre/receipt.json`, `npm run completion:check` separately checks that its evidence and source fingerprint still match. The runner requires the installed Edge browser and the existing application-role PostgreSQL runtime configuration; missing dependencies fail the run rather than silently skipping checks.

| Check | Observable result |
| --- | --- |
| Checker self-tests | Deliberate missing rows, miscentring, button/link mismatch, displaced retirement mark, clipping, blank images and missing highlight are rejected. |
| Financial and persistence suite | Full regression suite, both live PostgreSQL switches enabled, synthetic transaction rollback, isolation, retirement settings, funding allocation and deterministic calculations. |
| Quality | Typecheck, lint and production build; temporary fixture routes must be absent from `src/app`. Existing lint warnings are retained in the report. |
| Browser | Real AppShell, BaselineDashboard, Financial Position, Control Centre and Goals components; three rows/four measures, funding alternatives, dates/slider, chart, missing inputs, edit/cancel, reviewed adoption, reload/recovery, keyboard focus and no confirmed-fact mutations. |
| Geometry | 1440px/1280px desktop and 390px/320px mobile; metric columns within 1px, slider/date-pair centring, Change goals link and desktop date-row alignment, exact-date retirement mark position, label bounds, primary control/text clipping, unbroken currency values (including large balances) and minimum 4.5:1 primary text contrast. |
| Rendered image | Fresh screenshots are decoded and checked for opaque/nonblank content and the actual pale teal highlight; these are bounded raster checks, supplemented by direct visual inspection during delivery. |
| Account read-back | Read-only check that boardn@hotmail.com owns the specified existing account and has retirement date 2040-11-03, income 2000/month and expenses 1500/month. |

The UI harness is generated below ignored `.verification/`, on a free loopback port. It imports production components and their styles/assets; it adds no route to the production application and has no authentication middleware to bypass. Financial API responses in this isolated harness are explicitly synthetic fixtures. PostgreSQL persistence is checked separately using the real application role. The fixture service is stopped in `finally`.

Screenshots, geometry measurements, test logs and account read-back are under `.verification/control-centre/`. This checker does not establish an authenticated account browser journey or deployment. It also cannot guarantee subjective design quality or prove the absence of every possible bug. Inspect the fresh screenshots and retain that distinction when reporting results.

The first checker run found a Change goals button instead of link, an approximately 81px vertical mismatch with date inputs, and a roughly 5.6px retirement-marker offset from the range thumb's true travel. The implementation was corrected and the same geometry assertions were rerun, without weakening the tolerances.

Task-specific receipt and log paths isolate this checker from other concurrent research/checker tasks. Default repository gate callers keep the existing latest-receipt behaviour. Both paths retain source and evidence fingerprints.

Direct screenshot inspection additionally found cents wrapping on large projected amounts at 320px. Long currency values now fit their metric column; the checker rejects multi-line currency values so this cannot silently pass the same test again.

Legacy local-store tests now use explicitly test-only, per-worker directories under ignored verification output. A child-process isolation test verifies the original transaction file remains byte-for-byte unchanged. Production storage routing is unchanged.
