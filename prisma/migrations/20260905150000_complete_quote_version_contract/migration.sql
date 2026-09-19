BEGIN;

ALTER TYPE "quote_status" ADD VALUE 'SUPERSEDED';
CREATE TYPE "quote_approval_method" AS ENUM ('WHATSAPP', 'PHONE', 'IN_PERSON', 'EMAIL', 'OTHER');

ALTER TABLE "quotes"
  ADD COLUMN "version" INTEGER,
  ADD COLUMN "source_quote_id" UUID,
  ADD COLUMN "currency_code" VARCHAR(3),
  ADD COLUMN "approval_method_detail" VARCHAR(200);

DO $$
DECLARE conflicts TEXT;
BEGIN
  SELECT STRING_AGG("workshop_id"::TEXT || '/' || "service_order_id"::TEXT, ', ')
  INTO conflicts FROM (
    SELECT "workshop_id", "service_order_id" FROM "quotes"
    WHERE "status" IN ('ACTIVE', 'APPROVED')
    GROUP BY "workshop_id", "service_order_id" HAVING COUNT(*) > 1
  ) duplicate_orders;
  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'Conflicting active or approved quotes: %', conflicts;
  END IF;
END $$;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "workshop_id", "service_order_id" ORDER BY "created_at", "id"
  ) AS quote_version, LAG("id") OVER (
    PARTITION BY "workshop_id", "service_order_id" ORDER BY "created_at", "id"
  ) AS predecessor_id FROM "quotes"
)
UPDATE "quotes" q SET "version" = ranked.quote_version,
  "source_quote_id" = ranked.predecessor_id, "currency_code" = 'EUR'
FROM ranked WHERE q."id" = ranked."id";

UPDATE "quotes" SET "approval_method_detail" = "approval_method"
WHERE "approval_method" IS NOT NULL
  AND UPPER(TRIM("approval_method")) NOT IN ('WHATSAPP', 'PHONE', 'IN_PERSON', 'EMAIL', 'OTHER');
ALTER TABLE "quotes" ALTER COLUMN "approval_method" TYPE "quote_approval_method"
USING (CASE WHEN "approval_method" IS NULL THEN NULL
  WHEN UPPER(TRIM("approval_method")) IN ('WHATSAPP', 'PHONE', 'IN_PERSON', 'EMAIL', 'OTHER')
    THEN UPPER(TRIM("approval_method")) ELSE 'OTHER' END)::"quote_approval_method";

ALTER TABLE "quotes" ALTER COLUMN "version" SET NOT NULL,
  ALTER COLUMN "currency_code" SET DEFAULT 'EUR', ALTER COLUMN "currency_code" SET NOT NULL;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_version_positive_check" CHECK ("version" > 0),
  ADD CONSTRAINT "quotes_currency_code_check" CHECK ("currency_code" ~ '^[A-Z]{3}$');
CREATE UNIQUE INDEX "quotes_workshop_id_service_order_id_id_key" ON "quotes"("workshop_id", "service_order_id", "id");
CREATE UNIQUE INDEX "quotes_workshop_id_service_order_id_version_key" ON "quotes"("workshop_id", "service_order_id", "version");
CREATE UNIQUE INDEX "quotes_one_draft_per_order_key" ON "quotes"("workshop_id", "service_order_id") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "quotes_one_active_or_approved_per_order_key" ON "quotes"("workshop_id", "service_order_id") WHERE "status" IN ('ACTIVE', 'APPROVED');
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_source_quote_id_fkey"
  FOREIGN KEY ("workshop_id", "service_order_id", "source_quote_id")
  REFERENCES "quotes"("workshop_id", "service_order_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
