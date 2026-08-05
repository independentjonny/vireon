# Backup and Recovery

Vireon stores high-sensitivity financial data. Production recovery must favour correctness and auditability over silent availability.

## Backup Expectations

- PostgreSQL continuous WAL archiving with point-in-time recovery.
- Daily encrypted logical backups for schema-level validation and migration rollback.
- Protected document-object backups with checksums and retention aligned to account deletion policy.
- Audit-event and calculation-snapshot tables included in backups.
- Restore tests use non-production data only.

## Recovery Objectives

| Area | Target |
|---|---|
| Point-in-time database recovery | Restore to a selected timestamp before a bad migration or corrupt write |
| Document recovery | Verify object checksum against document metadata |
| Calculation recovery | Preserve snapshot inputs, engine version, rule versions and output hash |
| Workflow recovery | Restore execution state without marking unverified outcomes as achieved |
| Account deletion recovery | Never restore deleted user data into active production without an explicit legal/operational process |

## Corrupted-Record Recovery

1. Identify affected user, entity, correlation ID and audit range.
2. Freeze writes for the affected entity where practical.
3. Compare current record hash with audit before/after hashes.
4. Restore the last consistent version into a superseding record or versioned update.
5. Append a recovery audit event.
6. Rerun affected deterministic engines.
7. Create Timeline events only for material user-facing changes.

## Migration Rollback

- Every migration run records source version, target version, source checksum, preview, imported counts and rollback metadata.
- Source local data is not deleted until record counts and checksums verify.
- A completed migration is not rerun silently.
- Rollback creates superseding records and audit events; immutable history is not deleted.

## Safe Recovery Drill

Use non-production data:

1. Create a test user with Vault facts, a Digital Twin scenario, a decision and an active workflow.
2. Export a structured user backup with manifest checksums.
3. Apply a simulated bad workflow update.
4. Restore the affected records from backup into a test database.
5. Verify user isolation, hashes, calculation snapshot versions and timeline references.
6. Confirm no demo records enter live-mode repositories.

## Failed Deployment Rollback

- Stop background jobs first.
- Roll back application version.
- If schema rollback is required, use migration metadata and restore verification.
- Rerun Production Readiness checks before re-enabling write traffic.

## Documentation Rule

Do not claim production recovery is ready until backup creation, restore, checksum verification and rollback drills have passed in a non-production environment.

## PostgreSQL Pilot Requirement

For the PostgreSQL persistence pilot, backup verification requires both:

- a readable backup or managed snapshot with recorded checksum and retention metadata
- a successful restore into a separate clean database with repository tests rerun against restored data

The current local contract tests can prove export/deletion and rollback semantics, but they do not prove database recovery.
