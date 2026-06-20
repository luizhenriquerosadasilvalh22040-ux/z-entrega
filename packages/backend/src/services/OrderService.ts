import prisma from '../config/prisma';
import { AsaasService } from './AsaasService';
import { NotificationService } from './NotificationService';
import { IAddress } from '../types';
import logger from '../config/logger';
import { formatCustomer } from './CustomerService';
import { deliveryTimeoutQueue } from '../queues/deliveryQueue';

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
    delivererStatus: order.delivererStatus || undefined,
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
          paymentStatus: this.paymentStatus,
          delivererStatus: this.delivererStatus
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
    actorRole: 'customer' | 'merchant' | 'deliverer'
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
      if (actorRole === 'deliverer' && order.delivererId !== actorId) {
        throw new Error('Unauthorized');
      }

      let delivererId = order.delivererId;
      let delivererStatus = order.delivererStatus;

      if (status === 'READY') {
        const activeDeliverers = await tx.deliverer.findMany({
          where: { isActiveToday: true, isActive: true, isAvailable: true }
        });
        if (activeDeliverers.length > 0) {
          const delivererIds = activeDeliverers.map(d => d.id);
          const activeDeliveriesCounts = await tx.order.groupBy({
            by: ['delivererId'],
            where: {
              delivererId: { in: delivererIds },
              status: { in: ['READY', 'DISPATCHED', 'IN_TRANSIT'] }
            },
            _count: { id: true }
          });

          const countsMap = new Map<string, number>();
          activeDeliveriesCounts.forEach(c => {
            if (c.delivererId) countsMap.set(c.delivererId, c._count.id);
          });

          activeDeliverers.sort((a, b) => {
            const countA = countsMap.get(a.id) || 0;
            const countB = countsMap.get(b.id) || 0;
            return countA - countB;
          });

          const driver = activeDeliverers[0];
          delivererId = driver.id;
          delivererStatus = 'PENDING';
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
          delivererId,
          delivererStatus
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

      // Sincroniza o status do entregador baseado na transição
      if (deliverer) {
        if (status === 'DISPATCHED' || status === 'IN_TRANSIT') {
          await tx.deliverer.update({
            where: { id: deliverer.id },
            data: { deliveryStatus: 'DELIVERING' }
          });
        } else if (status === 'DELIVERED' || status === 'CANCELLED') {
          await tx.deliverer.update({
            where: { id: deliverer.id },
            data: { deliveryStatus: 'AVAILABLE' }
          });
        }
      }

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
            content: `Olá, *${deliverer.name}*! Novo pedido pronto para coleta no estabelecimento *${merchant.name}* (Endereço: ${pickupAddr}). Destino: ${delivAddr}. Taxa de entrega: R$ ${updatedOrder.deliveryFee.toFixed(2)}.\n\nResponda a esta entrega:\nAceitar: http://localhost:3000/api/orders/${updatedOrder.id}/delivery-response?delivererId=${deliverer.id}&action=accept\nRecusar: http://localhost:3000/api/orders/${updatedOrder.id}/delivery-response?delivererId=${deliverer.id}&action=reject`
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

    // Agenda o timeout fora da transação
    if (status === 'READY' && savedOrder.delivererId) {
      try {
        await deliveryTimeoutQueue.add(
          { orderId: savedOrder.id, delivererId: savedOrder.delivererId },
          { delay: 5 * 60 * 1000 }
        );
        logger.info(`⏰ [Timeout Scheduled] Timeout de 5 minutos agendado para o pedido ${savedOrder.id} (Entregador: ${savedOrder.delivererId})`);
      } catch (err) {
        logger.error('Erro ao agendar timeout de entrega na fila Bull:', err);
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

  /**
   * Processa a resposta do entregador (Aceitar/Recusar)
   */
  public static async processDelivererResponse(
    orderId: string, 
    delivererId: string, 
    action: 'accept' | 'reject'
  ): Promise<{ success: boolean; message: string }> {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { merchant: true, customer: true }
      });

      if (!order) {
        throw new Error('Pedido não encontrado.');
      }

      if (order.status !== 'READY') {
        return { success: false, message: 'Este pedido já foi coletado, entregue ou cancelado.' };
      }

      if (order.delivererId !== delivererId) {
        return { success: false, message: 'Esta entrega já foi atribuída a outro motoboy.' };
      }

      if (order.delivererStatus !== 'PENDING') {
        return { success: false, message: `Você já respondeu a esta entrega anteriormente (Status: ${order.delivererStatus}).` };
      }

      if (action === 'accept') {
        // Atualiza status de resposta da entrega e do motoboy
        await tx.order.update({
          where: { id: orderId },
          data: { delivererStatus: 'ACCEPTED' }
        });

        await tx.deliverer.update({
          where: { id: delivererId },
          data: { deliveryStatus: 'COLLECTING' }
        });

        // Notifica o lojista via WhatsApp
        await NotificationService.queueNotification({
          userId: order.merchantId,
          userType: 'Merchant',
          type: 'WhatsApp',
          target: order.merchant.phone,
          content: `O motoboy aceitou a entrega do pedido nº *${orderId}* e está a caminho do estabelecimento.`
        }, tx);

        return { success: true, message: 'Você aceitou a entrega com sucesso! Dirija-se ao estabelecimento para a coleta.' };
      } else {
        // Rejeitar: remove o entregador, marca-o como disponível de novo
        await tx.order.update({
          where: { id: orderId },
          data: { 
            delivererId: null,
            delivererStatus: null
          }
        });

        await tx.deliverer.update({
          where: { id: delivererId },
          data: { deliveryStatus: 'AVAILABLE' }
        });

        return { success: true, message: 'Você recusou a entrega. O pedido será encaminhado para outro motoboy.' };
      }
    });
  }

  /**
   * Reatribui automaticamente o pedido para outro entregador
   */
  public static async autoReassignDeliverer(orderId: string, oldDelivererId: string): Promise<void> {
    logger.info(`🔄 [Auto-Reassign] Iniciando reatribuição para o pedido ${orderId} (Antigo entregador: ${oldDelivererId})...`);

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { merchant: true }
      });

      if (!order || order.status !== 'READY' || order.delivererId !== oldDelivererId || order.delivererStatus !== 'PENDING') {
        logger.info(`🔄 [Auto-Reassign] Pedido ${orderId} já foi aceito, cancelado ou o entregador foi alterado. Abortando reatribuição.`);
        return null;
      }

      // Marca o motoboy que recusou/excedeu o tempo como AVAILABLE
      await tx.deliverer.update({
        where: { id: oldDelivererId },
        data: { deliveryStatus: 'AVAILABLE' }
      });

      // Busca todos os entregadores disponíveis e ativos hoje, excluindo o que recusou/deu timeout
      const activeDeliverers = await tx.deliverer.findMany({
        where: { 
          isActiveToday: true, 
          isActive: true, 
          isAvailable: true,
          id: { not: oldDelivererId }
        }
      });

      if (activeDeliverers.length > 0) {
        const delivererIds = activeDeliverers.map(d => d.id);
        const activeDeliveriesCounts = await tx.order.groupBy({
          by: ['delivererId'],
          where: {
            delivererId: { in: delivererIds },
            status: { in: ['READY', 'DISPATCHED', 'IN_TRANSIT'] }
          },
          _count: { id: true }
        });

        const countsMap = new Map<string, number>();
        activeDeliveriesCounts.forEach(c => {
          if (c.delivererId) countsMap.set(c.delivererId, c._count.id);
        });

        activeDeliverers.sort((a, b) => {
          const countA = countsMap.get(a.id) || 0;
          const countB = countsMap.get(b.id) || 0;
          return countA - countB;
        });

        const newDriver = activeDeliverers[0];

        // Atualiza a ordem com o novo entregador
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            delivererId: newDriver.id,
            delivererStatus: 'PENDING'
          },
          include: { deliverer: true, merchant: true }
        });

        // Envia notificação ao novo entregador
        const pickupAddr = `${order.merchant.street}, ${order.merchant.number} - ${order.merchant.neighborhood}, ${order.merchant.city}`;
        const delivAddr = `${updatedOrder.deliveryStreet}, ${updatedOrder.deliveryNumber} - ${updatedOrder.deliveryNeighborhood}, ${updatedOrder.deliveryCity}` +
          (updatedOrder.deliveryComplement ? `, Complemento: ${updatedOrder.deliveryComplement}` : '') +
          (updatedOrder.deliveryReference ? ` (Ref: ${updatedOrder.deliveryReference})` : '');

        const nId = await NotificationService.queueNotification({
          userId: newDriver.id,
          userType: 'Deliverer',
          type: 'WhatsApp',
          target: newDriver.phone,
          content: `Olá, *${newDriver.name}*! O pedido nº *${orderId}* foi reatribuído a você. Coleta em: *${order.merchant.name}* (Endereço: ${pickupAddr}). Destino: ${delivAddr}. Taxa: R$ ${updatedOrder.deliveryFee.toFixed(2)}.\n\nResponda a esta entrega:\nAceitar: http://localhost:3000/api/orders/${orderId}/delivery-response?delivererId=${newDriver.id}&action=accept\nRecusar: http://localhost:3000/api/orders/${orderId}/delivery-response?delivererId=${newDriver.id}&action=reject`
        }, tx);

        return { updatedOrder, notificationId: nId };
      } else {
        // Se não houver outros motoboys, limpa o entregador e avisa o lojista
        await tx.order.update({
          where: { id: orderId },
          data: {
            delivererId: null,
            delivererStatus: null
          }
        });
        
        // Notifica o merchant
        const nId = await NotificationService.queueNotification({
          userId: order.merchantId,
          userType: 'Merchant',
          type: 'WhatsApp',
          target: order.merchant.phone,
          content: `Atenção: O pedido nº *${orderId}* não foi aceito por nenhum motoboy disponível no momento e ficou sem entregador vinculado.`
        }, tx);

        return { updatedOrder: null, notificationId: nId };
      }
    });

    if (result) {
      try {
        await NotificationService.addJobToQueue(result.notificationId);
      } catch (err) {
        console.error('Erro ao enfileirar notificação de reatribuição:', err);
      }

      // Se atribuiu a um novo entregador, agenda o timeout para ele também
      if (result.updatedOrder && result.updatedOrder.delivererId) {
        try {
          await deliveryTimeoutQueue.add(
            { orderId: result.updatedOrder.id, delivererId: result.updatedOrder.delivererId },
            { delay: 5 * 60 * 1000 }
          );
          logger.info(`⏰ [Timeout Scheduled] Próximo timeout de 5 minutos agendado para o pedido ${result.updatedOrder.id} (Entregador: ${result.updatedOrder.delivererId})`);
        } catch (err) {
          logger.error('Erro ao agendar timeout de entrega na fila Bull:', err);
        }
      }
    }
  }
}
