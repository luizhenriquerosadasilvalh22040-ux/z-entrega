const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildMercadoPagoEventId,
  mapMercadoPagoToPaymentStatus,
  resolvePaymentWebhookAction
} = require('../dist/domain/paymentWebhookDecision');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../dist/domain/orderStatus');

test('Mercado Pago webhook event id is deterministic for provider payload retries', () => {
  const eventId = buildMercadoPagoEventId({
    type: 'payment',
    action: 'payment.updated',
    data: { id: 12345 }
  });

  assert.equal(eventId, 'payment:payment.updated:12345');
});

test('mapMercadoPagoToPaymentStatus correctly maps status and status_detail', () => {
  assert.equal(mapMercadoPagoToPaymentStatus('approved', 'accredited'), PAYMENT_STATUS.RECEIVED);
  assert.equal(mapMercadoPagoToPaymentStatus('approved', 'partially_refunded'), PAYMENT_STATUS.REFUNDED);
  assert.equal(mapMercadoPagoToPaymentStatus('pending', 'waiting_payment'), PAYMENT_STATUS.PENDING);
  assert.equal(mapMercadoPagoToPaymentStatus('rejected', 'cc_rejected_insufficient_amount'), PAYMENT_STATUS.REJECTED);
  assert.equal(mapMercadoPagoToPaymentStatus('cancelled', 'expired'), PAYMENT_STATUS.OVERDUE);
  assert.equal(mapMercadoPagoToPaymentStatus('cancelled', 'by_payer'), PAYMENT_STATUS.CANCELLED);
  assert.equal(mapMercadoPagoToPaymentStatus('refunded', 'refunded'), PAYMENT_STATUS.REFUNDED);
  assert.equal(mapMercadoPagoToPaymentStatus('charged_back', 'in_process'), PAYMENT_STATUS.REFUND_PENDING);
  assert.equal(mapMercadoPagoToPaymentStatus('charged_back', 'settled'), PAYMENT_STATUS.REFUNDED);
  assert.equal(mapMercadoPagoToPaymentStatus('in_mediation', 'pending'), PAYMENT_STATUS.REFUND_PENDING);
});

test('approved payment moves a pending order to PAID (action APPROVE_PAYMENT)', () => {
  const action = resolvePaymentWebhookAction(PAYMENT_STATUS.RECEIVED, {
    status: ORDER_STATUS.PENDING,
    paymentStatus: PAYMENT_STATUS.PENDING
  });

  assert.equal(action, 'APPROVE_PAYMENT');
});

test('approved payment only updates payment status on a final or non-pending order', () => {
  const action1 = resolvePaymentWebhookAction(PAYMENT_STATUS.RECEIVED, {
    status: ORDER_STATUS.ACCEPTED,
    paymentStatus: PAYMENT_STATUS.PENDING
  });
  const action2 = resolvePaymentWebhookAction(PAYMENT_STATUS.RECEIVED, {
    status: ORDER_STATUS.DELIVERED,
    paymentStatus: PAYMENT_STATUS.PENDING
  });

  assert.equal(action1, 'UPDATE_PAYMENT_STATUS_ONLY');
  assert.equal(action2, 'SKIP_FINAL_ORDER');
});

test('rejection or cancellation cancels a pending order', () => {
  const rejectedAction = resolvePaymentWebhookAction(PAYMENT_STATUS.REJECTED, {
    status: ORDER_STATUS.PENDING,
    paymentStatus: PAYMENT_STATUS.PENDING
  });
  const cancelledAction = resolvePaymentWebhookAction(PAYMENT_STATUS.CANCELLED, {
    status: ORDER_STATUS.PENDING,
    paymentStatus: PAYMENT_STATUS.PENDING
  });

  assert.equal(rejectedAction, 'CANCEL_PENDING_ORDER');
  assert.equal(cancelledAction, 'CANCEL_PENDING_ORDER');
});

test('rejection or cancellation on non-pending order skips transition', () => {
  const action = resolvePaymentWebhookAction(PAYMENT_STATUS.REJECTED, {
    status: ORDER_STATUS.ACCEPTED,
    paymentStatus: PAYMENT_STATUS.RECEIVED
  });

  assert.equal(action, 'SKIP_NON_PENDING_REJECTION');
});

test('refund cancels a preparing order (CANCEL_ORDER_BY_REFUND)', () => {
  const action = resolvePaymentWebhookAction(PAYMENT_STATUS.REFUNDED, {
    status: ORDER_STATUS.PREPARING,
    paymentStatus: PAYMENT_STATUS.RECEIVED
  });

  assert.equal(action, 'CANCEL_ORDER_BY_REFUND');
});

test('refund on dispatched/in-transit/delivered order does not cancel order logistics', () => {
  const action = resolvePaymentWebhookAction(PAYMENT_STATUS.REFUNDED, {
    status: ORDER_STATUS.IN_TRANSIT,
    paymentStatus: PAYMENT_STATUS.RECEIVED
  });

  assert.equal(action, 'UPDATE_PAYMENT_STATUS_ONLY');
});

