const test = require('node:test');
const assert = require('node:assert/strict');

const { resolvePaymentReconciliationAction } = require('../dist/domain/paymentReconciliation');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../dist/domain/orderStatus');

test('payment reconciliation confirms approved pending payment', () => {
  const action = resolvePaymentReconciliationAction('approved', {
    status: ORDER_STATUS.PENDING,
    paymentStatus: PAYMENT_STATUS.PENDING
  });

  assert.equal(action, 'CONFIRM_APPROVED_PAYMENT');
});

test('payment reconciliation cancels rejected or expired pending payment', () => {
  assert.equal(
    resolvePaymentReconciliationAction('rejected', {
      status: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING
    }),
    'CANCEL_REJECTED_PENDING_ORDER'
  );

  assert.equal(
    resolvePaymentReconciliationAction('expired', {
      status: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING
    }),
    'MARK_PAYMENT_OVERDUE'
  );
});

test('payment reconciliation does not mutate final or already refunded orders', () => {
  assert.equal(
    resolvePaymentReconciliationAction('approved', {
      status: ORDER_STATUS.CANCELLED,
      paymentStatus: PAYMENT_STATUS.REFUNDED
    }),
    'SKIP_FINAL_OR_REFUNDED_ORDER'
  );
});

test('payment reconciliation keeps provider pending status without mutation', () => {
  assert.equal(
    resolvePaymentReconciliationAction('pending', {
      status: ORDER_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING
    }),
    'KEEP_PENDING'
  );
});
