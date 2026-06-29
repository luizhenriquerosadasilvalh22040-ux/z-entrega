const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getMissingProductionRuntimeConfig,
  assertProductionRuntimeConfig
} = require('../dist/config/runtime');

test('production runtime config requires JWT and encryption secret', () => {
  const missing = getMissingProductionRuntimeConfig({
    NODE_ENV: 'production'
  });

  assert.deepEqual(missing, ['JWT_SECRET', 'ENCRYPTION_KEY or ENCRYPTION_SECRET']);
  assert.throws(
    () => assertProductionRuntimeConfig({ NODE_ENV: 'production' }),
    /Missing required production runtime config/
  );
});

test('production runtime config accepts either encryption key or encryption secret', () => {
  assert.deepEqual(getMissingProductionRuntimeConfig({
    NODE_ENV: 'production',
    JWT_SECRET: 'jwt',
    ENCRYPTION_SECRET: 'enc'
  }), []);

  assert.deepEqual(getMissingProductionRuntimeConfig({
    NODE_ENV: 'production',
    JWT_SECRET: 'jwt',
    ENCRYPTION_KEY: 'a'.repeat(64)
  }), []);
});

test('non-production runtime config does not require production secrets', () => {
  assert.deepEqual(getMissingProductionRuntimeConfig({
    NODE_ENV: 'test'
  }), []);
});
