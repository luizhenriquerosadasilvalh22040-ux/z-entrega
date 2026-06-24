import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/OrderService';
import { MercadoPagoService } from '../services/MercadoPagoService';
import logger from '../config/logger';
import prisma from '../config/prisma';

export class PaymentController {
  /**
   * Redireciona o lojista para a página de autorização do Mercado Pago
   */
  public static async oauthConnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchantId = req.query.merchantId as string;
      if (!merchantId) {
        res.status(400).json({ status: 'fail', message: 'ID do lojista (merchantId) é obrigatório.' });
        return;
      }

      const url = MercadoPagoService.getOAuthUrl(merchantId);
      logger.info(`💳 [Mercado Pago OAuth] Redirecionando lojista ${merchantId} para conectar...`);
      res.redirect(url);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Recebe o callback de autorização do Mercado Pago e vincula a conta do lojista
   */
  public static async oauthCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state: merchantId, error } = req.query;

      if (error) {
        logger.error(`❌ [Mercado Pago OAuth] Erro no consentimento do lojista: ${error}`);
        res.status(400).send(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #121214; color: #fff;">
              <h2 style="color: #ff5555;">Falha na Conexão</h2>
              <p>Você recusou ou houve um erro ao conectar sua conta do Mercado Pago.</p>
            </body>
          </html>
        `);
        return;
      }

      if (!code || !merchantId) {
        res.status(400).send('Parâmetros obrigatórios ausentes.');
        return;
      }

      await MercadoPagoService.handleOAuthCallback(code as string, merchantId as string);

      res.status(200).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #121214; color: #fff;">
            <h2 style="color: #4cd62b;">Conexão Concluída com Sucesso!</h2>
            <p>Sua conta do Mercado Pago foi vinculada ao Traz Pra Cá com sucesso.</p>
            <p>Você já pode fechar esta página e voltar para o aplicativo.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      logger.error('❌ [Mercado Pago OAuth] Erro no callback:', error);
      res.status(500).send(`Erro interno ao vincular conta: ${error.message}`);
    }
  }

  /**
   * Cria uma assinatura recorrente para o lojista
   */
  public static async subscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        res.status(403).json({ status: 'fail', message: 'Apenas lojistas podem assinar o serviço.' });
        return;
      }

      const { cardToken, email } = req.body;
      if (!cardToken || !email) {
        res.status(400).json({ status: 'fail', message: 'Token do cartão e e-mail do pagador são obrigatórios.' });
        return;
      }

      const subscription = await MercadoPagoService.createSubscription(req.user.userId, cardToken, email);
      res.status(201).json({
        status: 'success',
        data: { subscription }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancela a assinatura recorrente do lojista
   */
  public static async cancelSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        res.status(403).json({ status: 'fail', message: 'Não autorizado.' });
        return;
      }

      await MercadoPagoService.cancelSubscription(req.user.userId);
      res.status(200).json({
        status: 'success',
        message: 'Assinatura cancelada com sucesso.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Recebe as notificações de webhook enviadas pelo Mercado Pago
   */
  public static async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, action, data } = req.body;

      if (!data || !data.id) {
        logger.warn('⚠️ [Mercado Pago Webhook] Webhook recebido com corpo inválido.');
        res.status(400).json({ status: 'fail', message: 'Missing notification data' });
        return;
      }

      const paymentId = String(data.id);
      logger.info(`💳 [Mercado Pago Webhook] Notificação do tipo "${type}" com ação "${action}" para o ID ${paymentId}`);

      // Webhook de pagamento
      if (type === 'payment') {
        // Encontra o pedido associado ao pagamento
        const order = await prisma.order.findFirst({
          where: { mpPaymentId: paymentId }
        });

        if (!order) {
          logger.warn(`⚠️ [Mercado Pago Webhook] Pedido com mpPaymentId ${paymentId} não encontrado no banco.`);
          res.status(200).json({ status: 'success', message: 'Payment not found in local db, skipping' });
          return;
        }

        const mpStatus = await MercadoPagoService.getPaymentStatus(paymentId, order.merchantId);
        logger.info(`💳 [Mercado Pago Webhook] Status do pagamento ${paymentId} na API: ${mpStatus}`);

        if (mpStatus === 'approved') {
          if (order.status === 'PENDING') {
            logger.info(`💳 [Mercado Pago Webhook] Confirmando pagamento do pedido ${order.id}...`);
            
            await prisma.order.update({
              where: { id: order.id },
              data: { paymentStatus: 'RECEIVED' }
            });

            // Atualiza o status do pedido para ACCEPTED (Pago e aceito)
            const updatedOrder = await OrderService.updateStatus(order.id, 'ACCEPTED', order.merchantId, 'merchant');

            // Notifica em tempo real via WebSocket
            const io = req.app.get('io');
            if (io) {
              io.to(`order:${order.id}`).emit('orderStatusUpdated', { orderId: order.id, status: 'ACCEPTED' });
              io.to(`merchant:${order.merchantId}`).emit('orderStatusUpdated', { orderId: order.id, status: 'ACCEPTED' });
              io.to(`merchant:${order.merchantId}`).emit('newOrder', updatedOrder);
            }
            
            logger.info(`💳 [Mercado Pago Webhook] Pedido ${order.id} atualizado com sucesso.`);
          }
        } else if (mpStatus === 'cancelled' || mpStatus === 'rejected') {
          if (order.status === 'PENDING') {
            logger.info(`💳 [Mercado Pago Webhook] Cancelando pedido ${order.id} por pagamento negado/cancelado.`);
            
            await prisma.order.update({
              where: { id: order.id },
              data: { paymentStatus: 'CANCELLED' }
            });
            
            await OrderService.updateStatus(order.id, 'CANCELLED', order.merchantId, 'merchant');

            const io = req.app.get('io');
            if (io) {
              io.to(`order:${order.id}`).emit('orderStatusUpdated', { orderId: order.id, status: 'CANCELLED' });
            }
          }
        }
      }

      // Webhook de assinatura (recorrência)
      if (type === 'subscription' || type === 'preapproval') {
        const merchant = await prisma.merchant.findFirst({
          where: { mpSubscriptionId: paymentId }
        });

        if (merchant) {
          logger.info(`💳 [Mercado Pago Webhook] Atualizando status de assinatura do lojista ${merchant.id}`);
          // Como simplificação, quando o webhook envia atualização de assinatura, nós validamos o status na API
          // Se action for preapproval.updated ou semelhante, consultamos e salvamos
          const mpSubUrl = `https://api.mercadopago.com/preapproval/${paymentId}`;
          const token = process.env.MERCADO_PAGO_ACCESS_TOKEN || 'mock_access_token';
          const subRes = await fetch(mpSubUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (subRes.ok) {
            const subData: any = await subRes.json();
            const statusMap: Record<string, string> = {
              authorized: 'ACTIVE',
              paused: 'PAUSED',
              cancelled: 'INACTIVE'
            };
            await prisma.merchant.update({
              where: { id: merchant.id },
              data: { subscriptionStatus: statusMap[subData.status] || 'INACTIVE' }
            });
          }
        }
      }

      res.status(200).json({ status: 'success', received: true });
    } catch (error) {
      logger.error('❌ [Mercado Pago Webhook] Erro ao processar webhook:', error);
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
