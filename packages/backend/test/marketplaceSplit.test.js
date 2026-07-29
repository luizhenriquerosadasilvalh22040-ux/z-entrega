const test = require('node:test');
const assert = require('node:assert/strict');
const { assertValidMarketplaceSplit } = require('../dist/domain/marketplaceSplit');

test('marketplace split preserves a positive seller amount', () => {
  assert.doesNotThrow(() => assertValidMarketplaceSplit(50, 7.5));
  assert.throws(() => assertValidMarketplaceSplit(50, 50), /Taxa do marketplace inválida/);
  assert.throws(() => assertValidMarketplaceSplit(50, 60), /Taxa do marketplace inválida/);
});
