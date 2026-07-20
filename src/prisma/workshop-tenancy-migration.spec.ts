import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationDirectory = resolve(
  __dirname,
  '../../prisma/migrations/20260716030000_add_workshop_tenancy_foundation',
);
const migrationPath = resolve(migrationDirectory, 'migration.sql');
const runbookPath = resolve(
  __dirname,
  '../../prisma/workshop-tenancy-reset-runbook.md',
);

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8');
}

describe('workshop tenancy migration foundation', () => {
  it('keeps normal Prisma migration execution free of same-session custom approval settings', () => {
    const migration = readMigration();

    [
      'current_setting(',
      'app.workshop_tenancy_backup_approved',
      'app.workshop_tenancy_reset_approved',
    ].forEach((forbiddenSnippet) => {
      expect(migration).not.toContain(forbiddenSnippet);
    });
  });

  it('creates the migration with named constraints, composite foreign keys, and the deferred owner trigger', () => {
    expect(existsSync(migrationPath)).toBe(true);

    const migration = readMigration();

    expect(migration).toContain('membership_user_workshop_unique');
    expect(migration).toContain('membership_id_user_unique');
    expect(migration).toContain('invitation_workshop_email_unique');
    expect(migration).toContain('customer_id_workshop_unique');
    expect(migration).toContain('vehicle_id_workshop_unique');
    expect(migration).toContain('service_order_id_workshop_unique');
    expect(migration).toContain('inventory_product_id_workshop_unique');
    expect(migration).toContain('auth_session_membership_user_fk');
    expect(migration).toContain('create constraint trigger workshop_owner_membership_enforcer');
    expect(migration).toContain('deferrable initially deferred');
  });

  it('documents same-workshop foreign keys for cross-workshop relation rejection', () => {
    const migration = readMigration();

    expect(migration).toContain('foreign key (customer_id, workshop_id)');
    expect(migration).toContain('foreign key (vehicle_id, workshop_id)');
    expect(migration).toContain('foreign key (service_order_id, workshop_id)');
    expect(migration).toContain('foreign key (inventory_product_id, workshop_id)');
  });

  it('blocks every pre-existing workshop-owned table before adding required non-null workshop ids', () => {
    const migration = readMigration();

    [
      'customers',
      'vehicles',
      'service_orders',
      'service_order_technicians',
      'service_order_status_history',
      'diagnoses',
      'quotes',
      'quote_items',
      'inventory_categories',
      'inventory_products',
      'inventory_movements',
      'repair_tasks',
      'evidences',
      'comments',
    ].forEach((tableName) => {
      expect(migration).toContain(`exists (select 1 from public.${tableName})`);
    });
    expect(migration).toContain(
      "raise exception 'Controlled reset required before workshop tenancy migration when legacy workshop-owned rows exist.'",
    );
  });

  it('makes every required workshop_id column non-null to match the Prisma schema', () => {
    const migration = readMigration();

    [
      'customers',
      'vehicles',
      'service_orders',
      'service_order_technicians',
      'service_order_status_history',
      'diagnoses',
      'quotes',
      'quote_items',
      'inventory_categories',
      'inventory_products',
      'inventory_movements',
      'repair_tasks',
      'evidences',
      'comments',
    ].forEach((tableName) => {
      expect(migration).toContain(
        `alter table public.${tableName} alter column workshop_id set not null;`,
      );
    });
  });

  it('adds a reset runbook that refuses schema apply without backup evidence and explicit approval', () => {
    expect(existsSync(runbookPath)).toBe(true);

    const runbook = readFileSync(runbookPath, 'utf8');

    [
      'Do not apply this reset without approved backup evidence.',
      'Do not execute this reset without explicit controlled-reset approval.',
      'legacy operational/users/session rows',
      'truncate dependent legacy data in FK order',
      'Approval is operational evidence, not a PostgreSQL session setting.',
    ].forEach((requiredSnippet) => {
      expect(runbook).toContain(requiredSnippet);
    });
  });
});
