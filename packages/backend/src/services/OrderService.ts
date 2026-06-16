import { Order, IOrderDocument, OrderStatus } from '../models/Order';
import { Product } from '../models/Product';
import { Customer } from '../models/Customer';
import { Merchant } from '../models/Merchant';
import { Deliverer } from '../models/Deliverer';
import { PromotionService } from './PromotionService';
import { NotificationService } from './NotificationService';
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

    const savedOrder = await order.save();

    try {
      await NotificationService.queueNotification({
        userId: customer._id.toString(),
        userType: 'Customer',
        type: 'WhatsApp',
        target: customer.phone,
        content: `Olá, *${customer.name}*! Recebemos o seu pedido nº *${savedOrder._id}* no estabelecimento *${merchant.name}*. Total: R$ ${savedOrder.total.toFixed(2)}. Aguardando confirmação do lojista!`
      });
    } catch (err) {
      console.error('Erro ao enfileirar notificação de criação de pedido:', err);
    }

    return savedOrder;
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

    // Se estiver pronto para entrega, escalamos um entregador do dia
    if (status === 'READY') {
      const activeDeliverers = await Deliverer.find({ isActiveToday: true, isActive: true });
      if (activeDeliverers.length > 0) {
        const driver = activeDeliverers[Math.floor(Math.random() * activeDeliverers.length)];
        order.delivererId = driver._id;
      }
    }

    order.status = status;
    order.statusHistory.push({ status, changedAt: new Date() });

    const savedOrder = await order.save();

    // Dispara as notificações com base no status alterado
    try {
      const populatedOrder = await Order.findById(savedOrder._id)
        .populate<{ customerId: any }>('customerId')
        .populate<{ merchantId: any }>('merchantId')
        .populate<{ delivererId: any }>('delivererId');

      if (populatedOrder) {
        const customer = populatedOrder.customerId;
        const merchant = populatedOrder.merchantId;
        const deliverer = populatedOrder.delivererId;

        if (status === 'ACCEPTED' || status === 'PREPARING') {
          await NotificationService.queueNotification({
            userId: customer._id.toString(),
            userType: 'Customer',
            type: 'WhatsApp',
            target: customer.phone,
            content: `Olá, *${customer.name}*! Seu pedido nº *${populatedOrder._id}* foi aceito por *${merchant.name}* e já está em preparação!`
          });
        } else if (status === 'READY') {
          if (deliverer) {
            // Notifica entregador
            await NotificationService.queueNotification({
              userId: deliverer._id.toString(),
              userType: 'Deliverer',
              type: 'WhatsApp',
              target: deliverer.phone,
              content: `Olá, *${deliverer.name}*! Novo pedido pronto para coleta no estabelecimento *${merchant.name}* (Endereço: ${merchant.address.street}, ${merchant.address.number}). Destino: ${customer.address.street}, ${customer.address.number}. Taxa de entrega: R$ ${populatedOrder.deliveryFee.toFixed(2)}.`
            });
            
            // Notifica cliente com nome do entregador
            await NotificationService.queueNotification({
              userId: customer._id.toString(),
              userType: 'Customer',
              type: 'WhatsApp',
              target: customer.phone,
              content: `Olá, *${customer.name}*! Seu pedido nº *${populatedOrder._id}* está pronto e o entregador *${deliverer.name}* foi acionado para a entrega!`
            });
          } else {
            // Sem entregador escalado
            await NotificationService.queueNotification({
              userId: customer._id.toString(),
              userType: 'Customer',
              type: 'WhatsApp',
              target: customer.phone,
              content: `Olá, *${customer.name}*! Seu pedido nº *${populatedOrder._id}* está pronto e aguardando um entregador disponível.`
            });
          }
        } else if (status === 'DISPATCHED' || status === 'IN_TRANSIT') {
          await NotificationService.queueNotification({
            userId: customer._id.toString(),
            userType: 'Customer',
            type: 'WhatsApp',
            target: customer.phone,
            content: `Olá, *${customer.name}*! Seu pedido nº *${populatedOrder._id}* saiu para entrega e está a caminho do seu endereço!`
          });
        } else if (status === 'DELIVERED') {
          await NotificationService.queueNotification({
            userId: customer._id.toString(),
            userType: 'Customer',
            type: 'WhatsApp',
            target: customer.phone,
            content: `Olá, *${customer.name}*! Seu pedido nº *${populatedOrder._id}* foi entregue! Agradecemos a preferência.`
          });
        } else if (status === 'CANCELLED') {
          await NotificationService.queueNotification({
            userId: customer._id.toString(),
            userType: 'Customer',
            type: 'WhatsApp',
            target: customer.phone,
            content: `Olá, *${customer.name}*! Seu pedido nº *${populatedOrder._id}* foi cancelado.`
          });
        }
      }
    } catch (err) {
      console.error('Erro ao processar notificações de alteração de status do pedido:', err);
    }

    return savedOrder;
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
