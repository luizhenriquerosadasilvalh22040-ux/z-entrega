const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildMercadoPagoEventId,
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

test('approved payment can move a non-final order forward', () => {
  const action = resolvePaymentWebhookAction('approved', {
    status: ORDER_STATUS.PENDING,
    paymentStatus: PAYMENT_STATUS.PENDING
  });

  assert.equal(action, 'APPROVE_PAYMENT');
});

test('approved payment does not reopen a final order', () => {
  const action = resolvePaymentWebhookAction('approved', {
    status: ORDER_STATUS.CANCELLED,
    paymentStatus: PAYMENT_STATUS.REFUNDED
  });

  assert.equal(action, 'SKIP_FINAL_ORDER');
});

test('rejected payment cancels only pending orders', () => {
  const pendingAction = resolvePaymentWebhookAction('rejected', {
    status: ORDER_STATUS.PENDING,
    paymentStatus: PAYMENT_STATUS.PENDING
  });
  const acceptedAction = resolvePaymentWebhookAction('rejected', {
    status: ORDER_STATUS.ACCEPTED,
    paymentStatus: PAYMENT_STATUS.RECEIVED
  });

  assert.equal(pendingAction, 'CANCEL_PENDING_ORDER');
  assert.equal(acceptedAction, 'SKIP_NON_PENDING_REJECTION');
});

test('pending Mercado Pago status does not mutate the order', () => {
  const action = resolvePaymentWebhookAction('pending', {
    status: ORDER_STATUS.PENDING,
    paymentStatus: PAYMENT_STATUS.PENDING
  });

  assert.equal(action, 'NO_STATUS_CHANGE');
});
