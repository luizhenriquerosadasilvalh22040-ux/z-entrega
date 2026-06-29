import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { formatMerchant } from '../services/MerchantService';
import { formatOrder } from '../services/OrderService';
import { formatDeliverer } from '../services/DelivererService';
import { businessConfig } from '../config/business';
import { NotificationService } from '../services/NotificationService';
import { AdminOperationalService } from '../services/AdminOperationalService';
import { PaymentReconciliationService } from '../services/PaymentReconciliationService';
import { AuditLogService } from '../services/AuditLogService';
import { WhatsAppTemplateService } from '../services/WhatsAppTemplateService';
import { WhatsAppTemplateType } from '@prisma/client';

const requireAdminId = (req: Request, res: Response): string | null => {
  const adminId = req.user?.userId;
  if (!adminId || req.user?.role !== 'admin') {
    res.status(401).json({ status: 'fail', message: 'Admin não autenticado.' });
    return null;
  }
  return adminId;
};

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
          status: 'DELIVERED'
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

  public static async requeueFailedNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminId = requireAdminId(req, res);
      if (!adminId) return;

      await prisma.$transaction(async (tx) => {
        const notification = await tx.notification.findUnique({
          where: { id },
          select: { id: true, userType: true, type: true, status: true, attempts: true }
        });
        if (!notification) {
          throw new Error('Notificação não encontrada.');
        }

        await AuditLogService.record(tx, {
          actorType: 'admin',
          actorId: adminId,
          action: 'ADMIN_NOTIFICATION_REQUEUE_REQUESTED',
          entityType: 'Notification',
          entityId: id,
          metadata: {
            previousStatus: notification.status,
            attemptsCount: notification.attempts,
            notificationUserType: notification.userType,
            notificationType: notification.type
          },
          context: AuditLogService.getRequestContext(req)
        });
      });

      await NotificationService.requeueFailedNotification(id);
      res.status(200).json({
        status: 'success',
        message: 'Notificação reenfileirada com sucesso.'
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

  public static async getOperationalIssues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { issues, counts, summary, recentEvents } = await AdminOperationalService.getOperationalIssues();
      res.status(200).json({
        status: 'success',
        data: {
          issues,
          counts,
          summary,
          recentEvents
        }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async retryFailedRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminId = requireAdminId(req, res);
      if (!adminId) return;

      await AdminOperationalService.retryFailedRefund(id, adminId, AuditLogService.getRequestContext(req));
      res.status(200).json({
        status: 'success',
        message: 'Refund reenviado para processamento.'
      });
    } catch (error) {
      next(error);
    }
  }

  public static async dispatchReadyOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminId = requireAdminId(req, res);
      if (!adminId) return;

      const result = await AdminOperationalService.dispatchReadyOrder(id, adminId, AuditLogService.getRequestContext(req));
      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  public static async runOperationalReconciliation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = requireAdminId(req, res);
      if (!adminId) return;

      const result = await PaymentReconciliationService.runOperationalReconciliation({
        actorType: 'admin',
        actorId: adminId,
        context: AuditLogService.getRequestContext(req)
      }, {
        io: req.app.get('io')
      });

      res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  public static async listWhatsAppTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = await WhatsAppTemplateService.listTemplates();
      res.status(200).json({
        status: 'success',
        data: { templates }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async updateWhatsAppTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;
      const { body, isActive, locale } = req.body;
      const adminId = requireAdminId(req, res);
      if (!adminId) return;

      if (!Object.values(WhatsAppTemplateType).includes(key as WhatsAppTemplateType)) {
        res.status(400).json({ status: 'fail', message: 'Template WhatsApp inválido.' });
        return;
      }

      const previous = await prisma.whatsAppTemplate.findUnique({
        where: { key: key as WhatsAppTemplateType }
      });
      const template = await WhatsAppTemplateService.upsertTemplate({
        key: key as WhatsAppTemplateType,
        body,
        isActive,
        locale
      });

      await prisma.$transaction(async (tx) => {
        await AuditLogService.record(tx, {
          actorType: 'admin',
          actorId: adminId,
          action: 'WHATSAPP_TEMPLATE_UPDATED',
          entityType: 'WhatsAppTemplate',
          entityId: template.id,
          metadata: {
            templateKey: key,
            previousStatus: previous?.isActive ? 'active' : 'inactive',
            nextStatus: template.isActive ? 'active' : 'inactive',
            locale: template.locale
          },
          context: AuditLogService.getRequestContext(req)
        });
      });

      res.status(200).json({
        status: 'success',
        data: { template }
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
      const adminId = requireAdminId(req, res);
      if (!adminId) return;

      if (typeof defaultSubscriptionPrice !== 'number' || defaultSubscriptionPrice < 0) {
        res.status(400).json({ status: 'fail', message: 'Preço de assinatura inválido' });
        return;
      }

      const config = await prisma.$transaction(async (tx) => {
        const previous = await tx.systemConfig.findFirst();
        const saved = previous
          ? await tx.systemConfig.update({
            where: { id: previous.id },
            data: { defaultSubscriptionPrice }
          })
          : await tx.systemConfig.create({
            data: { defaultSubscriptionPrice }
          });

        await AuditLogService.record(tx, {
          actorType: 'admin',
          actorId: adminId,
          action: 'SYSTEM_SETTINGS_UPDATED',
          entityType: 'SystemConfig',
          entityId: saved.id,
          metadata: {
            previousSubscriptionPrice: previous ? Number(previous.defaultSubscriptionPrice) : null,
            nextSubscriptionPrice: Number(defaultSubscriptionPrice)
          },
          context: AuditLogService.getRequestContext(req)
        });

        return saved;
      });

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
      const { name, email, phone, vehicle, plate, isActiveToday, initialPassword } = req.body;
      const adminId = requireAdminId(req, res);
      if (!adminId) return;

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

      if (initialPassword !== undefined && (typeof initialPassword !== 'string' || initialPassword.length < 12)) {
        res.status(400).json({ status: 'fail', message: 'A senha inicial do entregador deve ter pelo menos 12 caracteres.' });
        return;
      }

      const temporaryPassword = initialPassword || crypto.randomBytes(18).toString('base64url');
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);

      const dbDeliverer = await prisma.$transaction(async (tx) => {
        const created = await tx.deliverer.create({
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

        await AuditLogService.record(tx, {
          actorType: 'admin',
          actorId: adminId,
          action: 'DELIVERER_CREATED',
          entityType: 'Deliverer',
          entityId: created.id,
          metadata: {
            vehicleType: vehicle,
            isActiveToday: !!isActiveToday
          },
          context: AuditLogService.getRequestContext(req)
        });

        return created;
      });

      const deliverer = formatDeliverer(dbDeliverer);

      res.status(201).json({
        status: 'success',
        data: {
          deliverer,
          temporaryPassword: initialPassword ? undefined : temporaryPassword
        }
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
      const adminId = requireAdminId(req, res);
      if (!adminId) return;

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

      const updated = await prisma.$transaction(async (tx) => {
        const saved = await tx.deliverer.update({
          where: { id },
          data
        });

        await AuditLogService.record(tx, {
          actorType: 'admin',
          actorId: adminId,
          action: 'DELIVERER_UPDATED',
          entityType: 'Deliverer',
          entityId: id,
          metadata: {
            previousStatus: existing.isActive ? 'active' : 'inactive',
            nextStatus: saved.isActive ? 'active' : 'inactive',
            vehicleType: saved.vehicleType
          },
          context: AuditLogService.getRequestContext(req)
        });

        return saved;
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
      const adminId = requireAdminId(req, res);
      if (!adminId) return;

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

      const updated = await prisma.$transaction(async (tx) => {
        const saved = await tx.deliverer.update({
          where: { id },
          data: { isActiveToday }
        });

        await AuditLogService.record(tx, {
          actorType: 'admin',
          actorId: adminId,
          action: 'DELIVERER_DAILY_SCALE_UPDATED',
          entityType: 'Deliverer',
          entityId: id,
          metadata: {
            previousStatus: existing.isActiveToday ? 'scaled' : 'not_scaled',
            nextStatus: saved.isActiveToday ? 'scaled' : 'not_scaled'
          },
          context: AuditLogService.getRequestContext(req)
        });

        return saved;
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
      const adminId = requireAdminId(req, res);
      if (!adminId) return;

      const existing = await prisma.deliverer.findUnique({
        where: { id }
      });
      if (!existing) {
        res.status(404).json({ status: 'fail', message: 'Entregador não encontrado' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.deliverer.delete({
          where: { id }
        });

        await AuditLogService.record(tx, {
          actorType: 'admin',
          actorId: adminId,
          action: 'DELIVERER_DELETED',
          entityType: 'Deliverer',
          entityId: id,
          metadata: {
            previousStatus: existing.isActive ? 'active' : 'inactive',
            vehicleType: existing.vehicleType
          },
          context: AuditLogService.getRequestContext(req)
        });
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
      const adminId = req.user?.userId;

      if (typeof isVerified !== 'boolean') {
        res.status(400).json({ status: 'fail', message: 'Status isVerified deve ser booleano' });
        return;
      }

      if (!adminId) {
        res.status(401).json({ status: 'fail', message: 'Admin não autenticado.' });
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const previous = await tx.merchant.findUnique({ where: { id } });
        if (!previous) return null;

        const merchant = await tx.merchant.update({
          where: { id },
          data: { isVerified }
        });

        await AuditLogService.record(tx, {
          actorType: 'admin',
          actorId: adminId,
          action: 'MERCHANT_VERIFICATION_UPDATED',
          entityType: 'Merchant',
          entityId: id,
          merchantId: id,
          metadata: {
            previousIsVerified: previous.isVerified,
            nextIsVerified: isVerified
          },
          context: AuditLogService.getRequestContext(req)
        });

        return merchant;
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
      const adminId = req.user?.userId;

      if (subscriptionPrice !== undefined && subscriptionPrice !== null && (typeof subscriptionPrice !== 'number' || subscriptionPrice < 0)) {
        res.status(400).json({ status: 'fail', message: 'Preço de assinatura inválido' });
        return;
      }

      if (!adminId) {
        res.status(401).json({ status: 'fail', message: 'Admin não autenticado.' });
        return;
      }

      const nextSubscriptionPrice = subscriptionPrice !== undefined ? subscriptionPrice : null;
      const updated = await prisma.$transaction(async (tx) => {
        const previous = await tx.merchant.findUnique({ where: { id } });
        if (!previous) return null;

        const merchant = await tx.merchant.update({
          where: { id },
          data: { subscriptionPrice: nextSubscriptionPrice }
        });

        await AuditLogService.record(tx, {
          actorType: 'admin',
          actorId: adminId,
          action: 'MERCHANT_SUBSCRIPTION_PRICE_UPDATED',
          entityType: 'Merchant',
          entityId: id,
          merchantId: id,
          metadata: {
            previousSubscriptionPrice: previous.subscriptionPrice !== null ? Number(previous.subscriptionPrice) : null,
            nextSubscriptionPrice
          },
          context: AuditLogService.getRequestContext(req)
        });

        return merchant;
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
          totalPay: completedDeliveries * businessConfig.delivererPayPerDelivery
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
      const adminId = requireAdminId(req, res);
      if (!adminId) return;

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

      const coupon = await prisma.$transaction(async (tx) => {
        const created = await tx.coupon.create({
          data: {
            code: code.toUpperCase(),
            discountType,
            discountValue: Number(discountValue),
            minOrderValue: minOrderValue !== undefined && minOrderValue !== null ? Number(minOrderValue) : null,
            expirationDate: new Date(expirationDate),
            merchantId: merchantId || null,
            maxUses: maxUses !== undefined && maxUses !== null ? Number(maxUses) : null,
            isActive: true
          }
        });

        await AuditLogService.record(tx, {
          actorType: 'admin',
          actorId: adminId,
          action: 'COUPON_CREATED',
          entityType: 'Coupon',
          entityId: created.id,
          merchantId: created.merchantId,
          metadata: {
            discountType,
            amount: Number(discountValue),
            maxUses: created.maxUses
          },
          context: AuditLogService.getRequestContext(req)
        });

        return created;
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
      const adminId = requireAdminId(req, res);
      if (!adminId) return;

      const existing = await prisma.coupon.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ status: 'fail', message: 'Cupom não encontrado' });
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.coupon.delete({
          where: { id }
        });

        await AuditLogService.record(tx, {
          actorType: 'admin',
          actorId: adminId,
          action: 'COUPON_DELETED',
          entityType: 'Coupon',
          entityId: id,
          merchantId: existing.merchantId,
          metadata: {
            previousStatus: existing.isActive ? 'active' : 'inactive',
            discountType: existing.discountType,
            amount: Number(existing.discountValue)
          },
          context: AuditLogService.getRequestContext(req)
        });
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
