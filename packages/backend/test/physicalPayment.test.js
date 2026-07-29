const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCourierPaymentInstruction } = require('../dist/domain/physicalPayment');

test('courier receives card machine instruction for physical card checkout', () => {
  assert.match(
    buildCourierPaymentInstruction({ paymentMethod: 'Cartão na entrega', requiresCardMachine: true }),
    /maquininha/
  );
});

test('courier receives exact cash change instruction', () => {
  assert.match(
    buildCourierPaymentInstruction({ paymentMethod: 'Dinheiro', cashChangeFor: 100 }),
    /R\$ 100,00/
  );
});

