import { UserRole } from '@prisma/client';
import {
  INVENTORY_READ_ROLES,
  INVENTORY_WRITE_ROLES,
  WORKSHOP_RESOURCE_DELETE_ROLES,
  WORKSHOP_RESOURCE_READ_ROLES,
  WORKSHOP_RESOURCE_WRITE_ROLES,
} from './workshop-role-policy';

describe('workshop role policy', () => {
  it('gives owners explicit access to every operational policy', () => {
    expect(WORKSHOP_RESOURCE_READ_ROLES).toContain(UserRole.OWNER);
    expect(WORKSHOP_RESOURCE_WRITE_ROLES).toContain(UserRole.OWNER);
    expect(WORKSHOP_RESOURCE_DELETE_ROLES).toContain(UserRole.OWNER);
  });

  it('keeps technicians read-only and inventory managers outside CRM access', () => {
    expect(WORKSHOP_RESOURCE_READ_ROLES).toContain(UserRole.TECHNICIAN);
    expect(WORKSHOP_RESOURCE_WRITE_ROLES).not.toContain(UserRole.TECHNICIAN);
    expect(WORKSHOP_RESOURCE_READ_ROLES).not.toContain(
      UserRole.INVENTORY_MANAGER,
    );
  });
});

describe('inventory role policy', () => {
  it('lets every operational role read inventory, including inventory managers', () => {
    expect([...INVENTORY_READ_ROLES]).toEqual([
      UserRole.OWNER,
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.ADVISOR,
      UserRole.TECHNICIAN,
      UserRole.INVENTORY_MANAGER,
    ]);
  });

  it('restricts inventory writes to owners, admins, managers, and inventory managers', () => {
    expect([...INVENTORY_WRITE_ROLES]).toEqual([
      UserRole.OWNER,
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.INVENTORY_MANAGER,
    ]);
    expect(INVENTORY_WRITE_ROLES).not.toContain(UserRole.ADVISOR);
    expect(INVENTORY_WRITE_ROLES).not.toContain(UserRole.TECHNICIAN);
  });
});
