const test = require('node:test');
const assert = require('node:assert/strict');

const { createNumericOtp, hashOtp, verifyOtpHash } = require('../dist/domain/otpChallenge');

test('OTP challenge creates six numeric digits', () => {
  assert.match(createNumericOtp(), /^\d{6}$/);
});

test('OTP challenge is scoped and verified with constant-time hash comparison', () => {
  const hash = hashOtp('customer-whatsapp', '5544999999999', '123456', 'secret');
  assert.equal(verifyOtpHash(hash, 'customer-whatsapp', '5544999999999', '123456', 'secret'), true);
  assert.equal(verifyOtpHash(hash, 'customer-whatsapp', '5544999999999', '654321', 'secret'), false);
  assert.equal(verifyOtpHash(hash, 'merchant-email', '5544999999999', '123456', 'secret'), false);
});
