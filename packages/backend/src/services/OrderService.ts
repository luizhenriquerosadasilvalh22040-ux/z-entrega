import prisma from '../config/prisma';
import { InventoryService } from './InventoryService';
import { DeliveryDispatchService } from './DeliveryDispatchService';
import { PaymentRefundService } from './PaymentRefundService';
import { NotificationService } from './NotificationService';
import { OrderNotificationService } from './OrderNotificationService';
import { OrderPaymentSyncService } from './OrderPaymentSyncService';
import { OrderCreationService } from './OrderCreationService';
import { AuditLogService, type AuditRequestContext } from './AuditLogService';
import { WhatsAppTemplateService } from './WhatsAppTemplateService';
import { IAddress } from '../types';
import logger from '../config/logger';
import { WhatsAppTemplateType } from '@prisma/client';
import { scheduleDeliveryTimeout } from '../queues/deliveryQueue';
import { createDeliveryResponseToken } from '../utils/deliveryResponseToken';
import { canTryAnotherDeliverer } from '../domain/deliveryDispatchPolicy';
import {
  DELIVERER_RESPONSE_STATUS,
  DELIVERER_WORK_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  ONLINE_PAYMENT_METHODS,
  type OrderStatus
} from '../domain/orderStatus';
import {
  MERCHANT_REVENUE_ORDER_EXCLUDED_STATUSES,
  assertCanTransitionOrder,
  type OrderActorRole
} from '../domain/orderStateMachine';

