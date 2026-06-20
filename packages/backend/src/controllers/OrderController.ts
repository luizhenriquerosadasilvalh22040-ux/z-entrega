import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/OrderService';
import prisma from '../config/prisma';

export class OrderController {
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'customer') {
        res.status(403).json({ status: 'fail', message: 'Only customers can create orders' });
        return;
      }

      const { merchantId, items, paymentMethod, addressDetails, deliveryAddress, couponCode } = req.body;

      // Atualiza detalhes do endereço no cadastro do cliente se informados (mantido para compatibilidade)
      if (addressDetails) {
        const primaryAddress = await prisma.customerAddress.findFirst({
          where: { customerId: req.user.userId, isPrimary: true }
        });
        if (primaryAddress) {
          await prisma.customerAddress.update({
            where: { id: primaryAddress.id },
            data: {
              complement: addressDetails.complement || '',
              referencePoint: addressDetails.referencePoint || ''
            }
          });
        }
      }

      const order = await OrderService.createOrder(
        req.user.userId,
        merchantId,
        items,
        paymentMethod,
        deliveryAddress,
        couponCode
      );

      const io = req.app.get('io');
      if (io && order) {
        io.to(`merchant:${merchantId}`).emit('newOrder', order);
      }

      res.status(201).json({
        status: 'success',
        data: { order }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'fail', message: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const { status } = req.body;

      const order = await OrderService.updateStatus(
        id,
        status as any,
        req.user.userId,
        req.user.role as any
      );

      const io = req.app.get('io');
      if (io && order) {
        io.to(`order:${id}`).emit('orderStatusUpdated', { orderId: id, status });
      }

      res.status(200).json({
        status: 'success',
        data: { order }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'fail', message: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const order = await OrderService.getOrderById(id);
      
      if (!order) {
        res.status(404).json({ status: 'fail', message: 'Order not found' });
        return;
      }

      // Verifica se o usuário atual tem direito de ver este pedido
      const orderCustomerId = typeof order.customerId === 'object' ? (order.customerId.id || order.customerId._id).toString() : order.customerId.toString();
      const orderMerchantId = typeof order.merchantId === 'object' ? (order.merchantId.id || order.merchantId._id).toString() : order.merchantId.toString();

      if (req.user.role === 'customer' && orderCustomerId !== req.user.userId) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }
      if (req.user.role === 'merchant' && orderMerchantId !== req.user.userId) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: { order }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'fail', message: 'Not authenticated' });
        return;
      }

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      let orders: any[] = [];
      if (req.user.role === 'customer') {
        orders = await OrderService.listCustomerOrders(req.user.userId, page, limit);
      } else if (req.user.role === 'merchant') {
        const { status } = req.query;
        orders = await OrderService.listMerchantOrders(req.user.userId, status as any, page, limit);
      }

      res.status(200).json({
        status: 'success',
        results: orders.length,
        page,
        limit,
        data: { orders }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        res.status(403).json({ status: 'fail', message: 'Only merchants can access stats' });
        return;
      }

      const stats = await OrderService.getMerchantStats(req.user.userId);
      res.status(200).json({
        status: 'success',
        data: { stats }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Avalia um pedido entregue
   */
  public static async createReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'customer') {
        res.status(403).json({ status: 'fail', message: 'Apenas clientes podem avaliar pedidos' });
        return;
      }

      const { id: orderId } = req.params;
      const { rating, comment } = req.body;

      if (rating === undefined || rating < 1 || rating > 5) {
        res.status(400).json({ status: 'fail', message: 'A nota de avaliação é obrigatória e deve ser entre 1 e 5 estrelas' });
        return;
      }

      // Busca o pedido para validar
      const order = await prisma.order.findUnique({
        where: { id: orderId }
      });

      if (!order) {
        res.status(404).json({ status: 'fail', message: 'Pedido não encontrado' });
        return;
      }

      if (order.customerId !== req.user.userId) {
        res.status(403).json({ status: 'fail', message: 'Você não tem permissão para avaliar este pedido' });
        return;
      }

      if (order.status !== 'DELIVERED') {
        res.status(400).json({ status: 'fail', message: 'Você só pode avaliar pedidos que já foram entregues' });
        return;
      }

      // Verifica se já foi avaliado
      const existingReview = await prisma.review.findUnique({
        where: { orderId }
      });

      if (existingReview) {
        res.status(400).json({ status: 'fail', message: 'Este pedido já foi avaliado anteriormente' });
        return;
      }

      // Cria a avaliação
      const review = await prisma.review.create({
        data: {
          orderId,
          customerId: req.user.userId,
          merchantId: order.merchantId,
          rating: Number(rating),
          comment: comment || null
        }
      });

      res.status(201).json({
        status: 'success',
        data: { review }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async handleDelivererResponse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { delivererId, action } = req.query;

      if (!delivererId || !action || (action !== 'accept' && action !== 'reject')) {
        res.status(400).send(`
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Erro de Solicitação - Traz Pra Cá</title>
              <style>
                body {
                  background: linear-gradient(135deg, #121214 0%, #1e1e24 100%);
                  color: #e1e1e6;
                  font-family: 'Outfit', 'Inter', sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                }
                .card {
                  background: rgba(255, 255, 255, 0.05);
                  backdrop-filter: blur(10px);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 16px;
                  padding: 40px;
                  max-width: 400px;
                  text-align: center;
                  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
                }
                h1 {
                  color: #ff5555;
                  font-size: 24px;
                  margin-top: 0;
                }
                p {
                  font-size: 16px;
                  line-height: 1.6;
                  color: #a8a8b3;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>Solicitação Inválida</h1>
                <p>Parâmetros obrigatórios ausentes ou incorretos na requisição.</p>
              </div>
            </body>
          </html>
        `);
        return;
      }

      const result = await OrderService.processDelivererResponse(
        id,
        delivererId as string,
        action as 'accept' | 'reject'
      );

      // Renderiza página HTML estilizada de acordo com o resultado
      const title = result.success ? 'Sucesso - Traz Pra Cá' : 'Aviso - Traz Pra Cá';
      const heading = result.success ? 'Operação Concluída!' : 'Não foi possível processar';
      const color = result.success ? '#4cd62b' : '#f1c40f';
      const icon = result.success ? '✓' : '⚠';

      res.status(200).send(`
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>${title}</title>
            <style>
              body {
                background: linear-gradient(135deg, #121214 0%, #1e1e24 100%);
                color: #e1e1e6;
                font-family: 'Outfit', 'Inter', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
              }
              .card {
                background: rgba(255, 255, 255, 0.05);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                padding: 40px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
              }
              .icon {
                font-size: 48px;
                color: ${color};
                margin-bottom: 20px;
              }
              h1 {
                font-size: 24px;
                margin-top: 0;
                color: #ffffff;
              }
              p {
                font-size: 16px;
                line-height: 1.6;
                color: #a8a8b3;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">${icon}</div>
              <h1>${heading}</h1>
              <p>${result.message}</p>
            </div>
          </body>
        </html>
      `);

      // Se a resposta for 'accept' ou 'reject', emite evento via Socket.io para atualizar o status no app em tempo real
      if (result.success) {
        const io = req.app.get('io');
        if (io) {
          if (action === 'accept') {
            io.to(`order:${id}`).emit('orderStatusUpdated', { orderId: id, status: 'READY', delivererStatus: 'ACCEPTED' });
          } else {
            io.to(`order:${id}`).emit('orderStatusUpdated', { orderId: id, status: 'READY', delivererStatus: null });
          }
        }
      }
    } catch (error: any) {
      res.status(500).send(`
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Erro do Servidor - Traz Pra Cá</title>
            <style>
              body {
                background: linear-gradient(135deg, #121214 0%, #1e1e24 100%);
                color: #e1e1e6;
                font-family: 'Outfit', 'Inter', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
              }
              .card {
                background: rgba(255, 255, 255, 0.05);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                padding: 40px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
              }
              h1 {
                color: #ff5555;
                font-size: 24px;
                margin-top: 0;
              }
              p {
                font-size: 16px;
                line-height: 1.6;
                color: #a8a8b3;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Erro Interno</h1>
              <p>${error.message || 'Erro inesperado ao processar a requisição.'}</p>
            </div>
          </body>
        </html>
      `);
    }
  }
}

