const test = require('node:test');
const assert = require('node:assert/strict');

const loadConfig = () => {
  const modulePath = require.resolve('../dist/config/transactions');
  delete require.cache[modulePath];
  return require('../dist/config/transactions');
};

test('critical transaction config uses production-safe defaults', () => {
  delete process.env.PRISMA_ORDER_TX_MAX_WAIT_MS;
  delete process.env.PRISMA_ORDER_TX_TIMEOUT_MS;
  delete process.env.PRISMA_PAYMENT_TX_MAX_WAIT_MS;
  delete process.env.PRISMA_PAYMENT_TX_TIMEOUT_MS;

  const {
    orderCreationTransactionOptions,
    paymentSyncTransactionOptions
  } = loadConfig();

  assert.deepEqual(orderCreationTransactionOptions, {
    maxWait: 10000,
    timeout: 20000
  });
  assert.deepEqual(paymentSyncTransactionOptions, {
    maxWait: 10000,
    timeout: 15000
  });
});

test('critical transaction config accepts positive integer env overrides', () => {
  process.env.PRISMA_ORDER_TX_MAX_WAIT_MS = '12000';
  process.env.PRISMA_ORDER_TX_TIMEOUT_MS = '25000';
  process.env.PRISMA_PAYMENT_TX_MAX_WAIT_MS = '11000';
  process.env.PRISMA_PAYMENT_TX_TIMEOUT_MS = '18000';

  const {
    orderCreationTransactionOptions,
    paymentSyncTransactionOptions
  } = loadConfig();

  assert.deepEqual(orderCreationTransactionOptions, {
    maxWait: 12000,
    timeout: 25000
  });
  assert.deepEqual(paymentSyncTransactionOptions, {
    maxWait: 11000,
    timeout: 18000
  });
});

