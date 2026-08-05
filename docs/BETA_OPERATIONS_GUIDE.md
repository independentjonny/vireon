# Beta Operations Guide

Status: `READY_FOR_OPERATOR_GO_NO_GO_REVIEW`

## Administrator Responsibilities

- Review access requests.
- Approve, reject, revoke and reissue invitations through `/admin/private-beta/access`.
- Verify every invitation recipient belongs in the intended cohort.
- Keep raw invitation links out of logs, documents and screenshots.
- Monitor onboarding, support and incident signals.
- Pause admission if critical controls fail.

## Support Responsibilities

- Help testers complete invitation, login and onboarding.
- Collect reproducible issue reports.
- Separate bugs from feature requests.
- Use synthetic reproduction data whenever possible.
- Avoid asking users to send raw bank statements, passwords, tokens or full financial documents through support channels.

## Issue Classification

| Type | Description | Action |
| --- | --- | --- |
| Known limitation | Expected beta limitation such as disabled Open Banking. | Explain limitation and record if confusing. |
| Bug | Product behaves incorrectly but data is safe. | Triage severity and add to bug queue. |
| Incident | Security, privacy, data loss or broad outage concern. | Follow incident response. |
| Feature request | New capability outside RC1. | Add to V2 backlog. |
| User guidance | User needs clarification. | Respond with documented guidance. |

## Severity Definitions

| Severity | Examples | Required Response |
| --- | --- | --- |
| SEV-1 | Cross-user data exposure, auth bypass, secret leak, real deletion defect, live AI/Open Banking unexpectedly active. | Suspend beta admission immediately. Human approval required to resume. |
| SEV-2 | Database outage, migration issue, widespread login/onboarding failure, export/deletion lifecycle broken. | Pause affected flow, preserve evidence, fix before expansion. |
| SEV-3 | Isolated page error, confusing copy, single-user import issue, non-blocking accessibility defect. | Track and prioritize by user impact. |
| SEV-4 | Cosmetic inconsistency or documentation gap. | Backlog unless it blocks first-value journey. |

## Support SLAs

Use measured response times during beta; do not invent targets before operating data exists.

Record:

- first response time
- time to classify
- time to resolution or workaround
- reopen count
- affected users

## Incident Triage

1. Identify severity.
2. Stop new invitations for SEV-1 or admission-impacting SEV-2.
3. Preserve evidence and correlation IDs.
4. Confirm whether any real user data is affected.
5. Apply safe containment.
6. Communicate to affected testers.
7. Record root cause and corrective action.
8. Resume only after verification and required human approval.

## Feedback Collection

Ask users:

- What did you try to do?
- Where did you get stuck?
- Which number did you not trust?
- Which explanation helped?
- What would you expect to happen next?
- Did anything feel unsafe or surprising?

Feature requests go to Vireon v2 unless they are required to fix a critical beta blocker.
