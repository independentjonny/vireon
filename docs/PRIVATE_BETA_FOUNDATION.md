# Vireon Private Beta Foundation v1

## Readiness Audit

Vireon now has deterministic financial value available through the Manual Financial Data Platform, Financial Health Engine, Financial Timeline and Goals & Scenario Planning. This milestone keeps those engines unchanged and adds the private-beta control plane around them.

Reusable components:

- Auth/session boundary in `src/lib/auth/middleware.ts`.
- Confirmed-record trust model in `src/lib/manualFinancialDataPlatform.ts`.
- Deterministic health, forecast and goal engines.
- Production ownership, export, deletion and audit primitives in `src/lib/productionDataIntegrity.ts`.
- PostgreSQL pilot migration pattern in `migrations/0001_production_data_integrity.sql`.

Addressed blockers:

- `PRIVATE_BETA` mode blocks local JSON financial fallback and requires PostgreSQL configuration.
- Live AI and Open Banking remain disabled through server-side feature flags.
- User and household ownership helpers filter records server-side.
- Deterministic briefing, provenance and freshness make first value explainable without AI.
- Export, deletion request, feedback and audit records avoid secrets and raw document content.

Remaining production caveats:

- Supabase token verification still needs the final production implementation before real external users.
- Database-backed repository implementations must be connected to these private-beta tables in deployment.
- Legal and privacy wording needs review before invite rollout.
- Administrator support access remains intentionally minimal.

## Execution Modes

- `LOCAL_DEVELOPMENT`: explicit local JSON and synthetic/demo data are allowed.
- `OFFLINE_TEST`: deterministic tests and fixtures only.
- `PRIVATE_BETA`: database persistence is mandatory, local JSON financial persistence is prohibited, live AI disabled, Open Banking disabled.
- `PRODUCTION`: same hard controls plus final compliance and monitoring evidence.

## Readiness Check

Run:

```bash
npm run private-beta:readiness
```

Any critical `BLOCKED` category blocks private-beta deployment.

## User Journey

`/beta-onboarding` now provides guided onboarding, deterministic first-value briefing, provenance inspection, data freshness, export, deletion request and safe feedback. No live AI call or Open Banking connector is required.

## Safety Boundary

Briefings are deterministic templates. They may explain confirmed records, deterministic calculations and explicit assumptions. They must not claim guaranteed outcomes, borrowing approval, tax certainty or live balance status.
