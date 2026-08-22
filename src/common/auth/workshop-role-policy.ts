import { UserRole } from '@prisma/client';

export const WORKSHOP_RESOURCE_READ_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.ADVISOR,
  UserRole.TECHNICIAN,
] as const;

export const WORKSHOP_RESOURCE_WRITE_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.ADVISOR,
] as const;

export const WORKSHOP_RESOURCE_DELETE_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
] as const;
