import { Request, Response, NextFunction } from 'express';
import { Order } from '../models/Order';
import { OrderService } from '../services/OrderService';
import logger from '../config/logger';
import prisma from '../config/prisma';

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

  /**
   * Valida um cupom de desconto para o cliente
   */
  public static async validateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'fail', message: 'Not authenticated' });
        return;
      }
      const { userId } = req.user;
      const { code, merchantId, subtotal } = req.body;

      const coupon = await prisma.coupon.findUnique({
        where: { code: code.toUpperCase() },
        include: { merchant: true }
      });

      if (!coupon) {
        res.status(404).json({ status: 'fail', message: 'Cupom de desconto inválido ou não encontrado.' });
        return;
      }

      if (!coupon.isActive) {
        res.status(400).json({ status: 'fail', message: 'Este cupom não está mais ativo.' });
        return;
      }

      if (new Date(coupon.expirationDate) < new Date()) {
        res.status(400).json({ status: 'fail', message: 'Este cupom já expirou.' });
        return;
      }

      if (coupon.merchantId && coupon.merchantId !== merchantId) {
        res.status(400).json({ status: 'fail', message: 'Este cupom não é válido para este estabelecimento.' });
        return;
      }

      if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
        res.status(400).json({ status: 'fail', message: `O valor mínimo do pedido para usar este cupom é de R$ ${coupon.minOrderValue.toFixed(2)}.` });
        return;
      }

      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        res.status(400).json({ status: 'fail', message: 'Este cupom atingiu o limite máximo de utilizações.' });
        return;
      }

      const usage = await prisma.userCouponUsage.findUnique({
        where: {
          userId_couponId: {
            userId,
            couponId: coupon.id
          }
        }
      });

      if (usage) {
        res.status(400).json({ status: 'fail', message: 'Você já utilizou este cupom em um pedido anterior.' });
        return;
      }

      let discount = 0;
      if (coupon.discountType === 'PERCENTAGE') {
        discount = subtotal * (coupon.discountValue / 100);
      } else {
        discount = coupon.discountValue;
      }

      if (discount > subtotal) {
        discount = subtotal;
      }

      res.status(200).json({
        status: 'success',
        data: {
          couponId: coupon.id,
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          discountCalculated: discount
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
