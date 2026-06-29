ALTER TABLE "customers"
  ADD COLUMN "terms_accepted_at" TIMESTAMP(3),
  ADD COLUMN "privacy_accepted_at" TIMESTAMP(3),
  ADD COLUMN "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "data_deletion_requested_at" TIMESTAMP(3);

ALTER TABLE "merchants"
  ADD COLUMN "terms_accepted_at" TIMESTAMP(3),
  ADD COLUMN "privacy_accepted_at" TIMESTAMP(3),
  ADD COLUMN "marketing_consent" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "customers_data_deletion_requested_at_idx"
  ON "customers"("data_deletion_requested_at");