const getApiPublicUrl = (): string => {
  return (process.env.API_PUBLIC_URL || process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');
};

const buildDeliveryResponseUrl = (
  orderId: string,
  delivererId: string,
  action: 'accept' | 'reject'
): string => {
  const token = createDeliveryResponseToken(orderId, delivererId, action);
  return `${getApiPublicUrl()}/api/orders/${orderId}/delivery-response?delivererId=${delivererId}&action=${action}&token=${encodeURIComponent(token)}`;
};

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
    mpPaymentId: order.mpPaymentId || undefined,
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
   * Cria um novo pedido calculando subtotal, descontos, comissão e total.
   *
   * O fluxo detalhado vive em OrderCreationService para manter o OrderService
   * como fachada de orquestração compatível com controllers existentes.
   */
  public static async createOrder(
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
    couponCode?: string,
    cardToken?: string,
    paymentMethodId?: string,
    installments?: number
  ): Promise<any> {
    const order = await OrderCreationService.createOrder({
      customerId,
      merchantId,
      itemsData,
      paymentMethod,
      deliveryAddress,
      couponCode,
      cardToken,
      paymentMethodId,
      installments
    });

    return formatOrder(order);
  }

  public static async confirmPaymentApproved(orderId: string): Promise<any | null> {
    const savedOrder = await OrderPaymentSyncService.confirmPaymentApproved(orderId);
    return formatOrder(savedOrder);
  }

  /**
   * Atualiza o status do pedido e mantém histórico
   */
  public static async updateStatus(
    orderId: string, 
    status: OrderStatus, 
    actorId: string, 
    actorRole: OrderActorRole,
    auditContext?: AuditRequestContext
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

      assertCanTransitionOrder(order, status, actorRole);

      let delivererId = order.delivererId;
      let delivererStatus = order.delivererStatus;

      if (status === ORDER_STATUS.READY) {
        const driver = await DeliveryDispatchService.findBestAvailableDeliverer(tx);
        if (driver) {
          delivererId = driver.id;
          delivererStatus = DELIVERER_RESPONSE_STATUS.PENDING;
          await DeliveryDispatchService.createPendingAssignment(tx, orderId, driver.id);
        }
      }

      let nextPaymentStatus = order.paymentStatus;
      if (status === ORDER_STATUS.CANCELLED) {
        await InventoryService.restoreOrderStock(tx, orderId);

        if (
          ONLINE_PAYMENT_METHODS.has(order.paymentMethod) &&
          order.paymentStatus === PAYMENT_STATUS.RECEIVED &&
          order.mpPaymentId
        ) {
          nextPaymentStatus = PAYMENT_STATUS.REFUND_PENDING;
        } else if (order.paymentStatus === PAYMENT_STATUS.PENDING) {
          nextPaymentStatus = PAYMENT_STATUS.CANCELLED;
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
          delivererStatus,
          paymentStatus: nextPaymentStatus
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

      const deliverer = updatedOrder.deliverer;

      await AuditLogService.record(tx, {
        actorType: actorRole,
        actorId,
        action: 'ORDER_STATUS_CHANGED',
        entityType: 'Order',
        entityId: orderId,
        orderId,
        merchantId: updatedOrder.merchantId,
        metadata: {
          fromStatus: order.status,
          toStatus: status,
          paymentStatus: nextPaymentStatus,
          delivererId
        },
        context: auditContext
      });

      // Sincroniza o status do entregador baseado na transição
      if (deliverer) {
        if (status === ORDER_STATUS.DISPATCHED || status === ORDER_STATUS.IN_TRANSIT) {
          await tx.deliverer.update({
            where: { id: deliverer.id },
            data: { deliveryStatus: DELIVERER_WORK_STATUS.DELIVERING }
          });
        } else if (status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.CANCELLED) {
          await tx.deliverer.update({
            where: { id: deliverer.id },
            data: { deliveryStatus: DELIVERER_WORK_STATUS.AVAILABLE }
          });
        }
      }

      notificationsToQueue.push(
        ...await OrderNotificationService.queueStatusChanged({ tx }, {
          order: updatedOrder,
          status,
          buildDeliveryResponseUrl
        })
      );

      return updatedOrder;
    });

    for (const nId of notificationsToQueue) {
      try {
        await NotificationService.addJobToQueue(nId);
      } catch (err) {
      logger.error('Erro ao adicionar notificação pós-commit à fila:', err);
      }
    }

    if (
      status === ORDER_STATUS.CANCELLED &&
      savedOrder.paymentStatus === PAYMENT_STATUS.REFUND_PENDING &&
      savedOrder.mpPaymentId
    ) {
      await PaymentRefundService.refundCancelledOrder(savedOrder, `Pedido cancelado por ${actorRole}`, {
        initiatedByActorType: actorRole,
        initiatedByActorId: actorId,
        context: auditContext
      });
    }

    // Agenda o timeout fora da transação
    if (status === ORDER_STATUS.READY && savedOrder.delivererId) {
      try {
        await scheduleDeliveryTimeout(savedOrder.id, savedOrder.delivererId);
      } catch (err) {
        logger.error('Erro ao agendar timeout de entrega na fila BullMQ:', err);
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

  public static async listCustomerOrders(customerId: string, page = 1, limit = 20): Promise<any[]> {
    const skip = (page - 1) * limit;
    const orders = await prisma.order.findMany({
      where: { customerId },
      take: limit,
      skip: skip,
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

  public static async listMerchantOrders(merchantId: string, status?: any, page = 1, limit = 20): Promise<any[]> {
    const skip = (page - 1) * limit;
    const where: any = { merchantId };
    if (status) {
      where.status = status;
    }
    const orders = await prisma.order.findMany({
      where,
      take: limit,
      skip: skip,
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
    // 1. Contagem total de pedidos
    const totalOrders = await prisma.order.count({
      where: { merchantId }
    });

    // 2. Contagem de pedidos pendentes
    const pendingOrders = await prisma.order.count({
      where: { merchantId, status: { in: [ORDER_STATUS.PENDING, ORDER_STATUS.PAID] } }
    });

    // 3. Agregações para pedidos concluídos (não PENDING e não CANCELLED)
    const aggregates = await prisma.order.aggregate({
      where: {
        merchantId,
        status: { notIn: [...MERCHANT_REVENUE_ORDER_EXCLUDED_STATUSES] }
      },
      _sum: {
        subtotal: true,
        commission: true,
        deliveryFee: true
      },
      _count: {
        id: true
      }
    });

    const revenue = aggregates._sum.subtotal || 0;
    const totalCommission = (aggregates._sum.commission || 0) + (aggregates._sum.deliveryFee || 0);
    const completedOrdersCount = aggregates._count.id || 0;
    const averageTicket = completedOrdersCount > 0 ? revenue / completedOrdersCount : 0;

    // 4. Receita agrupada por método de pagamento para pedidos concluídos
    const paymentGroups = await prisma.order.groupBy({
      by: ['paymentMethod'],
      where: {
        merchantId,
        status: { notIn: [...MERCHANT_REVENUE_ORDER_EXCLUDED_STATUSES] }
      },
      _sum: {
        subtotal: true
      }
    });

    let pixRevenue = 0;
    let cashRevenue = 0;
    let cardRevenue = 0;

    paymentGroups.forEach(group => {
      const amount = group._sum.subtotal || 0;
      if (group.paymentMethod === 'PIX') {
        pixRevenue = amount;
      } else if (group.paymentMethod === 'Dinheiro') {
        cashRevenue = amount;
      } else if (group.paymentMethod === 'Cartão') {
        cardRevenue = amount;
      }
    });

    return {
      totalOrders,
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
    await OrderPaymentSyncService.cancelUnpaidPixOrders(io);
  }

  /**
   * Processa a resposta do entregador (Aceitar/Recusar)
   */
  public static async processDelivererResponse(
    orderId: string, 
    delivererId: string, 
    action: 'accept' | 'reject'
  ): Promise<{ success: boolean; message: string }> {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { merchant: true, customer: true, deliverer: true }
      });

      if (!order) {
        throw new Error('Pedido não encontrado.');
      }

      if (order.status !== ORDER_STATUS.READY) {
        return { success: false, message: 'Este pedido já foi coletado, entregue ou cancelado.' };
      }

      if (order.delivererId !== delivererId) {
        return { success: false, message: 'Esta entrega já foi atribuída a outro motoboy.' };
      }

      if (order.delivererStatus !== DELIVERER_RESPONSE_STATUS.PENDING) {
        return { success: false, message: `Você já respondeu a esta entrega anteriormente (Status: ${order.delivererStatus}).` };
      }

      if (action === 'accept') {
        // Atualiza status de resposta da entrega e do motoboy
        const accepted = await tx.order.updateMany({
          where: {
            id: orderId,
            status: ORDER_STATUS.READY,
            delivererId,
            delivererStatus: DELIVERER_RESPONSE_STATUS.PENDING
          },
          data: { delivererStatus: DELIVERER_RESPONSE_STATUS.ACCEPTED }
        });

        if (accepted.count === 0) {
          return { success: false, message: 'Esta entrega já foi respondida ou atribuída a outro motoboy.' };
        }

        await DeliveryDispatchService.ensureAssignmentAccepted(tx, orderId, delivererId);

        await tx.deliverer.update({
          where: { id: delivererId },
          data: { deliveryStatus: DELIVERER_WORK_STATUS.COLLECTING }
        });

        await AuditLogService.record(tx, {
          actorType: 'deliverer',
          actorId: delivererId,
          action: 'DELIVERY_ACCEPTED',
          entityType: 'Order',
          entityId: orderId,
          orderId,
          merchantId: order.merchantId,
          metadata: { delivererId }
        });

        // Notifica o lojista via WhatsApp
        await NotificationService.queueNotification({
          userId: order.merchantId,
          userType: 'Merchant',
          type: 'WhatsApp',
          target: order.merchant.phone,
          content: await WhatsAppTemplateService.render(
            WhatsAppTemplateType.DELIVERY_ACCEPTED,
            {
              merchantName: order.merchant.name,
              orderId,
              delivererName: order.deliverer?.name || 'Motoboy',
              delivererPhone: order.deliverer?.phone || ''
            },
            'O motoboy aceitou a entrega do pedido nº *{{orderId}}* e está a caminho do estabelecimento.',
            tx
          )
        }, tx);

        return { success: true, message: 'Você aceitou a entrega com sucesso! Dirija-se ao estabelecimento para a coleta.' };
      } else {
        // Rejeitar: marca o status da entrega como REJECTED
        const rejected = await tx.order.updateMany({
          where: {
            id: orderId,
            status: ORDER_STATUS.READY,
            delivererId,
            delivererStatus: DELIVERER_RESPONSE_STATUS.PENDING
          },
          data: { 
            delivererStatus: DELIVERER_RESPONSE_STATUS.REJECTED
          }
        });

        if (rejected.count === 0) {
          return { success: false, message: 'Esta entrega já foi respondida ou atribuída a outro motoboy.' };
        }

        await DeliveryDispatchService.ensureAssignmentRejected(tx, orderId, delivererId);

        await tx.deliverer.update({
          where: { id: delivererId },
          data: { deliveryStatus: DELIVERER_WORK_STATUS.AVAILABLE }
        });

        await AuditLogService.record(tx, {
          actorType: 'deliverer',
          actorId: delivererId,
          action: 'DELIVERY_REJECTED',
          entityType: 'Order',
          entityId: orderId,
          orderId,
          merchantId: order.merchantId,
          metadata: { delivererId }
        });

        return { success: true, message: 'Você recusou a entrega. O pedido será encaminhado para outro motoboy.' };
      }
    });

    if (action === 'reject' && result.success) {
      // Dispara reatribuição automática de imediato fora da transação
      this.autoReassignDeliverer(orderId, delivererId, 'rejected').catch(err => {
        logger.error(`[Process Response] Erro ao reatribuir pedido ${orderId} imediatamente pós-rejeição:`, err);
      });
    }

    return result;
  }

  /**
   * Reatribui automaticamente o pedido para outro entregador
   */
  public static async autoReassignDeliverer(
    orderId: string,
    oldDelivererId: string,
    reason: 'rejected' | 'timed_out' = 'timed_out'
  ): Promise<void> {
    logger.info(`🔄 [Auto-Reassign] Iniciando reatribuição para o pedido ${orderId} (Antigo entregador: ${oldDelivererId})...`);

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { merchant: true }
      });

      if (
        !order ||
        order.status !== ORDER_STATUS.READY ||
        order.delivererId !== oldDelivererId ||
        (
          order.delivererStatus !== DELIVERER_RESPONSE_STATUS.PENDING &&
          order.delivererStatus !== DELIVERER_RESPONSE_STATUS.REJECTED
        )
      ) {
        logger.info(`🔄 [Auto-Reassign] Pedido ${orderId} já foi aceito, cancelado ou o entregador foi alterado. Abortando reatribuição.`);
        return null;
      }

      // Marca o motoboy que recusou/excedeu o tempo como AVAILABLE
      await tx.deliverer.update({
        where: { id: oldDelivererId },
        data: { deliveryStatus: DELIVERER_WORK_STATUS.AVAILABLE }
      });

      if (reason === 'timed_out') {
        await DeliveryDispatchService.markAssignmentTimedOut(tx, orderId, oldDelivererId);
      }

      const attemptedDelivererIds = await DeliveryDispatchService.getAttemptedDelivererIds(tx, orderId);
      const attemptsCount = await DeliveryDispatchService.getAttemptCount(tx, orderId);

      if (!canTryAnotherDeliverer(attemptsCount)) {
        await tx.order.update({
          where: { id: orderId },
          data: {
            delivererId: null,
            delivererStatus: null
          }
        });

        await AuditLogService.record(tx, {
          actorType: 'system',
          action: 'DELIVERY_DISPATCH_ATTEMPTS_EXHAUSTED',
          entityType: 'Order',
          entityId: orderId,
          orderId,
          merchantId: order.merchantId,
          metadata: {
            reason,
            oldDelivererId,
            attemptsCount
          }
        });

        const nId = await NotificationService.queueNotification({
          userId: order.merchantId,
          userType: 'Merchant',
          type: 'WhatsApp',
          target: order.merchant.phone,
          content: await WhatsAppTemplateService.render(
            WhatsAppTemplateType.STORE_ORDER_CREATED,
            {
              customerName: 'Cliente',
              orderId,
              paymentMethod: 'Entrega sem motoboy',
              total: Number(order.total).toFixed(2)
            },
            'Atenção: O pedido nº *{{orderId}}* atingiu o limite de tentativas de motoboy e precisa de intervenção do admin.',
            tx
          )
        }, tx);

        return { updatedOrder: null, notificationId: nId };
      }

      // Busca todos os entregadores disponíveis e ativos hoje, excluindo os que já foram tentados.
      const newDriver = await DeliveryDispatchService.findBestAvailableDeliverer(tx, {
        excludeDelivererIds: attemptedDelivererIds
      });

      if (newDriver) {

        // Atualiza a ordem com o novo entregador
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            delivererId: newDriver.id,
            delivererStatus: DELIVERER_RESPONSE_STATUS.PENDING
          },
          include: { deliverer: true, merchant: true }
        });

        await DeliveryDispatchService.createPendingAssignment(tx, orderId, newDriver.id);

        await AuditLogService.record(tx, {
          actorType: 'system',
          action: 'DELIVERY_REASSIGNED',
          entityType: 'Order',
          entityId: orderId,
          orderId,
          merchantId: order.merchantId,
          metadata: {
            reason,
            oldDelivererId,
            newDelivererId: newDriver.id
          }
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
          content: await WhatsAppTemplateService.render(
            WhatsAppTemplateType.DELIVERY_REQUEST,
            {
              delivererName: newDriver.name,
              orderId,
              merchantName: order.merchant.name,
              pickupAddress: pickupAddr,
              deliveryAddress: delivAddr,
              deliveryFee: Number(updatedOrder.deliveryFee).toFixed(2),
              acceptUrl: buildDeliveryResponseUrl(orderId, newDriver.id, 'accept'),
              rejectUrl: buildDeliveryResponseUrl(orderId, newDriver.id, 'reject')
            },
            undefined,
            tx
          )
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

        await AuditLogService.record(tx, {
          actorType: 'system',
          action: 'DELIVERY_UNASSIGNED',
          entityType: 'Order',
          entityId: orderId,
          orderId,
          merchantId: order.merchantId,
          metadata: {
            reason,
            oldDelivererId
          }
        });
        
        // Notifica o merchant
        const nId = await NotificationService.queueNotification({
          userId: order.merchantId,
          userType: 'Merchant',
          type: 'WhatsApp',
          target: order.merchant.phone,
          content: await WhatsAppTemplateService.render(
            WhatsAppTemplateType.STORE_ORDER_CREATED,
            {
              customerName: 'Cliente',
              orderId,
              paymentMethod: 'Sem motoboy disponível',
              total: Number(order.total).toFixed(2)
            },
            'Atenção: O pedido nº *{{orderId}}* não foi aceito por nenhum motoboy disponível no momento e ficou sem entregador vinculado.',
            tx
          )
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
          await scheduleDeliveryTimeout(result.updatedOrder.id, result.updatedOrder.delivererId);
        } catch (err) {
          logger.error('Erro ao agendar timeout de entrega na fila BullMQ:', err);
        }
      }
    }
  }
}
