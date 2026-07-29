const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMerchantOrderMessage } = require('../dist/domain/merchantOrderMessage');

test('merchant order message contains items, delivery and confirmed payment', () => {
  const message = buildMerchantOrderMessage({
    id: '00000000-0000-0000-0000-123456789abc',
    customer: { name: 'Ana', phone: '5544999999999' },
    items: [{
      name: 'X-Bacon',
      quantity: 2,
      price: 20,
      notes: 'Sem cebola',
      options: [{ groupName: 'Adicional', optionName: 'Bacon', price: 3 }]
    }],
    deliveryStreet: 'Rua A',
    deliveryNumber: '10',
    deliveryNeighborhood: 'Centro',
    deliveryCity: 'Umuarama',
    deliveryState: 'PR',
    deliveryComplement: 'Casa',
    deliveryReference: 'Portão azul',
    paymentMethod: 'PIX',
    paymentStatus: 'RECEIVED',
    subtotal: 40,
    deliveryFee: 5,
    total: 45
  });

  assert.match(message, /NOVO PEDIDO #56789ABC/);
  assert.match(message, /2x X-Bacon/);
  assert.match(message, /Adicional: Bacon/);
  assert.match(message, /Sem cebola/);
  assert.match(message, /Rua A, 10/);
  assert.match(message, /PIX • Confirmado/);
  assert.match(message, /Total: R\$ 45,00/);
});

