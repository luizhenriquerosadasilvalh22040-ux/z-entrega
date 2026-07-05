const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getMissingProductionRuntimeConfig,
  assertProductionRuntimeConfig
} = require('../dist/config/runtime');

const productionApiEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'jwt',
  ENCRYPTION_SECRET: 'enc',
  DELIVERY_RESPONSE_SECRET: 'delivery-secret',
  API_PUBLIC_URL: 'https://api.example.com',
  FRONTEND_URL: 'https://app.example.com',
  UPLOADS_PUBLIC_URL: 'https://api.example.com/uploads',
  MERCADO_PAGO_ACCESS_TOKEN: 'mp-access-token',
  MERCADO_PAGO_WEBHOOK_SECRET: 'mp-webhook-secret',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'wa-verify-token',
  WHATSAPP_APP_SECRET: 'wa-app-secret'
};

test('production API runtime config requires critical deployment secrets', () => {
  const missing = getMissingProductionRuntimeConfig({
    NODE_ENV: 'production'
  });

  assert.deepEqual(missing, [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'DELIVERY_RESPONSE_SECRET',
    'API_PUBLIC_URL',
    'MERCADO_PAGO_ACCESS_TOKEN',
    'MERCADO_PAGO_WEBHOOK_SECRET',
    'ENCRYPTION_KEY or ENCRYPTION_SECRET',
    'FRONTEND_URL',
    'UPLOADS_PUBLIC_URL',
    'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
    'WHATSAPP_APP_SECRET'
  ]);
  assert.throws(
    () => assertProductionRuntimeConfig({ NODE_ENV: 'production' }),
    /Missing required production runtime config/
  );
});

test('production runtime config accepts either encryption key or encryption secret', () => {
  assert.deepEqual(getMissingProductionRuntimeConfig({
    ...productionApiEnv,
    ENCRYPTION_KEY: undefined,
    ENCRYPTION_SECRET: 'enc'
  }), []);

  assert.deepEqual(getMissingProductionRuntimeConfig({
    ...productionApiEnv,
    ENCRYPTION_SECRET: undefined,
    ENCRYPTION_KEY: 'a'.repeat(64)
  }), []);
});

test('production worker runtime config requires WhatsApp sender credentials', () => {
  const missing = getMissingProductionRuntimeConfig({
    NODE_ENV: 'production',
    PROCESS_QUEUES: 'true',
    DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'jwt',
    ENCRYPTION_SECRET: 'enc',
    DELIVERY_RESPONSE_SECRET: 'delivery-secret',
    API_PUBLIC_URL: 'https://api.example.com',
    MERCADO_PAGO_ACCESS_TOKEN: 'mp-access-token',
    MERCADO_PAGO_WEBHOOK_SECRET: 'mp-webhook-secret'
  });

  assert.deepEqual(missing, [
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_ACCESS_TOKEN'
  ]);
});

test('non-production runtime config does not require production secrets', () => {
  assert.deepEqual(getMissingProductionRuntimeConfig({
    NODE_ENV: 'test'
  }), []);
});
