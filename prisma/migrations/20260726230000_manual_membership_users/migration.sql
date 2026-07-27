BEGIN;

ALTER TABLE "users"
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "memberships"
  ADD COLUMN "display_name" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "address" TEXT;

UPDATE "memberships" m
SET "display_name" = u."name"
FROM "users" u
WHERE u."id" = m."user_id";

-- Flush the deferred workshop-owner invariant trigger raised by the backfill
-- before issuing another ALTER TABLE against memberships in this transaction.
SET CONSTRAINTS ALL IMMEDIATE;

ALTER TABLE "memberships"
  ALTER COLUMN "display_name" SET NOT NULL;

DROP TABLE "workshop_invitations";
DROP TYPE "invitation_delivery_status";

COMMIT;
