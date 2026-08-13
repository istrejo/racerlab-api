BEGIN;

-- CreateEnum
CREATE TYPE "invitation_delivery_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- Add the globally seeded OWNER role before memberships are backfilled.
INSERT INTO "roles" ("id", "name", "description", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'OWNER',
  'Workshop owner with every administrative permission.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO UPDATE
SET "description" = EXCLUDED."description", "updated_at" = CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "workshops" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workshops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workshop_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "deactivated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workshop_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "role_id" UUID NOT NULL,
  "invited_by_id" UUID NOT NULL,
  "revoked_by_id" UUID,
  "accepted_membership_id" UUID,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "delivery_status" "invitation_delivery_status" NOT NULL DEFAULT 'PENDING',
  "delivery_version" INTEGER NOT NULL DEFAULT 1,
  "provider_message_id" TEXT,
  "last_delivery_error" TEXT,
  "last_delivery_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workshop_invitations_pkey" PRIMARY KEY ("id")
);

-- Add tenant columns as nullable for the legacy backfill.
ALTER TABLE "auth_sessions" ADD COLUMN "active_membership_id" UUID;
ALTER TABLE "customers" ADD COLUMN "workshop_id" UUID;
ALTER TABLE "vehicles" ADD COLUMN "workshop_id" UUID;
ALTER TABLE "service_orders" ADD COLUMN "workshop_id" UUID;
ALTER TABLE "service_order_technicians" ADD COLUMN "workshop_id" UUID;
ALTER TABLE "service_order_status_history" ADD COLUMN "workshop_id" UUID;
ALTER TABLE "diagnoses" ADD COLUMN "workshop_id" UUID;
ALTER TABLE "quotes" ADD COLUMN "workshop_id" UUID;
ALTER TABLE "quote_items" ADD COLUMN "workshop_id" UUID;
ALTER TABLE "inventory_categories" ADD COLUMN "workshop_id" UUID;
ALTER TABLE "inventory_products" ADD COLUMN "workshop_id" UUID;
ALTER TABLE "inventory_movements" ADD COLUMN "workshop_id" UUID;
ALTER TABLE "repair_tasks" ADD COLUMN "workshop_id" UUID;
ALTER TABLE "evidences" ADD COLUMN "workshop_id" UUID;
ALTER TABLE "comments" ADD COLUMN "workshop_id" UUID;

-- Backfill one legacy workshop only when legacy identities/data exist.
DO $$
DECLARE
  legacy_workshop_id UUID;
  legacy_owner_id UUID;
  owner_role_id UUID;
