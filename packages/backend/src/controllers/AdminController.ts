import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { formatMerchant } from '../services/MerchantService';
import { formatOrder } from '../services/OrderService';
import { formatDeliverer } from '../services/DelivererService';

export class AdminController {
  /**
   * Obtém estatísticas gerais do sistema
   */
  public static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 1. Obter ou criar configuração padrão do sistema
      let config = await prisma.systemConfig.findFirst();
      if (!config) {
        config = await prisma.systemConfig.create({
          data: { defaultSubscriptionPrice: 150.00 }
        });
      }

      // 2. Contagens básicas
      const totalOrders = await prisma.order.count();
      const totalMerchants = await prisma.merchant.count();
      const verifiedMerchants = await prisma.merchant.count({ where: { isVerified: true } });
      const totalDeliverers = await prisma.deliverer.count();
      const activeDeliverersToday = await prisma.deliverer.count({ where: { isActiveToday: true } });

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const dailyOrdersVolume = await prisma.order.count({
        where: {
          createdAt: {
            gte: startOfToday,
            lte: endOfToday
          }
        }
      });

      // 3. Receita total e do dia
      const orders = await prisma.order.findMany({
        where: {
          status: {
            not: 'CANCELLED'
          }
        }
      });
      const totalSales = orders.reduce((sum, order) => sum + Number(order.total), 0);

      // Pedidos entregues
      const completedOrders = await prisma.order.count({ where: { status: 'DELIVERED' } });

