import { Request, Response, NextFunction } from 'express';
import { Order } from '../models/Order';
import { OrderService } from '../services/OrderService';
import logger from '../config/logger';

export class PaymentController {
  /**
   * Recebe as notificações de webhook enviadas pelo Asaas
   */
  public static async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const asaasToken = req.headers['asaas-access-token'];
      const localToken = process.env.ASAAS_WEBHOOK_TOKEN;

      // Validação do token de segurança do webhook
      if (!localToken || asaasToken !== localToken) {
        logger.warn('⚠️ [Asaas Webhook] Tentativa de acesso não autorizada ou token inválido.');
        res.status(401).json({ status: 'fail', message: 'Unauthorized webhook token' });
        return;
      }

      const { event, payment } = req.body;

      if (!payment) {
        res.status(400).json({ status: 'fail', message: 'Missing payment details' });
        return;
      }

      const asaasPaymentId = payment.id;
      const orderId = payment.externalReference;
      const paymentStatus = payment.status;

      logger.info(`💳 [Asaas Webhook] Evento "${event}" recebido para o pagamento ${asaasPaymentId} (Pedido: ${orderId})`);

      // Eventos de sucesso no pagamento
      if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
        const order = await Order.findById(orderId);
        if (!order) {
          logger.error(`❌ [Asaas Webhook] Pedido ${orderId} não encontrado no banco de dados.`);
          res.status(404).json({ status: 'fail', message: `Order ${orderId} not found` });
          return;
        }

        // Se o pedido já não foi pago ou aceito, atualiza
        if (order.status === 'PENDING') {
          logger.info(`💳 [Asaas Webhook] Confirmando pagamento do pedido ${orderId}...`);
          
          order.paymentStatus = 'RECEIVED';
          await order.save();

          // Atualiza o status do pedido para ACCEPTED (Pago e aceito)
          await OrderService.updateStatus(orderId, 'ACCEPTED', order.merchantId.toString(), 'merchant');

          // Notifica em tempo real via WebSocket
          const io = req.app.get('io');
          if (io) {
            io.to(`order:${orderId}`).emit('orderStatusUpdated', { orderId, status: 'ACCEPTED' });
            io.to(`merchant:${order.merchantId.toString()}`).emit('orderStatusUpdated', { orderId, status: 'ACCEPTED' });
            // Força a atualização da lista do lojista
            io.to(`merchant:${order.merchantId.toString()}`).emit('newOrder', order);
          }
          
          logger.info(`💳 [Asaas Webhook] Pedido ${orderId} atualizado para status ACCEPTED devido ao pagamento confirmado.`);
        } else {
          logger.info(`💳 [Asaas Webhook] Pedido ${orderId} já se encontra com status ${order.status}. Nenhuma ação necessária.`);
        }
      } else if (event === 'PAYMENT_OVERDUE') {
        // Se a cobrança vencer, cancela o pedido no sistema
        const order = await Order.findById(orderId);
        if (order && order.status === 'PENDING') {
          logger.info(`💳 [Asaas Webhook] Cancelando pedido ${orderId} por expiração/vencimento do pagamento.`);
          order.paymentStatus = 'OVERDUE';
          await order.save();
          await OrderService.updateStatus(orderId, 'CANCELLED', order.merchantId.toString(), 'merchant');

          const io = req.app.get('io');
          if (io) {
            io.to(`order:${orderId}`).emit('orderStatusUpdated', { orderId, status: 'CANCELLED' });
          }
        }
      }

      res.status(200).json({ status: 'success', received: true });
    } catch (error) {
      logger.error('❌ [Asaas Webhook] Erro ao processar webhook:', error);
      next(error);
    }
  }
}
