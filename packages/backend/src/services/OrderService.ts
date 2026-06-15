import { Order, IOrderDocument, OrderStatus } from '../models/Order';
import { Product } from '../models/Product';
import { Customer } from '../models/Customer';
import { Merchant } from '../models/Merchant';
import { PromotionService } from './PromotionService';
import { Types } from 'mongoose';

export class OrderService {
  /**
   * Cria um novo pedido calculando subtotal, descontos, comissão e total
   */
  public static async createOrder(
    customerId: string,
    merchantId: string,
    itemsData: { productId: string; quantity: number }[],
    paymentMethod: string
  ): Promise<IOrderDocument> {
    const customer = await Customer.findById(customerId);
    if (!customer) throw new Error('Customer not found');

    const merchant = await Merchant.findById(merchantId);
    if (!merchant) throw new Error('Merchant not found');

    // 1. Carrega produtos e calcula subtotal
    const items = [];
    let subtotal = 0;

    // Obtém promoções ativas para ver se há desconto
    const activePromotions = await PromotionService.getActivePromotions(merchantId);

    for (const item of itemsData) {
      const product = await Product.findOne({ _id: item.productId, merchantId: merchant._id });
      if (!product) throw new Error(`Product not found: ${item.productId}`);
      if (!product.isAvailable) throw new Error(`Product is not available: ${product.name}`);

      // Verifica se há desconto para este produto
      let price = product.price;
      const applicablePromo = activePromotions.find(
        promo => promo.targetProducts.length === 0 || promo.targetProducts.some(id => id.equals(product._id))
      );

      if (applicablePromo) {
        price = price * (1 - applicablePromo.discountPercentage / 100);
      }

      const itemTotal = price * item.quantity;
      subtotal += itemTotal;

      items.push({
        productId: product._id,
        name: product.name,
        price,
        quantity: item.quantity
      });
    }

    // 2. Calcula taxas
    const commission = subtotal * 0.10; // 10% de comissão
    const deliveryFee = 5.00; // Taxa fixa de entrega de R$ 5
    const total = subtotal + deliveryFee;

    const order = new Order({
      customerId: customer._id,
      merchantId: merchant._id,
      items,
      subtotal,
      commission,
      deliveryFee,
      total,
      status: 'PENDING',
      statusHistory: [{ status: 'PENDING', changedAt: new Date() }],
      paymentMethod,
      deliveryAddress: customer.address
    });

    return await order.save();
  }

  /**
   * Atualiza o status do pedido e mantém histórico
   */
  public static async updateStatus(orderId: string, status: OrderStatus, actorId: string, actorRole: 'customer' | 'merchant'): Promise<IOrderDocument | null> {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    // Verifica permissões básicas
    if (actorRole === 'merchant' && order.merchantId.toString() !== actorId) {
      throw new Error('Unauthorized');
    }
    if (actorRole === 'customer' && order.customerId.toString() !== actorId) {
      throw new Error('Unauthorized');
    }

    order.status = status;
    order.statusHistory.push({ status, changedAt: new Date() });

    return await order.save();
  }

  public static async getOrderById(orderId: string): Promise<IOrderDocument | null> {
    return await Order.findById(orderId)
      .populate('customerId', 'name phone')
      .populate('merchantId', 'name phone address');
  }

  public static async listCustomerOrders(customerId: string): Promise<IOrderDocument[]> {
    return await Order.find({ customerId: new Types.ObjectId(customerId) })
      .populate('merchantId', 'name')
      .sort({ createdAt: -1 });
  }

  public static async listMerchantOrders(merchantId: string, status?: OrderStatus): Promise<IOrderDocument[]> {
    const query: any = { merchantId: new Types.ObjectId(merchantId) };
    if (status) {
      query.status = status;
    }
    return await Order.find(query)
      .populate('customerId', 'name phone address')
      .sort({ createdAt: -1 });
  }

  /**
   * Obtém estatísticas financeiras e contagem de pedidos para um lojista
   */
  public static async getMerchantStats(merchantId: string): Promise<{
    totalOrders: number;
    pendingOrders: number;
    revenue: number;
    averageTicket: number;
  }> {
    const mId = new Types.ObjectId(merchantId);
    
    // Todos os pedidos não cancelados
    const orders = await Order.find({ merchantId: mId, status: { $ne: 'CANCELLED' } });
    const pendingOrders = await Order.countDocuments({ merchantId: mId, status: 'PENDING' });

    let revenue = 0;
    orders.forEach(order => {
      // Se já foi aceito ou concluído, conta como receita para a loja
      if (order.status !== 'PENDING') {
        revenue += order.subtotal;
      }
    });

    const completedOrdersCount = orders.filter(o => o.status !== 'PENDING').length;
    const averageTicket = completedOrdersCount > 0 ? revenue / completedOrdersCount : 0;

    return {
      totalOrders: orders.length,
      pendingOrders,
      revenue,
      averageTicket
    };
  }
}
