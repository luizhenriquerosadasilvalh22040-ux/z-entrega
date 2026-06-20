import prisma from '../config/prisma';
import { AsaasService } from './AsaasService';
import { NotificationService } from './NotificationService';
import { IAddress } from '../types';
import logger from '../config/logger';
import { formatCustomer } from './CustomerService';

export const formatOrder = (order: any) => {
  if (!order) return null;
  return {
    _id: order.id,
    id: order.id,
    customerId: order.customer ? {
      _id: order.customer.id,
      id: order.customer.id,
      name: order.customer.name,
      phone: order.customer.phone
    } : order.customerId,
    merchantId: order.merchant ? {
      _id: order.merchant.id,
      id: order.merchant.id,
      name: order.merchant.name,
      phone: order.merchant.phone,
      address: {
        street: order.merchant.street,
        number: order.merchant.number,
        neighborhood: order.merchant.neighborhood,
        city: order.merchant.city
      }
    } : order.merchantId,
    delivererId: order.deliverer ? {
      _id: order.deliverer.id,
      id: order.deliverer.id,
      name: order.deliverer.name,
      phone: order.deliverer.phone
    } : order.delivererId,
    items: order.items?.map((item: any) => ({
      productId: item.productId,
      name: item.name,
      price: Number(item.price),
      quantity: item.quantity,
      chosenOptions: item.options?.map((o: any) => ({
        groupName: o.groupName,
        optionName: o.optionName,
        price: Number(o.price)
      })) || [],
      notes: item.notes || '',
      image: item.product?.image || '',
      description: item.product?.description || ''
    })) || [],
    subtotal: Number(order.subtotal),
    commission: Number(order.commission),
    deliveryFee: Number(order.deliveryFee),
    total: Number(order.total),
    status: order.status,
    statusHistory: order.statusHistory?.map((h: any) => ({
      status: h.status,
      changedAt: h.changedAt
    })) || [],
    paymentMethod: order.paymentMethod,
    deliveryAddress: {
      street: order.deliveryStreet,
      number: order.deliveryNumber,
      neighborhood: order.deliveryNeighborhood,
      city: order.deliveryCity,
      state: order.deliveryState,
      zipCode: order.deliveryZip,
      complement: order.deliveryComplement || '',
      referencePoint: order.deliveryReference || ''
    },
    asaasPaymentId: order.asaasPaymentId || undefined,
    paymentStatus: order.paymentStatus || undefined,
    pixQrCode: order.pixQrCode || undefined,
    pixCopyAndPaste: order.pixCopyAndPaste || undefined,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    review: order.review ? {
      id: order.review.id,
      rating: order.review.rating,
      comment: order.review.comment
    } : undefined,
    save: async function() {
      const updated = await prisma.order.update({
        where: { id: this.id },
        data: {
          status: this.status,
          paymentStatus: this.paymentStatus
        },
        include: {
          customer: true,
          merchant: true,
          deliverer: true,
          statusHistory: true,
          items: {
            include: {
              options: true,
              product: true
            }
          }
        }
      });
      Object.assign(this, formatOrder(updated));
      return this;
    }
  };
};

