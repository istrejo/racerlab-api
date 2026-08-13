UPDATE "customers"
SET "document" = NULLIF(
  UPPER(REGEXP_REPLACE(BTRIM("document"), '[[:space:]-]+', '', 'g')),
  ''
)
WHERE "document" IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "customers"
    WHERE "document" IS NOT NULL
    GROUP BY "workshop_id", "document"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce customer document uniqueness: duplicate normalized documents exist within a workshop.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customers_workshop_id_document_key'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE "customers"
      ADD CONSTRAINT "customers_workshop_id_document_key"
      UNIQUE ("workshop_id", "document");
  END IF;
END $$;