      res.status(200).json({
        status: 'success',
        data: {
          stats: {
            totalOrders,
            completedOrders,
            totalMerchants,
            verifiedMerchants,
            totalDeliverers,
            activeDeliverersToday,
            totalSales,
            dailyOrdersVolume,
            defaultSubscriptionPrice: Number(config.defaultSubscriptionPrice)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtém as configurações do sistema
   */
  public static async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let config = await prisma.systemConfig.findFirst();
      if (!config) {
        config = await prisma.systemConfig.create({
          data: { defaultSubscriptionPrice: 150.00 }
        });
      }
      res.status(200).json({
        status: 'success',
        data: { settings: config }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Atualiza as configurações do sistema (preço de assinatura)
   */
  public static async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { defaultSubscriptionPrice } = req.body;
      if (typeof defaultSubscriptionPrice !== 'number' || defaultSubscriptionPrice < 0) {
        res.status(400).json({ status: 'fail', message: 'Preço de assinatura inválido' });
        return;
      }

      let config = await prisma.systemConfig.findFirst();
      if (!config) {
        config = await prisma.systemConfig.create({
          data: { defaultSubscriptionPrice }
        });
      } else {
        config = await prisma.systemConfig.update({
          where: { id: config.id },
          data: { defaultSubscriptionPrice }
        });
      }

      res.status(200).json({
        status: 'success',
        data: { settings: config }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista todos os entregadores cadastrados
   */
  public static async listDeliverers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dbDeliverers = await prisma.deliverer.findMany({
        orderBy: { name: 'asc' }
      });
      const deliverers = dbDeliverers.map(d => formatDeliverer(d));
      res.status(200).json({
        status: 'success',
        data: { deliverers }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Adiciona um novo entregador
   */
  public static async createDeliverer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, phone, vehicle, plate, isActiveToday } = req.body;

      if (!name || !email || !phone || !vehicle) {
        res.status(400).json({ status: 'fail', message: 'Campos obrigatórios: nome, email, telefone, veículo' });
        return;
      }

      const existing = await prisma.deliverer.findFirst({
        where: { email }
      });
      if (existing) {
        res.status(400).json({ status: 'fail', message: 'E-mail de entregador já cadastrado' });
        return;
      }

      const passwordHash = await bcrypt.hash('password123', 10); // Senha padrão para entregadores criados pelo admin

      const dbDeliverer = await prisma.deliverer.create({
        data: {
          name,
          email,
          phone,
          vehicleType: vehicle,
          licensePlate: plate || null,
          passwordHash,
          isActive: true,
          isAvailable: true,
          isActiveToday: !!isActiveToday,
          deliveryStatus: 'AVAILABLE'
        }
      });

      const deliverer = formatDeliverer(dbDeliverer);

      res.status(201).json({
        status: 'success',
        data: { deliverer }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Atualiza dados de um entregador existente
   */
  public static async updateDeliverer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { name, email, phone, vehicle, plate, isActive } = req.body;

      const existing = await prisma.deliverer.findUnique({
        where: { id }
      });
      if (!existing) {
        res.status(404).json({ status: 'fail', message: 'Entregador não encontrado' });
        return;
      }

      const data: any = {};
      if (name !== undefined) data.name = name;
      if (email !== undefined) data.email = email;
      if (phone !== undefined) data.phone = phone;
      if (vehicle !== undefined) data.vehicleType = vehicle;
      if (plate !== undefined) data.licensePlate = plate;
      if (isActive !== undefined) data.isActive = isActive;

      const updated = await prisma.deliverer.update({
        where: { id },
        data
      });

      const deliverer = formatDeliverer(updated);

      res.status(200).json({
        status: 'success',
        data: { deliverer }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Alterna a escala de um entregador para o dia de hoje (isActiveToday)
   */
  public static async toggleActiveToday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { isActiveToday } = req.body;

      if (typeof isActiveToday !== 'boolean') {
        res.status(400).json({ status: 'fail', message: 'Status isActiveToday deve ser booleano' });
        return;
      }

      const existing = await prisma.deliverer.findUnique({
        where: { id }
      });
      if (!existing) {
        res.status(404).json({ status: 'fail', message: 'Entregador não encontrado' });
        return;
      }

      const updated = await prisma.deliverer.update({
        where: { id },
        data: { isActiveToday }
      });

      const deliverer = formatDeliverer(updated);

      res.status(200).json({
        status: 'success',
        data: { deliverer }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove um entregador do sistema
   */
  public static async deleteDeliverer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const existing = await prisma.deliverer.findUnique({
        where: { id }
      });
      if (!existing) {
        res.status(404).json({ status: 'fail', message: 'Entregador não encontrado' });
        return;
      }

      await prisma.deliverer.delete({
        where: { id }
      });

      res.status(200).json({
        status: 'success',
        message: 'Entregador removido com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista todos os lojistas cadastrados
   */
  public static async listMerchants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dbMerchants = await prisma.merchant.findMany({
        orderBy: { name: 'asc' }
      });
      const merchants = dbMerchants.map(m => formatMerchant(m));
      res.status(200).json({
        status: 'success',
        data: { merchants }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Alterna a verificação de um lojista (isVerified)
   */
  public static async toggleVerifyMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { isVerified } = req.body;

      if (typeof isVerified !== 'boolean') {
        res.status(400).json({ status: 'fail', message: 'Status isVerified deve ser booleano' });
        return;
      }

      const updated = await prisma.merchant.update({
        where: { id },
        data: { isVerified }
      });

      if (!updated) {
        res.status(404).json({ status: 'fail', message: 'Lojista não encontrado' });
        return;
      }

      const formatted = formatMerchant(updated);
      const merchant = formatted ? formatted.toObject() : null;

      res.status(200).json({
        status: 'success',
        data: { merchant }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Define o preço da assinatura de um lojista específico
   */
  public static async updateMerchantSubscriptionPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { subscriptionPrice } = req.body;

      if (subscriptionPrice !== undefined && subscriptionPrice !== null && (typeof subscriptionPrice !== 'number' || subscriptionPrice < 0)) {
        res.status(400).json({ status: 'fail', message: 'Preço de assinatura inválido' });
        return;
      }

      const updated = await prisma.merchant.update({
        where: { id },
        data: { subscriptionPrice: subscriptionPrice !== undefined ? subscriptionPrice : null }
      });

      if (!updated) {
        res.status(404).json({ status: 'fail', message: 'Lojista não encontrado' });
        return;
      }

      const formatted = formatMerchant(updated);
      const merchant = formatted ? formatted.toObject() : null;

      res.status(200).json({
        status: 'success',
        data: { merchant }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async listActiveOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const activeOrders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: startOfToday,
            lte: endOfToday
          },
          status: {
            notIn: ['DELIVERED', 'CANCELLED']
          }
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
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const orders = activeOrders.map(o => formatOrder(o));

      res.status(200).json({
        status: 'success',
        data: { orders }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getDeliverersDailyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      // 1. Motoboys escalados hoje via Prisma
      const deliverers = await prisma.deliverer.findMany({
        where: { isActiveToday: true, isActive: true }
      });

      const delivererIds = deliverers.map(d => d.id);

      // 2. Calcula entregas concluídas hoje de todos os motoboys ativos em uma única query com groupBy
      const deliveryCounts = await prisma.order.groupBy({
        by: ['delivererId'],
        where: {
          delivererId: { in: delivererIds },
          status: 'DELIVERED',
          createdAt: { gte: startOfToday, lte: endOfToday }
        },
        _count: {
          id: true
        }
      });

      // Cria um mapa para busca rápida de contagens
      const countsMap = new Map<string, number>();
      deliveryCounts.forEach(c => {
        if (c.delivererId) {
          countsMap.set(c.delivererId, c._count.id);
        }
      });

      // 3. Monta o relatório
      const report = deliverers.map(driver => {
        const completedDeliveries = countsMap.get(driver.id) || 0;
        return {
          delivererId: driver.id,
          name: driver.name,
          phone: driver.phone,
          vehicle: driver.vehicleType,
          plate: driver.licensePlate || '',
          completedDeliveries,
          totalPay: completedDeliveries * 5.00
        };
      });

      res.status(200).json({
        status: 'success',
        data: { report }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista todos os cupons do sistema
   */
  public static async listCoupons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const coupons = await prisma.coupon.findMany({
        include: {
          merchant: {
            select: {
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.status(200).json({
        status: 'success',
        data: { coupons }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cria um novo cupom
   */
  public static async createCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, discountType, discountValue, minOrderValue, expirationDate, merchantId, maxUses } = req.body;

      if (!code || !discountType || discountValue === undefined || !expirationDate) {
        res.status(400).json({ status: 'fail', message: 'Campos obrigatórios: código, tipo de desconto, valor de desconto, data de expiração' });
        return;
      }

      const existing = await prisma.coupon.findUnique({
        where: { code: code.toUpperCase() }
      });

      if (existing) {
        res.status(400).json({ status: 'fail', message: 'Já existe um cupom cadastrado com este código' });
        return;
      }

      const coupon = await prisma.coupon.create({
        data: {
          code: code.toUpperCase(),
          discountType,
          discountValue: Number(discountValue),
          minOrderValue: minOrderValue ? Number(minOrderValue) : null,
          expirationDate: new Date(expirationDate),
          merchantId: merchantId || null,
          maxUses: maxUses ? Number(maxUses) : null,
          isActive: true
        }
      });

      res.status(201).json({
        status: 'success',
        data: { coupon }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove/deleta um cupom pelo ID
   */
  public static async deleteCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await prisma.coupon.delete({
        where: { id }
      });
      res.status(200).json({
        status: 'success',
        message: 'Cupom removido com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
}
