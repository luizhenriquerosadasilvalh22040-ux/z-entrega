const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '202606270001_production_domain_models',
  'migration.sql'
);

const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const privacyMigrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '202606280001_privacy_consent_fields',
  'migration.sql'
);

const privacyMigrationSql = fs.readFileSync(privacyMigrationPath, 'utf8');

const integrityMigrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '202606280002_integrity_indexes',
  'migration.sql'
);

const integrityMigrationSql = fs.readFileSync(integrityMigrationPath, 'utf8');

test('production migration protects core payment and delivery invariants', () => {
  assert.match(migrationSql, /payment_webhook_events_provider_event_id_key/);
  assert.match(migrationSql, /orders_mp_payment_id_key/);
  assert.match(migrationSql, /delivery_assignments_one_pending_per_order_idx/);
  assert.match(migrationSql, /payment_refunds_amount_non_negative_chk/);
});

test('production migration adds operational indexes for common dashboards and workflows', () => {
  assert.match(migrationSql, /orders_merchant_id_status_created_at_idx/);
  assert.match(migrationSql, /orders_payment_status_created_at_idx/);
  assert.match(migrationSql, /notifications_status_created_at_idx/);
  assert.match(migrationSql, /payment_refunds_status_updated_at_idx/);
  assert.match(migrationSql, /merchants_is_active_subscription_status_idx/);
});

test('privacy migration records consent and customer deletion requests', () => {
  assert.match(privacyMigrationSql, /"terms_accepted_at"/);
  assert.match(privacyMigrationSql, /"privacy_accepted_at"/);
  assert.match(privacyMigrationSql, /"marketing_consent" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(privacyMigrationSql, /"data_deletion_requested_at"/);
  assert.match(privacyMigrationSql, /customers_data_deletion_requested_at_idx/);
});

test('integrity migration adds idempotency and operational lookup indexes', () => {
  assert.match(integrityMigrationSql, /payment_refunds_provider_refund_id_key/);
  assert.match(integrityMigrationSql, /WHERE "refund_id" IS NOT NULL/);
  assert.match(integrityMigrationSql, /payment_refunds_one_pending_per_payment_idx/);
  assert.match(integrityMigrationSql, /WHERE "status" = 'PENDING'/);
  assert.match(integrityMigrationSql, /delivery_assignments_order_id_deliverer_id_attempt_key/);
  assert.match(integrityMigrationSql, /delivery_assignments_order_id_status_created_at_idx/);
  assert.match(integrityMigrationSql, /notifications_user_id_user_type_status_created_at_idx/);
  assert.match(integrityMigrationSql, /audit_logs_actor_type_actor_id_created_at_idx/);
  assert.match(integrityMigrationSql, /audit_logs_action_created_at_idx/);
});
