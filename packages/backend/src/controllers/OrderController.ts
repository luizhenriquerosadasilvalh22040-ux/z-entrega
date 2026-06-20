import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/OrderService';
import { OrderStatus } from '../models/Order';
import { Customer } from '../models/Customer';
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
        const customer = await Customer.findById(req.user.userId);
        if (customer) {
          customer.address.complement = addressDetails.complement || '';
          customer.address.referencePoint = addressDetails.referencePoint || '';
          customer.markModified('address');
          await customer.save();
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
        status as OrderStatus,
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
      if (req.user.role === 'customer' && order.customerId._id.toString() !== req.user.userId) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }
      if (req.user.role === 'merchant' && order.merchantId._id.toString() !== req.user.userId) {
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

      let orders: any[] = [];
      if (req.user.role === 'customer') {
        orders = await OrderService.listCustomerOrders(req.user.userId);
      } else if (req.user.role === 'merchant') {
        const { status } = req.query;
        orders = await OrderService.listMerchantOrders(req.user.userId, status as OrderStatus);
      }

      res.status(200).json({
        status: 'success',
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
}
