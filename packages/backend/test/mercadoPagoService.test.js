const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildMercadoPagoPixPayer,
  buildMercadoPagoWebhookUrl
} = require('../dist/services/MercadoPagoService');

test('Pix payer uses Mercado Pago customer id when available', () => {
  const payer = buildMercadoPagoPixPayer(
    '35056963',
    'cliente@example.com',
    'Cliente Homologacao'
  );

  assert.deepEqual(payer, { id: '35056963' });
});

test('Pix payer falls back to customer email and name when customer id is missing', () => {
  const payer = buildMercadoPagoPixPayer(
    null,
    'cliente@example.com',
    'Cliente Homologacao'
  );

  assert.deepEqual(payer, {
    email: 'cliente@example.com',
    first_name: 'Cliente',
    last_name: 'Homologacao'
  });
});

test('Mercado Pago webhook URL does not expose secrets in query string', () => {
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = 'secret-that-must-not-be-in-url';

  const url = buildMercadoPagoWebhookUrl('https://api.trazpraca.test/');

  assert.equal(url, 'https://api.trazpraca.test/api/payments/webhook/mercadopago');
  assert.equal(url.includes('secret'), false);
  assert.equal(url.includes('?'), false);
});
