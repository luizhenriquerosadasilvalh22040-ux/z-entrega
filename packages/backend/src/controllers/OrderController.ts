import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/OrderService';
import { OrderStatus } from '../models/Order';
import { Customer } from '../models/Customer';

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
}
