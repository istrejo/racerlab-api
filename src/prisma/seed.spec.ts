import { UserRole } from '@prisma/client';
import { BOOTSTRAP_ROLES, seedRoles } from '../../prisma/seed';

type RoleUpsertArgs = {
  where: { name: UserRole };
  update: { description: string };
  create: { name: UserRole; description: string };
};

describe('seedRoles', () => {
  it('defines one bootstrap role for every supported UserRole', () => {
    expect(BOOTSTRAP_ROLES.map((role) => role.name).sort()).toEqual(
      Object.values(UserRole).sort(),
    );
  });

  it('includes the OWNER bootstrap role for workshop tenancy registration', () => {
    expect(BOOTSTRAP_ROLES).toContainEqual({
      name: UserRole.OWNER,
      description: 'Bootstrap owner role for workshop tenancy ownership.',
    });
  });

  it('upserts every bootstrap role by enum name', async () => {
    const upsert = jest.fn((args: RoleUpsertArgs) => Promise.resolve(args));
    const prisma = {
      role: {
        upsert,
      },
    };

    await seedRoles(prisma as never);

    expect(upsert).toHaveBeenCalledTimes(Object.values(UserRole).length);
    expect(upsert.mock.calls[0][0]).toEqual({
      where: { name: BOOTSTRAP_ROLES[0].name },
      update: { description: BOOTSTRAP_ROLES[0].description },
      create: BOOTSTRAP_ROLES[0],
    });
  });
});
