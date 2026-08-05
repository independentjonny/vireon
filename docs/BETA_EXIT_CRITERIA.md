# Private Beta Exit Criteria

Status: `DRAFT_FOR_OPERATOR_REVIEW`

Leaving Private Beta requires evidence across engineering, security, reliability, support, user outcomes and operational maturity. Passing private beta does not automatically authorize public launch or regulated financial advice.

## Engineering

- All active beta domains remain PostgreSQL authoritative.
- No completed domain has filesystem, browser-storage or process-memory authority.
- No silent fallback to demo or local data.
- Full validation passes on the release candidate.
- Migrations are applied, recorded and reversible through tested recovery procedures.
- Architecture freeze exceptions are documented and approved.

## Security

- Trusted server-side identity is enforced.
- Cross-user isolation is tested and monitored.
- RBAC protects administrative and operational routes.
- RLS findings are resolved or explicitly approved with compensating controls.
- Secret scan has no live secret findings.
- Service-role credentials are server-only.
- Incident response has been rehearsed.

## Reliability

- Login/session flow is stable.
- PostgreSQL outage behavior is explicit and safe.
- Restart durability is proven for core journeys.
- Background jobs recover or fail safely.
- Export/deletion lifecycle states are durable.
- No unresolved SEV-1 or admission-blocking SEV-2 incidents.

## Performance

- Dashboard, onboarding and critical pages load within observed acceptable beta ranges.
- Heavy imports are bounded.
- API response times are monitored by route and error category.
- No recurring performance issue blocks first-value journeys.

## Support

- Support workflow is documented.
- Issue severity is consistently applied.
- Response and resolution times are measured.
- Known limitations are understandable to users.
- Feature requests are separated into V2 backlog.

## User Satisfaction

- Users can redeem invitations, confirm email, complete onboarding and reach first insight without operator help.
- Users understand incomplete data states.
- Users can explain why a key number appears.
- Users can recover from common errors.
- User feedback does not show a repeated trust-breaking misunderstanding.

## Data Quality

- Financial Vault facts show provenance and confidence.
- Missing data is not represented as zero.
- Stale or uncertain inputs are labelled.
- Imports reject malformed data safely.
- Evidence links remain traceable.

## Financial Accuracy

- Deterministic engines remain authoritative.
- Calculation snapshots preserve inputs, versions and warnings.
- AI output does not alter facts or deterministic calculations.
- Professional-review-required outputs remain clearly marked.

## AI Readiness

Before live AI can leave beta-gated status:

- Grounding evidence is complete.
- Model outputs pass human review.
- Cost controls are active.
- No hidden chain-of-thought is persisted.
- Provider data handling is approved.

## Open Banking Readiness

Before Open Banking can leave disabled status:

- Provider contract and consent flow are approved.
- Data ingestion, revocation and deletion are tested.
- Bank data security review passes.
- Failure modes are user-safe.
- Support team can handle account-linking issues.

## Exit Decision

Exit requires a written go/no-go decision from the product owner after reviewing:

- validation evidence
- incident history
- support metrics
- user feedback
- operational runbook results
- unresolved risks
