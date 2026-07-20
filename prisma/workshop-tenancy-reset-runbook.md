# Workshop Tenancy Controlled Reset Runbook

## Preconditions

- Do not apply this reset without approved backup evidence.
- Do not execute this reset without explicit controlled-reset approval.
- Approval is operational evidence, not a PostgreSQL session setting.
- If legacy operational/users/session rows exist without those approvals, stop before DDL.

## Reset Sequence

1. Confirm the latest recoverable backup identifier and approval record.
2. Revoke active refresh sessions before data reset.
3. truncate dependent legacy data in FK order, including every workshop-owned table that will receive a required `workshop_id`.
4. Apply the workshop-tenancy schema migration and regenerate Prisma Client.
5. Seed the role catalog, including `OWNER`, and verify the migration constraints.

## Rollback

- Restore the approved pre-reset backup snapshot.
- Redeploy the matching pre-tenancy application code.
- Revoke any sessions issued after the failed reset window.
