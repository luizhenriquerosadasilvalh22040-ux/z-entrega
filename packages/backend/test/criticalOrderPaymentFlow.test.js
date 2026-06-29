const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertCanTransitionOrder,
  canTransitionOrder
} = require('../dist/domain/orderStateMachine');
const {
  buildMercadoPagoEventId,
  resolvePaymentWebhookAction
} = require('../dist/domain/paymentWebhookDecision');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../dist/domain/orderStatus');

test('online order can be accepted only after payment is approved', () => {
  const unpaidOnlineOrder = {
    status: ORDER_STATUS.PENDING,
    paymentMethod: 'PIX',
    paymentStatus: PAYMENT_STATUS.PENDING
  };

  const paidOnlineOrder = {
    status: ORDER_STATUS.PAID,
    paymentMethod: 'PIX',
    paymentStatus: PAYMENT_STATUS.RECEIVED
  };

  assert.equal(canTransitionOrder(unpaidOnlineOrder, ORDER_STATUS.ACCEPTED, 'merchant'), false);
  assert.throws(
    () => assertCanTransitionOrder(unpaidOnlineOrder, ORDER_STATUS.ACCEPTED, 'merchant'),
    /Transição de status inválida/
  );

  assert.equal(canTransitionOrder(paidOnlineOrder, ORDER_STATUS.ACCEPTED, 'merchant'), true);
  assert.doesNotThrow(() =>
    assertCanTransitionOrder(paidOnlineOrder, ORDER_STATUS.ACCEPTED, 'merchant')
  );
});

test('payment rejection cancels only orders still waiting for payment', () => {
  assert.equal(
    resolvePaymentWebhookAction('rejected', {
      status: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING
    }),
    'CANCEL_PENDING_ORDER'
  );

  assert.equal(
    resolvePaymentWebhookAction('rejected', {
      status: ORDER_STATUS.ACCEPTED,
      paymentStatus: PAYMENT_STATUS.RECEIVED
    }),
    'SKIP_NON_PENDING_REJECTION'
  );
});

test('late approved webhook does not reopen refunded or cancelled orders', () => {
  const refundedCancelledOrder = {
    status: ORDER_STATUS.CANCELLED,
    paymentStatus: PAYMENT_STATUS.REFUNDED
  };

  assert.equal(resolvePaymentWebhookAction('approved', refundedCancelledOrder), 'SKIP_FINAL_ORDER');
});

test('Mercado Pago provider retries map to the same internal webhook event id', () => {
  const firstDelivery = {
    type: 'payment',
    action: 'payment.updated',
    data: { id: 'mp-123' }
  };
  const retryDelivery = {
    type: 'payment',
    action: 'payment.updated',
    data: { id: 'mp-123' }
  };

  assert.equal(buildMercadoPagoEventId(firstDelivery), buildMercadoPagoEventId(retryDelivery));
});

test('merchant rejection of a paid order ends the merchant preparation flow', () => {
  const paidOrder = {
    status: ORDER_STATUS.PAID,
    paymentMethod: 'PIX',
    paymentStatus: PAYMENT_STATUS.RECEIVED
  };
  const rejectedOrder = {
    status: ORDER_STATUS.CANCELLED,
    paymentMethod: 'PIX',
    paymentStatus: PAYMENT_STATUS.REFUND_PENDING
  };

  assert.equal(canTransitionOrder(paidOrder, ORDER_STATUS.CANCELLED, 'merchant'), true);
  assert.equal(canTransitionOrder(rejectedOrder, ORDER_STATUS.PREPARING, 'merchant'), false);
  assert.equal(canTransitionOrder(rejectedOrder, ORDER_STATUS.DISPATCHED, 'deliverer'), false);
});
