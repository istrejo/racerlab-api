# Workshop Tenancy Controlled Reset Runbook

## Preconditions

- Do not apply this reset without approved backup evidence.
- Do not execute this reset without explicit controlled-reset approval.
- Approval is operational evidence, not a PostgreSQL session setting.
- Quiesce the application before the reset: enable maintenance mode, stop workers and schedulers, and verify no concurrent writes can reach PostgreSQL.
- If legacy operational/users/session rows exist without those approvals, stop before DDL.

## Reset Sequence

1. Confirm the latest recoverable backup identifier and approval record.
2. Quiesce the application and verify no concurrent writes remain before truncating or applying the migration.
3. Revoke active refresh sessions before data reset.
4. truncate dependent legacy data in FK order, including every workshop-owned table that will receive a required `workshop_id`.
5. Apply the workshop-tenancy schema migration with Prisma Migrate. The migration is transactional and uses one explicit PostgreSQL transaction: any reset guard, DDL, constraint, or trigger failure rolls back the entire migration and is safe to retry after the cause is corrected.
6. Regenerate Prisma Client, seed the role catalog including `OWNER`, and verify the migration constraints.
7. Keep maintenance mode enabled until migration verification and application health checks complete.

## Rollback

- Restore the approved pre-reset backup snapshot.
- Redeploy the matching pre-tenancy application code.
- Revoke any sessions issued after the failed reset window.