BEGIN
  SELECT "id"
  INTO legacy_owner_id
  FROM "users"
  WHERE "is_active" = true
  ORDER BY "created_at" ASC, "id" ASC
  LIMIT 1;

  IF legacy_owner_id IS NULL THEN
    RAISE EXCEPTION
      'Workshop tenancy migration requires at least one active legacy user.';
  END IF;

  SELECT "id" INTO owner_role_id FROM "roles" WHERE "name" = 'OWNER';
  legacy_workshop_id := gen_random_uuid();

  INSERT INTO "workshops" (
    "id", "name", "owner_user_id", "created_at", "updated_at"
  ) VALUES (
    legacy_workshop_id,
    'Taller principal',
    legacy_owner_id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  INSERT INTO "memberships" (
    "id",
    "workshop_id",
    "user_id",
    "role_id",
    "is_active",
    "deactivated_at",
    "created_at",
    "updated_at"
  )
  SELECT
    gen_random_uuid(),
    legacy_workshop_id,
    u."id",
    CASE WHEN u."id" = legacy_owner_id THEN owner_role_id ELSE u."role_id" END,
    u."is_active",
    CASE WHEN u."is_active" THEN NULL ELSE CURRENT_TIMESTAMP END,
    u."created_at",
    CURRENT_TIMESTAMP
  FROM "users" u;

  UPDATE "customers" SET "workshop_id" = legacy_workshop_id;
  UPDATE "vehicles" SET "workshop_id" = legacy_workshop_id;
  UPDATE "service_orders" SET "workshop_id" = legacy_workshop_id;
  UPDATE "service_order_technicians" SET "workshop_id" = legacy_workshop_id;
  UPDATE "service_order_status_history" SET "workshop_id" = legacy_workshop_id;
  UPDATE "diagnoses" SET "workshop_id" = legacy_workshop_id;
  UPDATE "quotes" SET "workshop_id" = legacy_workshop_id;
  UPDATE "quote_items" SET "workshop_id" = legacy_workshop_id;
  UPDATE "inventory_categories" SET "workshop_id" = legacy_workshop_id;
  UPDATE "inventory_products" SET "workshop_id" = legacy_workshop_id;
  UPDATE "inventory_movements" SET "workshop_id" = legacy_workshop_id;
  UPDATE "repair_tasks" SET "workshop_id" = legacy_workshop_id;
  UPDATE "evidences" SET "workshop_id" = legacy_workshop_id;
  UPDATE "comments" SET "workshop_id" = legacy_workshop_id;
END $$;

-- Tenant columns are mandatory for every operational row after backfill.
ALTER TABLE "customers" ALTER COLUMN "workshop_id" SET NOT NULL;
ALTER TABLE "vehicles" ALTER COLUMN "workshop_id" SET NOT NULL;
ALTER TABLE "service_orders" ALTER COLUMN "workshop_id" SET NOT NULL;
ALTER TABLE "service_order_technicians" ALTER COLUMN "workshop_id" SET NOT NULL;
ALTER TABLE "service_order_status_history" ALTER COLUMN "workshop_id" SET NOT NULL;
ALTER TABLE "diagnoses" ALTER COLUMN "workshop_id" SET NOT NULL;
ALTER TABLE "quotes" ALTER COLUMN "workshop_id" SET NOT NULL;
ALTER TABLE "quote_items" ALTER COLUMN "workshop_id" SET NOT NULL;
ALTER TABLE "inventory_categories" ALTER COLUMN "workshop_id" SET NOT NULL;
ALTER TABLE "inventory_products" ALTER COLUMN "workshop_id" SET NOT NULL;
ALTER TABLE "inventory_movements" ALTER COLUMN "workshop_id" SET NOT NULL;
ALTER TABLE "repair_tasks" ALTER COLUMN "workshop_id" SET NOT NULL;
ALTER TABLE "evidences" ALTER COLUMN "workshop_id" SET NOT NULL;
ALTER TABLE "comments" ALTER COLUMN "workshop_id" SET NOT NULL;

-- Replace global uniqueness with tenant-local uniqueness.
DROP INDEX "vehicles_plate_key";
DROP INDEX "service_orders_code_key";
DROP INDEX "inventory_categories_name_key";
DROP INDEX "inventory_products_sku_key";

CREATE UNIQUE INDEX "memberships_workshop_id_user_id_key"
  ON "memberships"("workshop_id", "user_id");
CREATE UNIQUE INDEX "memberships_workshop_id_id_key"
  ON "memberships"("workshop_id", "id");
CREATE UNIQUE INDEX "memberships_id_user_id_key"
  ON "memberships"("id", "user_id");
CREATE UNIQUE INDEX "customers_workshop_id_id_key"
  ON "customers"("workshop_id", "id");
CREATE UNIQUE INDEX "vehicles_workshop_id_id_key"
  ON "vehicles"("workshop_id", "id");
CREATE UNIQUE INDEX "vehicles_workshop_id_plate_key"
  ON "vehicles"("workshop_id", "plate");
CREATE UNIQUE INDEX "service_orders_workshop_id_id_key"
  ON "service_orders"("workshop_id", "id");
CREATE UNIQUE INDEX "service_orders_workshop_id_code_key"
  ON "service_orders"("workshop_id", "code");
CREATE UNIQUE INDEX "quotes_workshop_id_id_key"
  ON "quotes"("workshop_id", "id");
CREATE UNIQUE INDEX "inventory_categories_workshop_id_id_key"
  ON "inventory_categories"("workshop_id", "id");
CREATE UNIQUE INDEX "inventory_categories_workshop_id_name_key"
  ON "inventory_categories"("workshop_id", "name");
CREATE UNIQUE INDEX "inventory_products_workshop_id_id_key"
  ON "inventory_products"("workshop_id", "id");
CREATE UNIQUE INDEX "inventory_products_workshop_id_sku_key"
  ON "inventory_products"("workshop_id", "sku");
CREATE UNIQUE INDEX "workshop_invitations_token_hash_key"
  ON "workshop_invitations"("token_hash");

CREATE INDEX "workshops_owner_user_id_idx" ON "workshops"("owner_user_id");
CREATE INDEX "memberships_role_id_idx" ON "memberships"("role_id");
CREATE INDEX "memberships_workshop_id_is_active_idx"
  ON "memberships"("workshop_id", "is_active");
CREATE INDEX "auth_sessions_active_membership_id_idx"
  ON "auth_sessions"("active_membership_id");
CREATE INDEX "customers_workshop_id_full_name_idx"
  ON "customers"("workshop_id", "full_name");
CREATE INDEX "vehicles_workshop_id_customer_id_idx"
  ON "vehicles"("workshop_id", "customer_id");
CREATE INDEX "service_orders_workshop_id_customer_id_idx"
  ON "service_orders"("workshop_id", "customer_id");
CREATE INDEX "service_orders_workshop_id_vehicle_id_idx"
  ON "service_orders"("workshop_id", "vehicle_id");
CREATE INDEX "service_orders_workshop_id_assigned_technician_id_idx"
  ON "service_orders"("workshop_id", "assigned_technician_id");
CREATE INDEX "service_orders_workshop_id_created_by_id_idx"
  ON "service_orders"("workshop_id", "created_by_id");
CREATE INDEX "service_orders_workshop_id_status_created_at_idx"
  ON "service_orders"("workshop_id", "status", "created_at");
CREATE INDEX "service_order_technicians_workshop_id_technician_id_idx"
  ON "service_order_technicians"("workshop_id", "technician_id");
CREATE INDEX "service_order_technicians_workshop_id_assigned_by_id_idx"
  ON "service_order_technicians"("workshop_id", "assigned_by_id");
CREATE INDEX "service_order_status_history_workshop_id_service_order_id_idx"
  ON "service_order_status_history"("workshop_id", "service_order_id");
CREATE INDEX "service_order_status_history_workshop_id_changed_by_id_idx"
  ON "service_order_status_history"("workshop_id", "changed_by_id");
CREATE INDEX "diagnoses_workshop_id_service_order_id_idx"
  ON "diagnoses"("workshop_id", "service_order_id");
CREATE INDEX "diagnoses_workshop_id_technician_id_idx"
  ON "diagnoses"("workshop_id", "technician_id");
CREATE INDEX "quotes_workshop_id_service_order_id_idx"
  ON "quotes"("workshop_id", "service_order_id");
CREATE INDEX "quotes_workshop_id_created_by_id_idx"
  ON "quotes"("workshop_id", "created_by_id");
CREATE INDEX "quote_items_workshop_id_quote_id_idx"
  ON "quote_items"("workshop_id", "quote_id");
CREATE INDEX "quote_items_workshop_id_inventory_product_id_idx"
  ON "quote_items"("workshop_id", "inventory_product_id");
CREATE INDEX "inventory_products_workshop_id_category_id_idx"
  ON "inventory_products"("workshop_id", "category_id");
CREATE INDEX "inventory_movements_workshop_id_product_id_idx"
  ON "inventory_movements"("workshop_id", "product_id");
CREATE INDEX "inventory_movements_workshop_id_service_order_id_idx"
  ON "inventory_movements"("workshop_id", "service_order_id");
CREATE INDEX "inventory_movements_workshop_id_created_by_id_idx"
  ON "inventory_movements"("workshop_id", "created_by_id");
CREATE INDEX "repair_tasks_workshop_id_service_order_id_idx"
  ON "repair_tasks"("workshop_id", "service_order_id");
CREATE INDEX "repair_tasks_workshop_id_assigned_technician_id_idx"
  ON "repair_tasks"("workshop_id", "assigned_technician_id");
CREATE INDEX "evidences_workshop_id_service_order_id_idx"
  ON "evidences"("workshop_id", "service_order_id");
CREATE INDEX "evidences_workshop_id_uploaded_by_id_idx"
  ON "evidences"("workshop_id", "uploaded_by_id");
CREATE INDEX "comments_workshop_id_service_order_id_idx"
  ON "comments"("workshop_id", "service_order_id");
CREATE INDEX "comments_workshop_id_user_id_idx"
  ON "comments"("workshop_id", "user_id");
CREATE INDEX "workshop_invitations_workshop_email_expires_idx"
  ON "workshop_invitations"("workshop_id", "email", "expires_at");
CREATE INDEX "workshop_invitations_workshop_created_idx"
  ON "workshop_invitations"("workshop_id", "created_at");
CREATE INDEX "workshop_invitations_role_id_idx"
  ON "workshop_invitations"("role_id");
CREATE INDEX "workshop_invitations_accepted_membership_id_idx"
  ON "workshop_invitations"("accepted_membership_id");

-- Replace the service-order technician primary key with a tenant-bound key.
ALTER TABLE "service_order_technicians"
  DROP CONSTRAINT "service_order_technicians_pkey";
ALTER TABLE "service_order_technicians"
  ADD CONSTRAINT "service_order_technicians_pkey"
  PRIMARY KEY ("workshop_id", "service_order_id", "technician_id");

-- Drop legacy foreign keys that are replaced by tenant-bound relations.
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_customer_id_fkey";
ALTER TABLE "service_orders" DROP CONSTRAINT "service_orders_customer_id_fkey";
ALTER TABLE "service_orders" DROP CONSTRAINT "service_orders_vehicle_id_fkey";
ALTER TABLE "service_orders" DROP CONSTRAINT "service_orders_assigned_technician_id_fkey";
ALTER TABLE "service_orders" DROP CONSTRAINT "service_orders_created_by_id_fkey";
ALTER TABLE "service_order_technicians" DROP CONSTRAINT "service_order_technicians_service_order_id_fkey";
ALTER TABLE "service_order_technicians" DROP CONSTRAINT "service_order_technicians_technician_id_fkey";
ALTER TABLE "service_order_technicians" DROP CONSTRAINT "service_order_technicians_assigned_by_id_fkey";
ALTER TABLE "service_order_status_history" DROP CONSTRAINT "service_order_status_history_service_order_id_fkey";
ALTER TABLE "service_order_status_history" DROP CONSTRAINT "service_order_status_history_changed_by_id_fkey";
ALTER TABLE "diagnoses" DROP CONSTRAINT "diagnoses_service_order_id_fkey";
ALTER TABLE "diagnoses" DROP CONSTRAINT "diagnoses_technician_id_fkey";
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_service_order_id_fkey";
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_created_by_id_fkey";
ALTER TABLE "quote_items" DROP CONSTRAINT "quote_items_quote_id_fkey";
ALTER TABLE "quote_items" DROP CONSTRAINT "quote_items_inventory_product_id_fkey";
ALTER TABLE "inventory_products" DROP CONSTRAINT "inventory_products_category_id_fkey";
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_product_id_fkey";
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_service_order_id_fkey";
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_created_by_id_fkey";
ALTER TABLE "repair_tasks" DROP CONSTRAINT "repair_tasks_service_order_id_fkey";
ALTER TABLE "repair_tasks" DROP CONSTRAINT "repair_tasks_assigned_technician_id_fkey";
ALTER TABLE "evidences" DROP CONSTRAINT "evidences_service_order_id_fkey";
ALTER TABLE "evidences" DROP CONSTRAINT "evidences_uploaded_by_id_fkey";
ALTER TABLE "comments" DROP CONSTRAINT "comments_service_order_id_fkey";
ALTER TABLE "comments" DROP CONSTRAINT "comments_user_id_fkey";

-- Base workshop and membership relations.
ALTER TABLE "workshops"
  ADD CONSTRAINT "workshops_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auth_sessions"
  ADD CONSTRAINT "auth_sessions_active_membership_id_user_id_fkey"
  FOREIGN KEY ("active_membership_id", "user_id")
  REFERENCES "memberships"("id", "user_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every tenant table belongs directly to a workshop.
ALTER TABLE "customers" ADD CONSTRAINT "customers_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_order_technicians" ADD CONSTRAINT "service_order_technicians_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_order_status_history" ADD CONSTRAINT "service_order_status_history_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "repair_tasks" ADD CONSTRAINT "repair_tasks_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tenant-bound parent and actor relations prevent cross-workshop links.
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_workshop_id_customer_id_fkey"
  FOREIGN KEY ("workshop_id", "customer_id") REFERENCES "customers"("workshop_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_workshop_id_customer_id_fkey"
  FOREIGN KEY ("workshop_id", "customer_id") REFERENCES "customers"("workshop_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_workshop_id_vehicle_id_fkey"
  FOREIGN KEY ("workshop_id", "vehicle_id") REFERENCES "vehicles"("workshop_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_workshop_id_assigned_technician_id_fkey"
  FOREIGN KEY ("workshop_id", "assigned_technician_id") REFERENCES "memberships"("workshop_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_workshop_id_created_by_id_fkey"
  FOREIGN KEY ("workshop_id", "created_by_id") REFERENCES "memberships"("workshop_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_order_technicians" ADD CONSTRAINT "service_order_technicians_workshop_id_service_order_id_fkey"
  FOREIGN KEY ("workshop_id", "service_order_id") REFERENCES "service_orders"("workshop_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_order_technicians" ADD CONSTRAINT "service_order_technicians_workshop_id_technician_id_fkey"
  FOREIGN KEY ("workshop_id", "technician_id") REFERENCES "memberships"("workshop_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_order_technicians" ADD CONSTRAINT "service_order_technicians_workshop_id_assigned_by_id_fkey"
  FOREIGN KEY ("workshop_id", "assigned_by_id") REFERENCES "memberships"("workshop_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_order_status_history" ADD CONSTRAINT "service_order_status_history_workshop_id_service_order_id_fkey"
  FOREIGN KEY ("workshop_id", "service_order_id") REFERENCES "service_orders"("workshop_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_order_status_history" ADD CONSTRAINT "service_order_status_history_workshop_id_changed_by_id_fkey"
  FOREIGN KEY ("workshop_id", "changed_by_id") REFERENCES "memberships"("workshop_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_workshop_id_service_order_id_fkey"
  FOREIGN KEY ("workshop_id", "service_order_id") REFERENCES "service_orders"("workshop_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_workshop_id_technician_id_fkey"
  FOREIGN KEY ("workshop_id", "technician_id") REFERENCES "memberships"("workshop_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_workshop_id_service_order_id_fkey"
  FOREIGN KEY ("workshop_id", "service_order_id") REFERENCES "service_orders"("workshop_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_workshop_id_created_by_id_fkey"
  FOREIGN KEY ("workshop_id", "created_by_id") REFERENCES "memberships"("workshop_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_workshop_id_quote_id_fkey"
  FOREIGN KEY ("workshop_id", "quote_id") REFERENCES "quotes"("workshop_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_workshop_id_inventory_product_id_fkey"
  FOREIGN KEY ("workshop_id", "inventory_product_id") REFERENCES "inventory_products"("workshop_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_products" ADD CONSTRAINT "inventory_products_workshop_id_category_id_fkey"
  FOREIGN KEY ("workshop_id", "category_id") REFERENCES "inventory_categories"("workshop_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_workshop_id_product_id_fkey"
  FOREIGN KEY ("workshop_id", "product_id") REFERENCES "inventory_products"("workshop_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_workshop_id_service_order_id_fkey"
  FOREIGN KEY ("workshop_id", "service_order_id") REFERENCES "service_orders"("workshop_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_workshop_id_created_by_id_fkey"
  FOREIGN KEY ("workshop_id", "created_by_id") REFERENCES "memberships"("workshop_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "repair_tasks" ADD CONSTRAINT "repair_tasks_workshop_id_service_order_id_fkey"
  FOREIGN KEY ("workshop_id", "service_order_id") REFERENCES "service_orders"("workshop_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repair_tasks" ADD CONSTRAINT "repair_tasks_workshop_id_assigned_technician_id_fkey"
  FOREIGN KEY ("workshop_id", "assigned_technician_id") REFERENCES "memberships"("workshop_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_workshop_id_service_order_id_fkey"
  FOREIGN KEY ("workshop_id", "service_order_id") REFERENCES "service_orders"("workshop_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_workshop_id_uploaded_by_id_fkey"
  FOREIGN KEY ("workshop_id", "uploaded_by_id") REFERENCES "memberships"("workshop_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_workshop_id_service_order_id_fkey"
  FOREIGN KEY ("workshop_id", "service_order_id") REFERENCES "service_orders"("workshop_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_workshop_id_user_id_fkey"
  FOREIGN KEY ("workshop_id", "user_id") REFERENCES "memberships"("workshop_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invitation relations are tenant-bound as well.
ALTER TABLE "workshop_invitations" ADD CONSTRAINT "workshop_invitations_workshop_id_fkey"
  FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_invitations" ADD CONSTRAINT "workshop_invitations_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_invitations" ADD CONSTRAINT "workshop_invitations_workshop_id_invited_by_id_fkey"
  FOREIGN KEY ("workshop_id", "invited_by_id") REFERENCES "memberships"("workshop_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_invitations" ADD CONSTRAINT "workshop_invitations_workshop_id_revoked_by_id_fkey"
  FOREIGN KEY ("workshop_id", "revoked_by_id") REFERENCES "memberships"("workshop_id", "user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_invitations" ADD CONSTRAINT "workshop_invitations_workshop_id_accepted_membership_id_fkey"
  FOREIGN KEY ("workshop_id", "accepted_membership_id") REFERENCES "memberships"("workshop_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Membership ownership changes serialize on the workshop row.
CREATE FUNCTION "lock_membership_workshop"()
RETURNS TRIGGER AS $$
DECLARE
  target_workshop_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."workshop_id" IS DISTINCT FROM OLD."workshop_id" THEN
    RAISE EXCEPTION 'A membership cannot move between workshops.';
  END IF;

  target_workshop_id := COALESCE(NEW."workshop_id", OLD."workshop_id");
  PERFORM 1 FROM "workshops"
  WHERE "id" = target_workshop_id
  FOR UPDATE;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "memberships_lock_workshop"
BEFORE INSERT OR UPDATE OR DELETE ON "memberships"
FOR EACH ROW EXECUTE FUNCTION "lock_membership_workshop"();

-- The owner invariant is checked only at commit, allowing an atomic transfer.
CREATE FUNCTION "assert_workshop_owner_invariant"(target_workshop_id UUID)
RETURNS VOID AS $$
DECLARE
  expected_owner_id UUID;
  actual_owner_id UUID;
  owner_count INTEGER;
BEGIN
  SELECT "owner_user_id"
  INTO expected_owner_id
  FROM "workshops"
  WHERE "id" = target_workshop_id;

  IF expected_owner_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO owner_count
  FROM "memberships" m
  JOIN "roles" r ON r."id" = m."role_id"
  WHERE m."workshop_id" = target_workshop_id
    AND m."is_active" = true
    AND r."name" = 'OWNER';

  SELECT m."user_id"
  INTO actual_owner_id
  FROM "memberships" m
  JOIN "roles" r ON r."id" = m."role_id"
  WHERE m."workshop_id" = target_workshop_id
    AND m."is_active" = true
    AND r."name" = 'OWNER'
  LIMIT 1;

  IF owner_count <> 1 OR actual_owner_id <> expected_owner_id THEN
    RAISE EXCEPTION
      'Workshop % must have exactly one active OWNER matching owner_user_id.',
      target_workshop_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "check_membership_owner_invariant"()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM "assert_workshop_owner_invariant"(
    COALESCE(NEW."workshop_id", OLD."workshop_id")
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "check_workshop_owner_invariant"()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM "assert_workshop_owner_invariant"(NEW."id");
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "check_owner_role_invariant"()
RETURNS TRIGGER AS $$
DECLARE
  workshop_record RECORD;
BEGIN
  IF OLD."name" = 'OWNER' OR NEW."name" = 'OWNER' THEN
    FOR workshop_record IN SELECT "id" FROM "workshops"
    LOOP
      PERFORM "assert_workshop_owner_invariant"(workshop_record."id");
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "memberships_owner_invariant"
AFTER INSERT OR UPDATE OR DELETE ON "memberships"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_membership_owner_invariant"();

CREATE CONSTRAINT TRIGGER "workshops_owner_invariant"
AFTER INSERT OR UPDATE OF "owner_user_id" ON "workshops"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_workshop_owner_invariant"();

CREATE CONSTRAINT TRIGGER "roles_owner_invariant"
AFTER UPDATE OF "name" ON "roles"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_owner_role_invariant"();

-- User roles are now workshop-scoped memberships.
ALTER TABLE "users" DROP CONSTRAINT "users_role_id_fkey";
DROP INDEX "users_role_id_idx";
ALTER TABLE "users" DROP COLUMN "role_id";

COMMIT;
