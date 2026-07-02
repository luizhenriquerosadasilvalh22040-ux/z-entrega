import prisma from '../config/prisma';
import logger from '../config/logger';
import { paymentSyncTransactionOptions } from '../config/transactions';
import { ORDER_STATUS, PAYMENT_STATUS } from '../domain/orderStatus';
import { InventoryService } from './InventoryService';
import { MercadoPagoService } from './MercadoPagoService';
import { NotificationService } from './NotificationService';
import { OrderNotificationService } from './OrderNotificationService';

const ORDER_INCLUDE = {
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
};

export class OrderPaymentSyncService {
  public static async confirmPaymentApproved(orderId: string): Promise<any | null> {
    const notificationsToQueue: string[] = [];

    const savedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: ORDER_INCLUDE
      });

      if (!order) throw new Error('Order not found');
      if (order.paymentStatus === PAYMENT_STATUS.RECEIVED && order.status !== ORDER_STATUS.PENDING) {
        return order;
      }
      if (order.status !== ORDER_STATUS.PENDING) {
        return order;
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: PAYMENT_STATUS.RECEIVED,
          status: ORDER_STATUS.PAID
        }
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: ORDER_STATUS.PAID
        }
      });

      notificationsToQueue.push(
        ...await OrderNotificationService.queuePaymentApproved({ tx }, order)
      );

      return await tx.order.findUnique({
        where: { id: order.id },
        include: ORDER_INCLUDE
      });
    }, paymentSyncTransactionOptions);

    for (const notificationId of notificationsToQueue) {
      try {
        await NotificationService.addJobToQueue(notificationId);
      } catch (err) {
        logger.error('Erro ao adicionar notificação pós-commit à fila:', err);
      }
    }

    return savedOrder;
  }

  public static async cancelUnpaidPixOrders(io?: any): Promise<void> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const unpaidPixOrders = await prisma.order.findMany({
      where: {
        status: ORDER_STATUS.PENDING,
        paymentMethod: 'PIX',
        createdAt: { lt: tenMinutesAgo }
      }
    });

    for (const order of unpaidPixOrders) {
      try {
        let isPaidOnGateway = false;

        if (order.mpPaymentId) {
          try {
            const mpStatus = await MercadoPagoService.getPaymentStatus(order.mpPaymentId, order.merchantId);
            if (mpStatus === 'approved') {
              isPaidOnGateway = true;
              logger.info(`💳 [Auto-Cancel Bypass] Pedido ${order.id} pago no Mercado Pago (${mpStatus}). Processando confirmação.`);

              await this.confirmPaymentApproved(order.id);

              if (io) {
                io.to(`order:${order.id}`).emit('orderStatusUpdated', { orderId: order.id, status: ORDER_STATUS.PAID });
                io.to(`merchant:${order.merchantId}`).emit('orderStatusUpdated', { orderId: order.id, status: ORDER_STATUS.PAID });
              }
            }
          } catch (err: any) {
            logger.error(`❌ [Auto-Cancel] Falha ao verificar status do pagamento ${order.mpPaymentId} no Mercado Pago: ${err.message}`);
            continue;
          }
        }

        if (!isPaidOnGateway) {
          logger.info(`[Auto-Cancel] Expirando pedido PIX não pago: ${order.id}`);

          const updateResult = await prisma.$transaction(async (tx) => {
            const result = await tx.order.updateMany({
              where: {
                id: order.id,
                status: ORDER_STATUS.PENDING
              },
              data: {
                status: ORDER_STATUS.CANCELLED,
                paymentStatus: PAYMENT_STATUS.OVERDUE
              }
            });

            if (result.count > 0) {
              await InventoryService.restoreOrderStock(tx, order.id);

              await tx.orderStatusHistory.create({
                data: {
                  orderId: order.id,
                  status: ORDER_STATUS.CANCELLED
                }
              });
            }

            return result;
          });

          if (updateResult.count > 0) {
            if (io) {
              io.to(`order:${order.id}`).emit('orderStatusUpdated', {
                orderId: order.id,
                status: ORDER_STATUS.CANCELLED
              });
            }
            logger.info(`[Auto-Cancel] Pedido PIX ${order.id} cancelado com sucesso.`);
          } else {
            logger.info(`[Auto-Cancel] Pedido PIX ${order.id} já havia sido alterado em paralelo. Cancelamento abortado.`);
          }
        }
      } catch (err) {
        logger.error(`[Auto-Cancel] Erro ao cancelar automaticamente pedido PIX ${order.id}:`, err);
      }
    }
  }
}
