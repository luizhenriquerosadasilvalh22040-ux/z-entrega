const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  assertMercadoPagoWebhookAuthorized,
  maskWebhookPhone,
  sanitizeMercadoPagoWebhookPayload,
  verifyMercadoPagoWebhookSignature,
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

test('Mercado Pago official webhook signature validates x-signature headers', () => {
  const secret = 'mp-secret-123';
  const dataId = '999999999';
  const requestId = 'request-abc';
  const ts = '1704908010';
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const signature = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const getHeader = (name) => {
    if (name === 'x-signature') return `ts=${ts},v1=${signature}`;
    if (name === 'x-request-id') return requestId;
    return undefined;
  };

  assert.equal(verifyMercadoPagoWebhookSignature(getHeader, dataId, secret), true);
  assert.doesNotThrow(() => assertMercadoPagoWebhookAuthorized(getHeader, secret, dataId));
  assert.equal(verifyMercadoPagoWebhookSignature(getHeader, 'wrong-id', secret), false);
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
