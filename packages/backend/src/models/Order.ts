import prisma from '../config/prisma';
import { formatOrder } from '../services/OrderService';
import { QueryPromise } from './helpers';

export class Order {
  public static findById(id: string) {
    const promise = prisma.order.findUnique({
      where: { id },
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
    }).then(order => formatOrder(order));
    return new QueryPromise(promise);
  }

  public static find(query: any = {}) {
    const where: any = {};
    if (query.status) {
      if (typeof query.status === 'object') {
        if (query.status.$ne) {
          where.status = { not: query.status.$ne };
        } else if (query.status.$nin) {
          where.status = { notIn: query.status.$nin };
        }
      } else {
        where.status = query.status;
      }
    }
    if (query.merchantId) {
      where.merchantId = query.merchantId;
    }
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    if (query.delivererId) {
      where.delivererId = query.delivererId;
    }
    if (query.createdAt && typeof query.createdAt === 'object') {
      where.createdAt = {};
      if (query.createdAt.$gte) where.createdAt.gte = query.createdAt.$gte;
      if (query.createdAt.$lte) where.createdAt.lte = query.createdAt.$lte;
    }

    const promise = prisma.order.findMany({
      where,
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
    }).then(list => list.map(o => formatOrder(o)!));

    return new QueryPromise(promise);
  }

  public static async countDocuments(query: any = {}) {
    const where: any = {};
    if (query.status) {
      if (typeof query.status === 'object') {
        if (query.status.$ne) {
          where.status = { not: query.status.$ne };
        } else if (query.status.$nin) {
          where.status = { notIn: query.status.$nin };
        }
      } else {
        where.status = query.status;
      }
    }
    if (query.delivererId) {
      where.delivererId = query.delivererId;
    }
    if (query.merchantId) {
      where.merchantId = query.merchantId;
    }
    if (query.customerId) {
      where.customerId = query.customerId;
    }
    if (query.createdAt && typeof query.createdAt === 'object') {
      where.createdAt = {};
      if (query.createdAt.$gte) where.createdAt.gte = query.createdAt.$gte;
      if (query.createdAt.$lte) where.createdAt.lte = query.createdAt.$lte;
    }

    return await prisma.order.count({ where });
  }

  public static async deleteMany(query: any = {}) {
    return await prisma.order.deleteMany({});
  }
}

export type IOrderDocument = any;
export type OrderStatus = any;
