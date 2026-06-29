-- Incremental integrity hardening for production operations.
-- These indexes encode idempotency and lookup patterns that application code relies on.

CREATE INDEX IF NOT EXISTS "notifications_user_id_user_type_status_created_at_idx"
  ON "notifications"("user_id", "user_type", "status", "created_at");

CREATE INDEX IF NOT EXISTS "payment_refunds_provider_payment_id_status_idx"
  ON "payment_refunds"("provider", "payment_id", "status");

CREATE INDEX IF NOT EXISTS "payment_refunds_provider_refund_id_idx"
  ON "payment_refunds"("provider", "refund_id");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_provider_refund_id_key"
  ON "payment_refunds"("provider", "refund_id")
  WHERE "refund_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_one_pending_per_payment_idx"
  ON "payment_refunds"("provider", "payment_id")
  WHERE "status" = 'PENDING'::"PaymentRefundStatus";

CREATE INDEX IF NOT EXISTS "delivery_assignments_order_id_status_created_at_idx"
  ON "delivery_assignments"("order_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "delivery_assignments_deliverer_id_status_created_at_idx"
  ON "delivery_assignments"("deliverer_id", "status", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_assignments_order_id_deliverer_id_attempt_key"
  ON "delivery_assignments"("order_id", "deliverer_id", "attempt");

CREATE INDEX IF NOT EXISTS "audit_logs_actor_type_actor_id_created_at_idx"
  ON "audit_logs"("actor_type", "actor_id", "created_at");

CREATE INDEX IF NOT EXISTS "audit_logs_action_created_at_idx"
  ON "audit_logs"("action", "created_at");
