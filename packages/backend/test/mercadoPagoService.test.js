const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMercadoPagoPixPayer } = require('../dist/services/MercadoPagoService');

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
