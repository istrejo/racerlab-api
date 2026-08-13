import type { UserRole } from '@prisma/client';

export type ActiveMembershipContext = {
  id: string;
  workshopId: string;
  displayName: string;
  phone: string | null;
  address: string | null;
  role: { name: UserRole };
  workshop: { id: string; name: string };
};
