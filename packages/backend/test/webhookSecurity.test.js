const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  assertMercadoPagoWebhookAuthorized,
  maskWebhookPhone,
  sanitizeMercadoPagoWebhookPayload,
  verifyMetaSha256Signature
} = require('../dist/domain/webhookSecurity');

test('Mercado Pago webhook authorization accepts matching header secret', () => {
  assert.doesNotThrow(() => {
    assertMercadoPagoWebhookAuthorized((name) => name === 'x-webhook-secret' ? 'secret-123' : undefined, 'secret-123');
  });
});

test('Mercado Pago webhook authorization rejects missing or wrong secret', () => {
  assert.throws(
    () => assertMercadoPagoWebhookAuthorized(() => undefined, 'secret-123'),
    /Webhook não autorizado/
  );
  assert.throws(
    () => assertMercadoPagoWebhookAuthorized(() => 'wrong-secret', 'secret-123'),
    /Webhook não autorizado/
  );
});

test('Meta webhook signature validates raw body with app secret', () => {
  const rawBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));
  const signature = `sha256=${crypto.createHmac('sha256', 'app-secret').update(rawBody).digest('hex')}`;

  assert.equal(verifyMetaSha256Signature(rawBody, 'app-secret', signature), true);
  assert.equal(verifyMetaSha256Signature(rawBody, 'app-secret', 'sha256=invalid'), false);
});

test('webhook helpers mask phone numbers and sanitize provider payload', () => {
  assert.equal(maskWebhookPhone('5544999999999'), '*********9999');

  const payload = sanitizeMercadoPagoWebhookPayload({
    type: 'payment',
    action: 'payment.updated',
    data: { id: 123, secret: 'should-not-persist' },
    live_mode: true,
    extra: 'ignored'
  });

  assert.deepEqual(payload, {
    type: 'payment',
    action: 'payment.updated',
    data: { id: '123' }
  });
});
