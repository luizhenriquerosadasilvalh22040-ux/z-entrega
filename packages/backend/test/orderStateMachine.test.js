const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertCanTransitionOrder,
  canTransitionOrder
} = require('../dist/domain/orderStateMachine');

const { ORDER_STATUS, PAYMENT_STATUS } = require('../dist/domain/orderStatus');

test('merchant cannot accept an unpaid online order', () => {
  const order = {
    status: ORDER_STATUS.PENDING,
    paymentMethod: 'PIX',
    paymentStatus: PAYMENT_STATUS.PENDING
  };

  assert.equal(canTransitionOrder(order, ORDER_STATUS.ACCEPTED, 'merchant'), false);
  assert.throws(
    () => assertCanTransitionOrder(order, ORDER_STATUS.ACCEPTED, 'merchant'),
    /Transição de status inválida/
  );
});

test('merchant can accept a paid online order', () => {
  const order = {
    status: ORDER_STATUS.PAID,
    paymentMethod: 'PIX',
    paymentStatus: PAYMENT_STATUS.RECEIVED
  };

  assert.equal(canTransitionOrder(order, ORDER_STATUS.ACCEPTED, 'merchant'), true);
  assert.doesNotThrow(() => assertCanTransitionOrder(order, ORDER_STATUS.ACCEPTED, 'merchant'));
});

test('merchant can accept an offline cash order while pending', () => {
  const order = {
    status: ORDER_STATUS.PENDING,
    paymentMethod: 'Dinheiro',
    paymentStatus: PAYMENT_STATUS.PENDING
  };

  assert.equal(canTransitionOrder(order, ORDER_STATUS.ACCEPTED, 'merchant'), true);
});

test('final orders cannot transition again', () => {
  const delivered = {
    status: ORDER_STATUS.DELIVERED,
    paymentMethod: 'PIX',
    paymentStatus: PAYMENT_STATUS.RECEIVED
  };

  assert.equal(canTransitionOrder(delivered, ORDER_STATUS.CANCELLED, 'admin'), false);
  assert.throws(
    () => assertCanTransitionOrder(delivered, ORDER_STATUS.CANCELLED, 'admin'),
    /já foi finalizado/
  );
});

test('deliverer cannot skip pickup flow and deliver directly from ready', () => {
  const order = {
    status: ORDER_STATUS.READY,
    paymentMethod: 'PIX',
    paymentStatus: PAYMENT_STATUS.RECEIVED
  };

  assert.equal(canTransitionOrder(order, ORDER_STATUS.DELIVERED, 'deliverer'), false);
});

test('customer cannot perform merchant acceptance transition', () => {
  const order = {
    status: ORDER_STATUS.PAID,
    paymentMethod: 'PIX',
    paymentStatus: PAYMENT_STATUS.RECEIVED
  };

  assert.equal(canTransitionOrder(order, ORDER_STATUS.ACCEPTED, 'customer'), false);
});

test('merchant cannot mark order delivered', () => {
  const order = {
    status: ORDER_STATUS.IN_TRANSIT,
    paymentMethod: 'PIX',
    paymentStatus: PAYMENT_STATUS.RECEIVED
  };

  assert.equal(canTransitionOrder(order, ORDER_STATUS.DELIVERED, 'merchant'), false);
});

test('admin can cancel an active in-transit order', () => {
  const order = {
    status: ORDER_STATUS.IN_TRANSIT,
    paymentMethod: 'PIX',
    paymentStatus: PAYMENT_STATUS.RECEIVED
  };

  assert.equal(canTransitionOrder(order, ORDER_STATUS.CANCELLED, 'admin'), true);
});
