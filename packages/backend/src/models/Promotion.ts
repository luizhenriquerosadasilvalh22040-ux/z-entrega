import prisma from '../config/prisma';
import { formatPromotion } from '../services/PromotionService';
import { QueryPromise } from './helpers';

export class Promotion {
  public static async findById(id: string) {
    const p = await prisma.promotion.findUnique({
      where: { id }
    });
    return formatPromotion(p);
  }

  public static find(query: any = {}) {
    const where: any = {};
    if (query.merchantId) where.merchantId = query.merchantId;
    if (query.isActive !== undefined && query.isActive === true) {
      where.expirationDate = { gte: new Date() };
    }
    const promise = prisma.promotion.findMany({ where }).then(list => list.map(p => formatPromotion(p)));
    return new QueryPromise(promise);
  }
}

export type IPromotionDocument = any;
