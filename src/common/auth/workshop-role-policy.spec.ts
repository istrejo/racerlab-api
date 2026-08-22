import { UserRole } from '@prisma/client';
import {
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
