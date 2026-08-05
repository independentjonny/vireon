# Observability Checklist

Status: `READY_FOR_OPERATOR_GO_NO_GO_REVIEW`

## Logging Safety

- [ ] No passwords.
- [ ] No service-role keys.
- [ ] No OpenAI/API provider keys.
- [ ] No raw invitation tokens.
- [ ] No full database URLs.
- [ ] No raw uploaded document text.
- [ ] No unnecessary financial values.
- [ ] Error messages are user-safe and contain a support reference or correlation ID.

## Required Event Coverage

| Area | Required Signals |
| --- | --- |
| Authentication | login success/failure category, logout, session expiry, confirmation-pending state. |
| RBAC | denied permission, route, actor reference, correlation ID. |
| Private beta access | request created, approved, rejected, revoked, reissued, redeemed. |
| Financial Vault | document registered, extraction state, fact approved, fact version created. |
| Forecasting | calculation started, succeeded, failed, stale input warning. |
| Decision Centre | decision created, reviewed, dismissed, actioned, reopened. |
| Workflows | workflow created, step changed, evidence attached, outcome verification state. |
| Daily Review | generation started, succeeded, partial failure, suppression, acknowledgement. |
| Goals | goal created, updated, archived, progress recalculated. |
| Background jobs | claimed, heartbeat, retry, failed, completed, exhausted. |
| Exports | requested, processing, completed, failed, expired. |
| Deletion lifecycle | requested, confirmed, scheduled, cancelled, failed, completed rehearsal. |
| Performance | route latency, repository latency, calculation latency, slow request category. |
| Persistence | database unavailable, transaction rollback, timeout, retry classification. |

## Correlation IDs

Every incident-relevant request should preserve a redacted correlation ID through:

1. API route.
2. service/repository call.
3. audit event.
4. support response.
5. incident report.

## Logging Decision Tree

| Situation | Log? | Detail |
| --- | --- | --- |
| Auth failure | Yes | Category only; no token. |
| RBAC denial | Yes | Actor reference, permission, route. |
| Validation error | Yes | Field/category only; no raw document or password. |
| Financial calculation warning | Yes | Engine/version and missing/stale category. |
| Raw user document content | No | Store only secure object reference and metadata. |
| Raw invitation link | No | Reveal once in UI only. |
| Provider payload | No by default | Store safe metadata only. |

## Background Monitoring Checklist

- [ ] Job queue backlog.
- [ ] Retry exhaustion.
- [ ] Duplicate idempotency suppression.
- [ ] Database connection saturation.
- [ ] Route latency outliers.
- [ ] Export/deletion terminal failures.
- [ ] Unexpected local fallback attempt.
- [ ] Open Banking or live AI enabled unexpectedly.
