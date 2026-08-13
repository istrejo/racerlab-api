import { UserRole } from '@prisma/client';

export interface WorkshopContext {
  membershipId: string;
  workshopId: string;
  role: UserRole;
}
