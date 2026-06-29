export class InventoryService {
  public static async reserveProductStock(
    tx: any,
    product: { id: string; name: string; stockQuantity: number },
    quantity: number
  ): Promise<void> {
    if (product.stockQuantity < quantity) {
      throw new Error(`Estoque insuficiente para o produto: ${product.name}`);
    }

    try {
      await tx.product.update({
        where: { id: product.id, stockQuantity: { gte: quantity } },
        data: { stockQuantity: { decrement: quantity } }
      });
    } catch (err) {
      throw new Error(`Estoque insuficiente para o produto: ${product.name}`);
    }
  }

  public static async restoreOrderStock(tx: any, orderId: string): Promise<void> {
    const orderItems = await tx.orderItem.findMany({
      where: { orderId },
      select: { productId: true, quantity: true }
    });

    for (const item of orderItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { increment: item.quantity } }
      });
    }
  }
}
