import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = resolve(__dirname, '../..');
const migrationPaths = [
  'prisma/migrations/20260710154000_init_full_schema/migration.sql',
  'prisma/migrations/20260713105353_add_auth_sessions/migration.sql',
  'prisma/migrations/20260716030000_add_workshop_tenancy_foundation/migration.sql',
].map((path) => resolve(root, path));
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const canRunPostgres =
  testDatabaseUrl !== undefined &&
  /(?:^|[-_])test(?:[-_]|$)/i.test(new URL(testDatabaseUrl).pathname);
const describePostgres = canRunPostgres ? describe : describe.skip;

function executeMigration(databaseUrl: string, migrationPath: string): void {
  execFileSync(
    'pnpm',
    ['prisma', 'db', 'execute', '--url', databaseUrl, '--file', migrationPath],
    { cwd: root, stdio: 'pipe' },
  );
}

describePostgres('workshop tenancy migration on PostgreSQL', () => {
  const databaseUrl = testDatabaseUrl as string;
  const prisma = canRunPostgres
    ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    : undefined;

  beforeEach(async () => {
    expect(migrationPaths.every(existsSync)).toBe(true);
    await prisma!.$executeRawUnsafe('drop schema if exists public cascade');
    await prisma!.$executeRawUnsafe('create schema public');
    migrationPaths.forEach((migrationPath) =>
      executeMigration(databaseUrl, migrationPath),
    );
  });

  afterAll(async () => prisma!.$disconnect());

  it('rolls back the whole migration when the legacy-row reset guard rejects it', async () => {
    await prisma!.$executeRawUnsafe('drop schema if exists public cascade');
    await prisma!.$executeRawUnsafe('create schema public');
    migrationPaths
      .slice(0, 2)
      .forEach((migrationPath) => executeMigration(databaseUrl, migrationPath));
    await prisma!.$executeRawUnsafe(`
      insert into public.customers (id, full_name, updated_at)
      values ('00000000-0000-0000-0000-000000000301', 'Legacy customer', now());
    `);

    expect(() => executeMigration(databaseUrl, migrationPaths[2])).toThrow(
      'Controlled reset required before workshop tenancy migration',
    );

    const workshops = await prisma!.$queryRaw<Array<{ exists: boolean }>>`
      select to_regclass('public.workshops') is not null as exists
    `;
    expect(workshops).toEqual([{ exists: false }]);
  });

  it('rejects an additional active OWNER at deferred commit time', async () => {
    await prisma!.$executeRawUnsafe(`
      insert into public.roles (id, name, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000001', 'OWNER', now(), now());
    `);
    await prisma!.$executeRawUnsafe(`
      insert into public.roles (id, name, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000002', 'ADMIN', now(), now());
    `);
    await prisma!.$executeRawUnsafe(`
      insert into public.users (id, role_id, name, email, password_hash, updated_at)
      values ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002', 'Owner', 'owner@example.test', 'hash', now());
    `);
    await prisma!.$executeRawUnsafe(`
      insert into public.users (id, role_id, name, email, password_hash, updated_at)
      values ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', 'Extra owner', 'extra@example.test', 'hash', now());
    `);
    await prisma!.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`
      insert into public.workshops (id, name, owner_user_id) values ('00000000-0000-0000-0000-000000000101', 'A', '00000000-0000-0000-0000-000000000011');
      `);
      await transaction.$executeRawUnsafe(`
      insert into public.memberships (id, user_id, workshop_id, role_id) values ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001');
      `);
    });

    await expect(
      prisma!.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(`
        insert into public.memberships (id, user_id, workshop_id, role_id) values ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001');
        `);
      }),
    ).rejects.toThrow(
      'Each workshop must keep exactly one active OWNER membership matching owner_user_id.',
    );
  });

  it('rejects moving the only OWNER because it validates both the old and new workshops', async () => {
    await prisma!.$executeRawUnsafe(`
      insert into public.roles (id, name, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000001', 'OWNER', now(), now());
    `);
    await prisma!.$executeRawUnsafe(`
      insert into public.roles (id, name, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000002', 'ADMIN', now(), now());
    `);
    await prisma!.$executeRawUnsafe(`
      insert into public.users (id, role_id, name, email, password_hash, updated_at)
      values ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002', 'Owner', 'owner@example.test', 'hash', now());
    `);
    await prisma!.$executeRawUnsafe(`
      insert into public.users (id, role_id, name, email, password_hash, updated_at) values ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000002', 'Other owner', 'other@example.test', 'hash', now());
    `);
    await prisma!.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`
        insert into public.workshops (id, name, owner_user_id) values ('00000000-0000-0000-0000-000000000101', 'A', '00000000-0000-0000-0000-000000000011');
      `);
      await transaction.$executeRawUnsafe(`
        insert into public.memberships (id, user_id, workshop_id, role_id) values ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001');
      `);
    });
    await prisma!.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`
      insert into public.workshops (id, name, owner_user_id) values ('00000000-0000-0000-0000-000000000102', 'B', '00000000-0000-0000-0000-000000000013');
      `);
      await transaction.$executeRawUnsafe(`
      insert into public.memberships (id, user_id, workshop_id, role_id) values ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001');
      `);
    });

    await expect(
      prisma!.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(`
        update public.memberships set workshop_id = '00000000-0000-0000-0000-000000000102' where id = '00000000-0000-0000-0000-000000000201';
        `);
      }),
    ).rejects.toThrow(
      'Each workshop must keep exactly one active OWNER membership matching owner_user_id.',
    );
  });
});