export class OrderService {
  /**
   * Cria um novo pedido calculando subtotal, descontos, comissão e total
   */  public static async createOrder(
    customerId: string,
    merchantId: string,
    itemsData: { 
      productId: string; 
      quantity: number; 
      chosenOptions?: { groupName: string; optionName: string; price: number }[];
      notes?: string;
    }[],
    paymentMethod: string,
    deliveryAddress?: IAddress,
    couponCode?: string
  ): Promise<any> {
    const savedOrder = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        include: { addresses: true }
      });
      if (!customer) throw new Error('Customer not found');

      const merchant = await tx.merchant.findUnique({
        where: { id: merchantId }
      });
      if (!merchant) throw new Error('Merchant not found');

      if (merchant.isForceClosed) {
        throw new Error('O estabelecimento comercial está fechado manualmente pelo proprietário.');
      }

      // Verifica se o estabelecimento está aberto no horário atual
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [openH, openM] = merchant.openTime.split(':').map(Number);
      const [closeH, closeM] = merchant.closeTime.split(':').map(Number);

      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      let isOpen = false;
      if (closeMinutes < openMinutes) {
        isOpen = (currentMinutes >= openMinutes || currentMinutes < closeMinutes);
      } else {
        isOpen = (currentMinutes >= openMinutes && currentMinutes < closeMinutes);
      }

      if (!isOpen) {
        throw new Error('O estabelecimento comercial está fechado no momento e não está aceitando pedidos.');
      }

      // Carrega produtos e calcula subtotal
      const items = [];
      let subtotal = 0;

      // Obtém promoções ativas para ver se há desconto
      const activePromotions = await tx.promotion.findMany({
        where: {
          merchantId,
          expirationDate: { gte: now }
        }
      });

      // Busca todos os produtos do pedido de uma vez só (evita N+1 queries em loop)
      const productIds = itemsData.map(item => item.productId);
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } }
      });

      // Cria um mapa para facilitar a busca rápida em memória
      const productMap = new Map(dbProducts.map(p => [p.id, p]));

      for (const item of itemsData) {
        const product = productMap.get(item.productId);
        
        if (!product || product.merchantId !== merchantId) throw new Error(`Product not found: ${item.productId}`);
        if (!product.isAvailable) throw new Error(`Product is not available: ${product.name}`);
        if (product.stockQuantity < item.quantity) {
          throw new Error(`Estoque insuficiente para o produto: ${product.name}`);
        }

        // Decrementa o estoque atômicamente garantindo que não fique negativo
        try {
          await tx.product.update({
            where: { id: product.id, stockQuantity: { gte: item.quantity } },
            data: { stockQuantity: { decrement: item.quantity } }
          });
        } catch (err) {
          throw new Error(`Estoque insuficiente para o produto: ${product.name}`);
        }

        const optionsPrice = item.chosenOptions
          ? item.chosenOptions.reduce((sum, opt) => sum + opt.price, 0)
          : 0;

        let baseAndOptionsPrice = product.price + optionsPrice;

        const applicablePromo = activePromotions.find(() => true);

        if (applicablePromo) {
          baseAndOptionsPrice = baseAndOptionsPrice * (1 - applicablePromo.discountPercentage / 100);
        }

        const itemTotal = baseAndOptionsPrice * item.quantity;
        subtotal += itemTotal;

        items.push({
          productId: product.id,
          name: product.name,
          price: baseAndOptionsPrice,
          quantity: item.quantity,
          chosenOptions: item.chosenOptions || [],
          notes: item.notes || ''
        });
      }

      // Processamento e validação de cupom
      let couponDiscount = 0;
      let appliedCouponId = null;

      if (couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: couponCode.toUpperCase() }
        });

        if (!coupon) throw new Error('Cupom de desconto inválido ou não encontrado.');
        if (!coupon.isActive) throw new Error('Este cupom não está mais ativo.');
        if (new Date(coupon.expirationDate) < new Date()) throw new Error('Este cupom já expirou.');
        if (coupon.merchantId && coupon.merchantId !== merchantId) throw new Error('Este cupom não é válido para esta loja.');
        if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
          throw new Error(`O valor mínimo do pedido para este cupom é de R$ ${coupon.minOrderValue.toFixed(2)}.`);
        }
        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
          throw new Error('Este cupom atingiu o limite máximo de utilizações.');
        }

        const usage = await tx.userCouponUsage.findUnique({
          where: {
            userId_couponId: {
              userId: customerId,
              couponId: coupon.id
            }
          }
        });

        if (usage) throw new Error('Você já utilizou este cupom anteriormente.');

        if (coupon.discountType === 'PERCENTAGE') {
          couponDiscount = subtotal * (coupon.discountValue / 100);
        } else {
          couponDiscount = coupon.discountValue;
        }

        if (couponDiscount > subtotal) {
          couponDiscount = subtotal;
        }

        appliedCouponId = coupon.id;

        // Incrementa contagem de usos do cupom de forma atômica contra condições de corrida
        try {
          if (coupon.maxUses !== null) {
            await tx.coupon.update({
              where: { id: coupon.id, usedCount: { lt: coupon.maxUses } },
              data: { usedCount: { increment: 1 } }
            });
          } else {
            await tx.coupon.update({
              where: { id: coupon.id },
              data: { usedCount: { increment: 1 } }
            });
          }
        } catch (err) {
          throw new Error('Este cupom atingiu o limite máximo de utilizações.');
        }

        // Grava o histórico de uso
        await tx.userCouponUsage.create({
          data: {
            userId: customerId,
            couponId: coupon.id
          }
        });
      }

      const subtotalWithDiscount = Math.max(0, subtotal - couponDiscount);
      const commission = subtotalWithDiscount * 0.10;
      const deliveryFee = 5.00;
      const total = subtotalWithDiscount + deliveryFee;

      const finalAddress = deliveryAddress || formatCustomer(customer)?.address;
      if (!finalAddress) {
        throw new Error('Endereço de entrega não definido.');
      }

      let asaasPaymentId = undefined;
      let pixQrCode = undefined;
      let pixCopyAndPaste = undefined;

      const createdOrder = await tx.order.create({
        data: {
          customerId,
          merchantId,
          subtotal: subtotalWithDiscount,
          commission,
          deliveryFee,
          total,
          status: 'PENDING',
          paymentMethod,
          deliveryStreet: finalAddress.street,
          deliveryNumber: finalAddress.number,
          deliveryNeighborhood: finalAddress.neighborhood,
          deliveryCity: finalAddress.city,
          deliveryState: finalAddress.state || 'PR',
          deliveryZip: finalAddress.zipCode,
          deliveryComplement: finalAddress.complement || '',
          deliveryReference: finalAddress.referencePoint || '',
          paymentStatus: 'PENDING',
          couponId: appliedCouponId
        }
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: createdOrder.id,
          status: 'PENDING'
        }
      });

      for (const item of items) {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: createdOrder.id,
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            notes: item.notes
          }
        });

        if (item.chosenOptions && item.chosenOptions.length > 0) {
          await tx.orderItemOption.createMany({
            data: item.chosenOptions.map(opt => ({
              orderItemId: orderItem.id,
              groupName: opt.groupName,
              optionName: opt.optionName,
              price: opt.price
            }))
          });
        }
      }

      if (paymentMethod === 'PIX') {
        const asaasCustomer = formatCustomer(customer)!;
        if (process.env.ASAAS_API_KEY) {
          const asaasCustomerId = await AsaasService.getOrCreateCustomer(asaasCustomer as any);
          const pixPayment = await AsaasService.createPixPayment(
            createdOrder.id,
            total,
            asaasCustomerId
          );
          asaasPaymentId = pixPayment.asaasPaymentId;
          pixQrCode = pixPayment.qrCodeBase64;
          pixCopyAndPaste = pixPayment.copyAndPaste;
        } else {
          logger.warn('⚠️ [Asaas Mock] Chave ASAAS_API_KEY ausente no .env. Gerando dados de PIX fictícios para teste local.');
          asaasPaymentId = `pay_mock_${Math.random().toString(36).substr(2, 9)}`;
          pixQrCode = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
          pixCopyAndPaste = '00020101021226830014br.gov.bcb.pix256100000000000000000000000000000005204000053039865802BR5920Traz Pra Ca Delivery6009Sao Paulo62070503***6304ABCD';
        }

        await tx.order.update({
          where: { id: createdOrder.id },
          data: {
            asaasPaymentId,
            pixQrCode,
            pixCopyAndPaste
          }
        });
      }

      const notificationId = await NotificationService.queueNotification({
        userId: customer.id,
        userType: 'Customer',
        type: 'WhatsApp',
        target: customer.phone,
        content: `Olá, *${customer.name}*! Recebemos o seu pedido nº *${createdOrder.id}* no estabelecimento *${merchant.name}*. Total: R$ ${total.toFixed(2)}. Aguardando confirmação do lojista!`
      }, tx);

      const order = await tx.order.findUnique({
        where: { id: createdOrder.id },
        include: {
          customer: true,
          merchant: true,
          deliverer: true,
          statusHistory: true,
          items: {
            include: {
              options: true,
              product: true
            }
          }
        }
      });

      return { order, notificationId };
    });

    try {
      await NotificationService.addJobToQueue(savedOrder.notificationId);
    } catch (err) {
      console.error('Erro ao adicionar notificação pós-commit à fila:', err);
    }

    return formatOrder(savedOrder.order);
  }

  /**
   * Atualiza o status do pedido e mantém histórico
   */
  public static async updateStatus(
    orderId: string, 
    status: any, 
    actorId: string, 
    actorRole: 'customer' | 'merchant'
  ): Promise<any | null> {
    const notificationsToQueue: string[] = [];

    const savedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId }
      });
      if (!order) throw new Error('Order not found');

      if (actorRole === 'merchant' && order.merchantId !== actorId) {
        throw new Error('Unauthorized');
      }
      if (actorRole === 'customer' && order.customerId !== actorId) {
        throw new Error('Unauthorized');
      }

      let delivererId = order.delivererId;
      if (status === 'READY') {
        const activeDeliverers = await tx.deliverer.findMany({
          where: { isActiveToday: true, isActive: true }
        });
        if (activeDeliverers.length > 0) {
          const driver = activeDeliverers[Math.floor(Math.random() * activeDeliverers.length)];
          delivererId = driver.id;
        }
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status
        }
      });

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status,
          delivererId
        },
        include: {
          customer: true,
          merchant: true,
          deliverer: true,
          statusHistory: true,
          items: {
            include: {
              options: true,
              product: true
            }
          }
        }
      });

      const customer = updatedOrder.customer;
      const merchant = updatedOrder.merchant;
      const deliverer = updatedOrder.deliverer;

      if (status === 'ACCEPTED' || status === 'PREPARING') {
        const nId = await NotificationService.queueNotification({
          userId: customer.id,
          userType: 'Customer',
          type: 'WhatsApp',
          target: customer.phone,
          content: `Olá, *${customer.name}*! Seu pedido nº *${updatedOrder.id}* foi aceito por *${merchant.name}* e já está em preparação!`
        }, tx);
        notificationsToQueue.push(nId);
      } else if (status === 'READY') {
        if (deliverer) {
          const pickupAddr = `${merchant.street}, ${merchant.number} - ${merchant.neighborhood}, ${merchant.city}`;
          const delivAddr = `${updatedOrder.deliveryStreet}, ${updatedOrder.deliveryNumber} - ${updatedOrder.deliveryNeighborhood}, ${updatedOrder.deliveryCity}` +
            (updatedOrder.deliveryComplement ? `, Complemento: ${updatedOrder.deliveryComplement}` : '') +
            (updatedOrder.deliveryReference ? ` (Ref: ${updatedOrder.deliveryReference})` : '');

          const nId1 = await NotificationService.queueNotification({
            userId: deliverer.id,
            userType: 'Deliverer',
            type: 'WhatsApp',
            target: deliverer.phone,
            content: `Olá, *${deliverer.name}*! Novo pedido pronto para coleta no estabelecimento *${merchant.name}* (Endereço: ${pickupAddr}). Destino: ${delivAddr}. Taxa de entrega: R$ ${updatedOrder.deliveryFee.toFixed(2)}.`
          }, tx);
          notificationsToQueue.push(nId1);

          const nId2 = await NotificationService.queueNotification({
            userId: customer.id,
            userType: 'Customer',
            type: 'WhatsApp',
            target: customer.phone,
            content: `Olá, *${customer.name}*! Seu pedido nº *${updatedOrder.id}* está pronto e o entregador *${deliverer.name}* foi acionado para a entrega!`
          }, tx);
          notificationsToQueue.push(nId2);
        } else {
          const nId = await NotificationService.queueNotification({
            userId: customer.id,
            userType: 'Customer',
            type: 'WhatsApp',
            target: customer.phone,
            content: `Olá, *${customer.name}*! Seu pedido nº *${updatedOrder.id}* está pronto e aguardando um entregador disponível.`
          }, tx);
          notificationsToQueue.push(nId);
        }
      } else if (status === 'DISPATCHED' || status === 'IN_TRANSIT') {
        const nId = await NotificationService.queueNotification({
          userId: customer.id,
          userType: 'Customer',
          type: 'WhatsApp',
          target: customer.phone,
          content: `Olá, *${customer.name}*! Seu pedido nº *${updatedOrder.id}* saiu para entrega e está a caminho do seu endereço!`
        }, tx);
        notificationsToQueue.push(nId);
      } else if (status === 'DELIVERED') {
        const nId = await NotificationService.queueNotification({
          userId: customer.id,
          userType: 'Customer',
          type: 'WhatsApp',
          target: customer.phone,
          content: `Olá, *${customer.name}*! Seu pedido nº *${updatedOrder.id}* foi entregue! Agradecemos a preferência.`
        }, tx);
        notificationsToQueue.push(nId);
      } else if (status === 'CANCELLED') {
        const nId = await NotificationService.queueNotification({
          userId: customer.id,
          userType: 'Customer',
          type: 'WhatsApp',
          target: customer.phone,
          content: `Olá, *${customer.name}*! Seu pedido nº *${updatedOrder.id}* foi cancelado.`
        }, tx);
        notificationsToQueue.push(nId);
      }

      return updatedOrder;
    });

    for (const nId of notificationsToQueue) {
      try {
        await NotificationService.addJobToQueue(nId);
      } catch (err) {
        console.error('Erro ao adicionar notificação pós-commit à fila:', err);
      }
    }

    return formatOrder(savedOrder);
  }

  public static async getOrderById(orderId: string): Promise<any | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        merchant: true,
        deliverer: true,
        statusHistory: true,
        review: true,
        items: {
          include: {
            options: true,
            product: true
          }
        }
      }
    });
    return formatOrder(order);
  }

  public static async listCustomerOrders(customerId: string): Promise<any[]> {
    const orders = await prisma.order.findMany({
      where: { customerId },
      include: {
        customer: true,
        merchant: true,
        deliverer: true,
        statusHistory: true,
        review: true,
        items: {
          include: {
            options: true,
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return orders.map(o => formatOrder(o));
  }

  public static async listMerchantOrders(merchantId: string, status?: any): Promise<any[]> {
    const where: any = { merchantId };
    if (status) {
      where.status = status;
    }
    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        merchant: true,
        deliverer: true,
        statusHistory: true,
        items: {
          include: {
            options: true,
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return orders.map(o => formatOrder(o));
  }

  public static async getMerchantStats(merchantId: string): Promise<{
    totalOrders: number;
    pendingOrders: number;
    revenue: number;
    averageTicket: number;
    pixRevenue: number;
    cashRevenue: number;
    cardRevenue: number;
    totalCommission: number;
  }> {
    const orders = await prisma.order.findMany({
      where: { merchantId }
    });
    const pendingOrders = await prisma.order.count({
      where: { merchantId, status: 'PENDING' }
    });

    let revenue = 0;
    let pixRevenue = 0;
    let cashRevenue = 0;
    let cardRevenue = 0;
    let totalCommission = 0;

    orders.forEach(order => {
      if (order.status !== 'PENDING' && order.status !== 'CANCELLED') {
        revenue += order.subtotal;
        totalCommission += order.commission;
        
        if (order.paymentMethod === 'PIX') {
          pixRevenue += order.subtotal;
        } else if (order.paymentMethod === 'Dinheiro') {
          cashRevenue += order.subtotal;
        } else if (order.paymentMethod === 'Cartão') {
          cardRevenue += order.subtotal;
        }
      }
    });

    const completedOrdersCount = orders.filter(o => o.status !== 'PENDING' && o.status !== 'CANCELLED').length;
    const averageTicket = completedOrdersCount > 0 ? revenue / completedOrdersCount : 0;

    return {
      totalOrders: orders.length,
      pendingOrders,
      revenue,
      averageTicket,
      pixRevenue,
      cashRevenue,
      cardRevenue,
      totalCommission
    };
  }

  /**
   * Cancelamento automático de pedidos de PIX não pagos após 10 minutos
   */
  public static async cancelUnpaidPixOrders(io?: any): Promise<void> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const unpaidPixOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        paymentMethod: 'PIX',
        createdAt: { lt: tenMinutesAgo }
      }
    });

    for (const order of unpaidPixOrders) {
      try {
        console.log(`[Auto-Cancel] Expirando pedido PIX não pago: ${order.id}`);
        await this.updateStatus(order.id, 'CANCELLED', order.merchantId, 'merchant');
        
        if (io) {
          io.to(`order:${order.id}`).emit('orderStatusUpdated', {
            orderId: order.id,
            status: 'CANCELLED'
          });
        }
      } catch (err) {
        console.error(`[Auto-Cancel] Erro ao cancelar automaticamente pedido PIX ${order.id}:`, err);
      }
    }
  }
}
