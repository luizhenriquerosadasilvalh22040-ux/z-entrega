const test = require('node:test');
const assert = require('node:assert/strict');

const { InventoryService } = require('../dist/services/InventoryService');

test('reserveProductStock decrements stock through a guarded database update', async () => {
  const updates = [];
  const tx = {
    product: {
      update: async (query) => {
        updates.push(query);
        return { id: query.where.id };
      }
    }
  };

  await InventoryService.reserveProductStock(
    tx,
    { id: 'product-1', name: 'Pizza', stockQuantity: 3 },
    2
  );

  assert.deepEqual(updates, [
    {
      where: { id: 'product-1', stockQuantity: { gte: 2 } },
      data: { stockQuantity: { decrement: 2 } }
    }
  ]);
});

test('reserveProductStock rejects orders larger than current stock before updating', async () => {
  let updateCalled = false;
  const tx = {
    product: {
      update: async () => {
        updateCalled = true;
      }
    }
  };

  await assert.rejects(
    () =>
      InventoryService.reserveProductStock(
        tx,
        { id: 'product-1', name: 'Pizza', stockQuantity: 1 },
        2
      ),
    /Estoque insuficiente/
  );
  assert.equal(updateCalled, false);
});

test('reserveProductStock translates concurrent stock conflicts into a business error', async () => {
  const tx = {
    product: {
      update: async () => {
        throw new Error('Record to update not found.');
      }
    }
  };

  await assert.rejects(
    () =>
      InventoryService.reserveProductStock(
        tx,
        { id: 'product-1', name: 'Pizza', stockQuantity: 2 },
        2
      ),
    /Estoque insuficiente para o produto: Pizza/
  );
});

test('restoreOrderStock restores every product from persisted order items', async () => {
  const restored = [];
  const tx = {
    orderItem: {
      findMany: async (query) => {
        assert.deepEqual(query, {
          where: { orderId: 'order-1' },
          select: { productId: true, quantity: true }
        });
        return [
          { productId: 'product-1', quantity: 2 },
          { productId: 'product-2', quantity: 1 }
        ];
      }
    },
    product: {
      update: async (query) => {
        restored.push(query);
      }
    }
  };

  await InventoryService.restoreOrderStock(tx, 'order-1');

  assert.deepEqual(restored, [
    {
      where: { id: 'product-1' },
      data: { stockQuantity: { increment: 2 } }
    },
    {
      where: { id: 'product-2' },
      data: { stockQuantity: { increment: 1 } }
    }
  ]);
});
