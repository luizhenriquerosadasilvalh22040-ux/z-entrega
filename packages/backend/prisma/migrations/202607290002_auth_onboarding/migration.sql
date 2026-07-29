ALTER TABLE "merchants"
  ALTER COLUMN "cnpj" DROP NOT NULL,
  ALTER COLUMN "street" DROP NOT NULL,
  ALTER COLUMN "number" DROP NOT NULL,
  ALTER COLUMN "neighborhood" DROP NOT NULL,
  ALTER COLUMN "city" DROP NOT NULL,
  ALTER COLUMN "zip_code" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "email_verification_code_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "email_verification_expires" TIMESTAMP(3);

UPDATE "merchants"
SET "is_email_verified" = true
WHERE "created_at" < NOW();
