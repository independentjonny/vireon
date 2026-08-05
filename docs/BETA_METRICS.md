# Private Beta Metrics

Status: `READY_FOR_OPERATOR_GO_NO_GO_REVIEW`

Do not fabricate target values before real beta data exists. Initial beta metrics are for learning, safety and operational control.

| KPI | Why It Matters | Measurement Notes |
| --- | --- | --- |
| Invitation approval count | Shows cohort growth and operator workload. | Count approved access requests by cohort and date. |
| Invitation redemption rate | Shows whether the invite/signup flow works. | Approved invitations vs completed redemption. |
| Email confirmation completion | Shows Supabase confirmation friction. | Confirmation-required signups vs confirmed sessions. |
| Onboarding completion | Shows first-run usability. | Started onboarding vs completed onboarding. |
| Time to first insight | Measures whether users reach value quickly. | Invitation redemption to first meaningful dashboard/Vault/goal insight. |
| Daily active users | Indicates engagement. | Unique active beta users per day. |
| Weekly active users | Indicates early retention. | Unique active beta users per week. |
| Session reliability | Validates auth/session stability. | Session errors, unexpected sign-outs, refresh failures. |
| Financial Vault completion | Shows data-quality readiness. | Completion by required categories, not raw balances. |
| Forecast generation | Shows use of deterministic planning. | Successful forecasts with sufficient inputs. |
| Goal creation and update | Shows planning engagement. | Goals created, updated, archived. |
| Decision Centre usage | Shows whether recommendations are actionable. | Decisions reviewed, dismissed, actioned. |
| Workflow progression | Shows follow-through. | Workflows started, steps completed, verified outcomes. |
| Daily Review usage | Shows recurring habit formation. | Reviews opened, findings acknowledged, suppressed or actioned. |
| Error rate | Tracks reliability. | API errors by category and correlation ID. |
| PostgreSQL unavailable events | Protects persistence trust. | Count and duration of explicit unavailable states. |
| Support volume | Indicates friction and operational load. | Issues by severity, area and user journey. |
| Average response time | Measures support performance. | Use observed beta data only. |
| Privacy/security events | Keeps trust central. | RBAC denials, suspicious access, secret scan findings, audit anomalies. |

## Metric Guardrails

- Do not log raw financial document contents.
- Do not use analytics that capture passwords, tokens, account numbers or raw documents.
- Treat support notes as sensitive.
- Avoid vanity metrics that encourage unsafe expansion.
- Use metrics to decide whether to pause, fix, or expand the beta.
