import { PrismaClient, UserRole } from '@prisma/client';

export const BOOTSTRAP_ROLES = [
  {
    name: UserRole.ADMIN,
    description: 'Bootstrap administrator role for initial setup.',
  },
  {
    name: UserRole.MANAGER,
    description: 'Bootstrap manager role for workshop operations.',
  },
  {
    name: UserRole.ADVISOR,
    description: 'Bootstrap advisor role for customer-facing workflows.',
  },
  {
    name: UserRole.TECHNICIAN,
    description: 'Bootstrap technician role for repair execution.',
  },
  {
    name: UserRole.INVENTORY_MANAGER,
    description: 'Bootstrap inventory manager role for stock workflows.',
  },
];

export async function seedRoles(
  prisma: Pick<PrismaClient, 'role'>,
): Promise<void> {
  for (const role of BOOTSTRAP_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    await seedRoles(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
