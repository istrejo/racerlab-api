import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  isActive: true;
  mustChangePassword: boolean;
  sessionId: string;
  membershipId?: string;
  workshopId?: string;
  role?: UserRole;
}
