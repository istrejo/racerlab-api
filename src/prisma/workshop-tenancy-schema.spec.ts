import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schemaPath = resolve(__dirname, '../../prisma/schema.prisma');

function readSchema(): string {
  return readFileSync(schemaPath, 'utf8');
}

describe('workshop tenancy Prisma schema', () => {
  it('declares the tenancy foundation models and owner enum groundwork', () => {
    const schema = readSchema();

    expect(schema).toContain('enum UserRole {');
    expect(schema).toContain('OWNER');
    expect(schema).toContain('model Workshop {');
    expect(schema).toContain('ownerUserId');
    expect(schema).toContain('model Membership {');
    expect(schema).toContain('model Invitation {');
    expect(schema).toContain('model AuthSelection {');
    expect(schema).toContain(
      '@@unique([userId, workshopId], map: "membership_user_workshop_unique")',
    );
    expect(schema).toContain(
      '@@unique([id, userId], map: "membership_id_user_unique")',
    );
  });

  it('propagates workshop-scoped uniqueness and same-workshop relations across workshop-owned records', () => {
    const schema = readSchema();

    expect(schema).toContain('workshopId    String');
    expect(schema).toContain(
      '@@unique([id, workshopId], map: "customer_id_workshop_unique")',
    );
    expect(schema).toContain(
      '@@unique([id, workshopId], map: "vehicle_id_workshop_unique")',
    );
    expect(schema).toContain(
      '@@unique([id, workshopId], map: "service_order_id_workshop_unique")',
    );
    expect(schema).toContain(
      '@@unique([id, workshopId], map: "inventory_product_id_workshop_unique")',
    );
    expect(schema).toContain(
      '@relation(fields: [customerId, workshopId], references: [id, workshopId])',
    );
    expect(schema).toContain(
      '@relation(fields: [vehicleId, workshopId], references: [id, workshopId])',
    );
    expect(schema).toContain(
      '@relation(fields: [serviceOrderId, workshopId], references: [id, workshopId], onDelete: Cascade)',
    );
    expect(schema).toContain(
      '@relation(fields: [inventoryProductId, workshopId], references: [id, workshopId])',
    );
  });

  it('ties auth sessions to memberships without removing the current user link yet', () => {
    const schema = readSchema();

    expect(schema).toContain('membershipId        String?');
    expect(schema).toContain(
      '@relation(fields: [membershipId, userId], references: [id, userId], map: "auth_session_membership_user_fk")',
    );
    expect(schema).toContain(
      '@@index([membershipId], map: "auth_sessions_membership_id_idx")',
    );
  });
});
