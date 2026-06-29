const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isMerchantPubliclyVisible,
  isMerchantSubscriptionActive,
  getMerchantPublicationBlockReason,
  mapMercadoPagoSubscriptionStatus,
  MERCHANT_SUBSCRIPTION_STATUS
} = require('../dist/domain/subscriptionStatus');

test('only ACTIVE subscription status is considered active', () => {
  assert.equal(isMerchantSubscriptionActive(MERCHANT_SUBSCRIPTION_STATUS.ACTIVE), true);
  assert.equal(isMerchantSubscriptionActive(MERCHANT_SUBSCRIPTION_STATUS.PENDING), false);
  assert.equal(isMerchantSubscriptionActive(MERCHANT_SUBSCRIPTION_STATUS.PAUSED), false);
  assert.equal(isMerchantSubscriptionActive(MERCHANT_SUBSCRIPTION_STATUS.CANCELLED), false);
  assert.equal(isMerchantSubscriptionActive(MERCHANT_SUBSCRIPTION_STATUS.FAILED), false);
});

test('merchant is public only when active and subscription is active', () => {
  assert.equal(isMerchantPubliclyVisible({ isActive: true, isVerified: true, subscriptionStatus: 'ACTIVE' }), true);
  assert.equal(isMerchantPubliclyVisible({ isActive: false, isVerified: true, subscriptionStatus: 'ACTIVE' }), false);
  assert.equal(isMerchantPubliclyVisible({ isActive: true, isVerified: false, subscriptionStatus: 'ACTIVE' }), false);
  assert.equal(isMerchantPubliclyVisible({ isActive: true, isVerified: true, subscriptionStatus: 'PENDING' }), false);
});

test('merchant publication block reason is explicit', () => {
  assert.equal(getMerchantPublicationBlockReason({ isActive: false, isVerified: true, subscriptionStatus: 'ACTIVE' }), 'Loja inativa.');
  assert.equal(getMerchantPublicationBlockReason({ isActive: true, isVerified: false, subscriptionStatus: 'ACTIVE' }), 'Loja ainda não aprovada pelo admin.');
  assert.equal(getMerchantPublicationBlockReason({ isActive: true, isVerified: true, subscriptionStatus: 'FAILED' }), 'Assinatura do lojista não está ativa.');
  assert.equal(getMerchantPublicationBlockReason({ isActive: true, isVerified: true, subscriptionStatus: 'ACTIVE' }), null);
});

test('Mercado Pago subscription status maps to internal controlled status', () => {
  assert.equal(mapMercadoPagoSubscriptionStatus('authorized'), 'ACTIVE');
  assert.equal(mapMercadoPagoSubscriptionStatus('pending'), 'PENDING');
  assert.equal(mapMercadoPagoSubscriptionStatus('paused'), 'PAUSED');
  assert.equal(mapMercadoPagoSubscriptionStatus('cancelled'), 'CANCELLED');
  assert.equal(mapMercadoPagoSubscriptionStatus('rejected'), 'FAILED');
  assert.equal(mapMercadoPagoSubscriptionStatus('unexpected'), 'INACTIVE');
});
