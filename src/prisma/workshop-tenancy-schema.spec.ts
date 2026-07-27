import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('workshop tenancy migration', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260726120000_add_workshop_tenancy/migration.sql',
    ),
    'utf8',
  );

  it('checks the one-active-OWNER invariant at commit', () => {
    expect(migration).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(migration).toContain('owner_count <> 1');
    expect(migration).toContain('actual_owner_id <> expected_owner_id');
  });

  it('serializes membership ownership changes on the workshop row', () => {
    expect(migration).toContain('memberships_lock_workshop');
    expect(migration).toContain('FOR UPDATE');
  });

  it('aborts legacy migration without an active user', () => {
    expect(migration).toContain(
      'Workshop tenancy migration requires at least one active legacy user.',
    );
  });
});

describe('manual membership user migration', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260726230000_manual_membership_users/migration.sql',
    ),
    'utf8',
  );

  it('backfills the required workshop display name before enforcing it', () => {
    expect(migration).toContain('SET "display_name" = u."name"');
    expect(migration).toContain('ALTER COLUMN "display_name" SET NOT NULL');
    expect(migration).toContain('SET CONSTRAINTS ALL IMMEDIATE');
  });

  it('removes invitation storage and delivery state', () => {
    expect(migration).toContain('DROP TABLE "workshop_invitations"');
    expect(migration).toContain('DROP TYPE "invitation_delivery_status"');
  });
});
