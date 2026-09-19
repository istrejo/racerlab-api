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

describe('customer document uniqueness migration', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260813160000_add_customer_document_uniqueness/migration.sql',
    ),
    'utf8',
  );

  it('normalizes documents before enforcing workshop-scoped uniqueness', () => {
    expect(migration).toContain('UPPER(REGEXP_REPLACE');
    expect(migration).toContain('GROUP BY "workshop_id", "document"');
    expect(migration).toContain('customers_workshop_id_document_key');
  });

  it('fails closed when normalized legacy documents collide', () => {
    expect(migration).toContain('HAVING COUNT(*) > 1');
    expect(migration).toContain(
      'Cannot enforce customer document uniqueness',
    );
  });
});

describe('quote version contract migration', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma/migrations/20260905150000_complete_quote_version_contract/migration.sql',
    ),
    'utf8',
  );

  it('backfills deterministic versions, lineage, currency, and decision methods', () => {
    expect(migration).toContain('ORDER BY "created_at", "id"');
    expect(migration).toContain('LAG("id")');
    expect(migration).toContain("\"currency_code\" = 'EUR'");
    expect(migration).toContain('approval_method_detail');
  });

  it('fails diagnostically before enforcing aggregate uniqueness', () => {
    expect(migration).toMatch(/^BEGIN;/);
    expect(migration.trim()).toMatch(/COMMIT;$/);
    expect(migration).toContain('Conflicting active or approved quotes');
    expect(migration).toContain('quotes_one_draft_per_order_key');
    expect(migration).toContain('quotes_one_active_or_approved_per_order_key');
    expect(migration).toContain('quotes_workshop_id_service_order_id_version_key');
  });
});
