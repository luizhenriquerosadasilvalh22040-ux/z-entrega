-- Production domain hardening:
-- - Move critical string statuses to PostgreSQL enums.
-- - Add payment webhook/refund tables if they do not exist yet.
-- - Add delivery assignment, audit log, and WhatsApp template tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "MerchantSubscriptionStatus" AS ENUM ('INACTIVE', 'PENDING', 'ACTIVE', 'PAUSED', 'CANCELLED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'ACCEPTED', 'PREPARING', 'READY', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'RECEIVED', 'REJECTED', 'CANCELLED', 'OVERDUE', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DelivererResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DelivererWorkStatus" AS ENUM ('AVAILABLE', 'COLLECTING', 'DELIVERING');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentWebhookEventStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'SKIPPED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentRefundStatus" AS ENUM ('PENDING', 'approved', 'rejected', 'cancelled', 'REFUND_FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DeliveryAssignmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'TIMED_OUT', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AuditActorType" AS ENUM ('customer', 'merchant', 'deliverer', 'admin', 'system');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "WhatsAppTemplateType" AS ENUM ('CUSTOMER_OTP', 'ORDER_CREATED', 'STORE_ORDER_CREATED', 'PAYMENT_APPROVED', 'ORDER_ACCEPTED', 'ORDER_CANCELLED', 'ORDER_READY', 'DELIVERY_REQUEST', 'DELIVERY_ACCEPTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "merchants"
  ALTER COLUMN "subscription_status" DROP DEFAULT,
  ALTER COLUMN "subscription_status" TYPE "MerchantSubscriptionStatus" USING COALESCE("subscription_status", 'INACTIVE')::"MerchantSubscriptionStatus",
  ALTER COLUMN "subscription_status" SET DEFAULT 'INACTIVE';

ALTER TABLE "deliverers"
  ALTER COLUMN "delivery_status" DROP DEFAULT,
  ALTER COLUMN "delivery_status" TYPE "DelivererWorkStatus" USING COALESCE("delivery_status", 'AVAILABLE')::"DelivererWorkStatus",
  ALTER COLUMN "delivery_status" SET DEFAULT 'AVAILABLE';

ALTER TABLE "orders"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::"OrderStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING',
  ALTER COLUMN "payment_status" DROP DEFAULT,
  ALTER COLUMN "payment_status" TYPE "PaymentStatus" USING COALESCE("payment_status", 'PENDING')::"PaymentStatus",
  ALTER COLUMN "payment_status" SET DEFAULT 'PENDING',
  ALTER COLUMN "deliverer_status" TYPE "DelivererResponseStatus" USING "deliverer_status"::"DelivererResponseStatus";

ALTER TABLE "order_status_history"
  ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::"OrderStatus";

ALTER TABLE "notifications"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "NotificationStatus" USING "status"::"NotificationStatus",
  ALTER COLUMN "status" SET DEFAULT 'QUEUED';

ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "provider_message_id" TEXT,
  ADD COLUMN IF NOT EXISTS "last_attempt_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "notifications_status_created_at_idx" ON "notifications"("status", "created_at");

ALTER TABLE "coupons"
  ALTER COLUMN "discountType" DROP DEFAULT,
  ALTER COLUMN "discountType" TYPE "CouponDiscountType" USING "discountType"::"CouponDiscountType",
  ALTER COLUMN "discountType" SET DEFAULT 'PERCENTAGE';

CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "event_type" TEXT,
  "action" TEXT,
  "resource_id" TEXT,
  "order_id" UUID,
  "status" "PaymentWebhookEventStatus" NOT NULL DEFAULT 'PROCESSING',
  "payload" JSONB,
  "error_message" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_events_provider_event_id_key" ON "payment_webhook_events"("provider", "event_id");

DO $$ BEGIN
  ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "payment_refunds" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL,
  "order_id" UUID NOT NULL,
  "payment_id" TEXT NOT NULL,
  "refund_id" TEXT,
  "amount" DOUBLE PRECISION,
  "status" "PaymentRefundStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payment_refunds_order_id_idx" ON "payment_refunds"("order_id");

DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "delivery_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "deliverer_id" UUID NOT NULL,
  "status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'PENDING',
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "sent_at" TIMESTAMP(3),
  "responded_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "delivery_assignments_order_id_idx" ON "delivery_assignments"("order_id");
CREATE INDEX IF NOT EXISTS "delivery_assignments_deliverer_id_idx" ON "delivery_assignments"("deliverer_id");

DO $$ BEGIN
  ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_deliverer_id_fkey"
    FOREIGN KEY ("deliverer_id") REFERENCES "deliverers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_type" "AuditActorType" NOT NULL,
  "actor_id" UUID,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID,
  "order_id" UUID,
  "merchant_id" UUID,
  "metadata" JSONB,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_order_id_idx" ON "audit_logs"("order_id");
CREATE INDEX IF NOT EXISTS "audit_logs_merchant_id_idx" ON "audit_logs"("merchant_id");

DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_merchant_id_fkey"
    FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "whatsapp_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" "WhatsAppTemplateType" NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'pt-BR',
  "body" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_templates_key_key" ON "whatsapp_templates"("key");

-- High-value production indexes for the core customer/store/order workflows.
CREATE INDEX IF NOT EXISTS "merchants_is_active_subscription_status_idx" ON "merchants"("is_active", "subscription_status");
CREATE INDEX IF NOT EXISTS "merchants_city_category_idx" ON "merchants"("city", "category");
CREATE INDEX IF NOT EXISTS "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");
CREATE INDEX IF NOT EXISTS "products_merchant_id_is_available_is_paused_idx" ON "products"("merchant_id", "is_available", "is_paused");
CREATE INDEX IF NOT EXISTS "products_merchant_id_category_idx" ON "products"("merchant_id", "category");
CREATE UNIQUE INDEX IF NOT EXISTS "orders_mp_payment_id_key" ON "orders"("mp_payment_id");
CREATE INDEX IF NOT EXISTS "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at");
CREATE INDEX IF NOT EXISTS "orders_merchant_id_status_created_at_idx" ON "orders"("merchant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "orders_deliverer_id_status_idx" ON "orders"("deliverer_id", "status");
CREATE INDEX IF NOT EXISTS "orders_payment_status_created_at_idx" ON "orders"("payment_status", "created_at");
CREATE INDEX IF NOT EXISTS "order_status_history_order_id_changed_at_idx" ON "order_status_history"("order_id", "changed_at");
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX IF NOT EXISTS "order_items_product_id_idx" ON "order_items"("product_id");
CREATE INDEX IF NOT EXISTS "payment_webhook_events_status_received_at_idx" ON "payment_webhook_events"("status", "received_at");
CREATE INDEX IF NOT EXISTS "payment_webhook_events_resource_id_idx" ON "payment_webhook_events"("resource_id");
CREATE INDEX IF NOT EXISTS "payment_refunds_status_updated_at_idx" ON "payment_refunds"("status", "updated_at");
CREATE INDEX IF NOT EXISTS "payment_refunds_payment_id_idx" ON "payment_refunds"("payment_id");
CREATE INDEX IF NOT EXISTS "promotions_merchant_id_expiration_date_idx" ON "promotions"("merchant_id", "expiration_date");
CREATE INDEX IF NOT EXISTS "coupons_merchant_id_is_active_expiration_date_idx" ON "coupons"("merchant_id", "is_active", "expiration_date");

-- Constraints that encode invariants relied on by order/payment/delivery services.
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_assignments_one_pending_per_order_idx"
  ON "delivery_assignments"("order_id")
  WHERE "status" = 'PENDING';

DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_stock_quantity_non_negative_chk"
    CHECK ("stock_quantity" >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_price_non_negative_chk"
    CHECK ("price" >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_non_negative_chk"
    CHECK ("subtotal" >= 0 AND "commission" >= 0 AND "delivery_fee" >= 0 AND "total" >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive_chk"
    CHECK ("quantity" > 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_amount_non_negative_chk"
    CHECK ("amount" IS NULL OR "amount" >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_attempt_positive_chk"
    CHECK ("attempt" > 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_attempts_non_negative_chk"
    CHECK ("attempts" >= 0);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range_chk"
    CHECK ("rating" >= 1 AND "rating" <= 5);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "coupons" ADD CONSTRAINT "coupons_values_non_negative_chk"
    CHECK (
      "discount_value" >= 0
      AND ("min_order_value" IS NULL OR "min_order_value" >= 0)
      AND ("max_uses" IS NULL OR "max_uses" > 0)
      AND "used_count" >= 0
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;
