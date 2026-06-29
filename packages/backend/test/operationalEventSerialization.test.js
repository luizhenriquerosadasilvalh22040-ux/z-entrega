const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getOperationalEventSeverity,
  serializeOperationalEvent
} = require('../dist/domain/operationalEventSerialization');

test('operational event severity highlights critical operational failures', () => {
  assert.equal(getOperationalEventSeverity('PAYMENT_REFUND_FAILED'), 'critical');
  assert.equal(getOperationalEventSeverity('DELIVERY_DISPATCH_ATTEMPTS_EXHAUSTED'), 'critical');
  assert.equal(getOperationalEventSeverity('SYSTEM_SETTINGS_UPDATED'), 'medium');
  assert.equal(getOperationalEventSeverity('ADMIN_NOTIFICATION_REQUEUE_REQUESTED'), 'medium');
  assert.equal(getOperationalEventSeverity('ORDER_STATUS_CHANGED'), 'info');
});

test('operational event serialization exposes safe metadata only', () => {
  const formatted = serializeOperationalEvent({
    id: 'audit-1',
    actorType: 'admin',
    actorId: 'admin-1',
    action: 'PAYMENT_REFUND_FAILED',
    entityType: 'Order',
    entityId: 'order-1',
    orderId: 'order-1',
    merchantId: 'merchant-1',
    metadata: {
      provider: 'mercadopago',
      amount: 42.5,
      paymentId: 'should-not-expose',
      errorMessage: 'should-not-expose',
      checksum: 'should-not-expose'
    },
    ipAddress: '203.0.113.10',
    userAgent: 'Test',
    createdAt: new Date('2026-06-28T10:00:00.000Z')
  });

  assert.equal(formatted.severity, 'critical');
  assert.equal(formatted.label, 'Refund falhou');
  assert.equal(formatted.metadata.provider, 'mercadopago');
  assert.equal(formatted.metadata.amount, 42.5);
  assert.equal(formatted.metadata.paymentId, undefined);
  assert.equal(formatted.metadata.errorMessage, undefined);
  assert.equal(formatted.metadata.checksum, undefined);
  assert.equal(formatted.actorId, undefined);
  assert.equal(formatted.ipAddress, undefined);
  assert.equal(formatted.userAgent, undefined);
});
