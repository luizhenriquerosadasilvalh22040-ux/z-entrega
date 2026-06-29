import prisma from '../config/prisma';

export const formatPromotion = (p: any) => {
  if (!p) return null;
  const now = new Date();
  return {
    _id: p.id,
    id: p.id,
    merchantId: p.merchantId,
    name: `Desconto de ${p.discountPercentage}%`,
    discountPercentage: Number(p.discountPercentage),
    startDate: p.createdAt,
    endDate: p.expirationDate,
    targetProducts: [],
    isActive: p.expirationDate >= now
  };
};

export class PromotionService {
  public static async createPromotion(
    merchantId: string,
    data: { name: string; discountPercentage: number; startDate: Date; endDate: Date; targetProducts?: string[] }
  ): Promise<any> {
    const promotion = await prisma.promotion.create({
      data: {
        merchantId,
        discountPercentage: data.discountPercentage,
        expirationDate: new Date(data.endDate)
      }
    });

    return formatPromotion(promotion);
  }

  public static async updatePromotion(
    id: string,
    merchantId: string,
    data: Partial<{ name: string; discountPercentage: number; startDate: Date; endDate: Date; isActive: boolean; targetProducts: string[] }>
  ): Promise<any | null> {
    const updateData: any = {};
    if (data.discountPercentage !== undefined) updateData.discountPercentage = data.discountPercentage;
    if (data.endDate !== undefined) updateData.expirationDate = new Date(data.endDate);

    const existing = await prisma.promotion.findFirst({
      where: { id, merchantId }
    });
    if (!existing) return null;

    const promotion = await prisma.promotion.update({
      where: { id },
      data: updateData
    });

    return formatPromotion(promotion);
  }

  public static async listMerchantPromotions(merchantId: string): Promise<any[]> {
    const promotions = await prisma.promotion.findMany({
      where: { merchantId }
    });
    return promotions.map(p => formatPromotion(p));
  }

  public static async getActivePromotions(merchantId: string): Promise<any[]> {
    const now = new Date();
    const promotions = await prisma.promotion.findMany({
      where: {
        merchantId,
        expirationDate: { gte: now }
      }
    });
    return promotions.map(p => formatPromotion(p));
  }
}
