import prisma from '../config/prisma';
import { IOperatingHours } from '../types';
import { MERCHANT_SUBSCRIPTION_STATUS, getMerchantPublicationBlockReason, isMerchantPubliclyVisible } from '../domain/subscriptionStatus';

export const formatMerchant = (merchant: any, reviewsStats?: { avg: number; count: number }) => {
  if (!merchant) return null;
  return {
    _id: merchant.id,
    id: merchant.id,
    name: merchant.name,
    email: merchant.email,
    hasCnpj: !!merchant.cnpj,
    phone: merchant.phone,
    category: merchant.category,
    paymentMethods: merchant.paymentMethods,
    logoImage: merchant.logoImage || undefined,
    coverImage: merchant.coverImage || undefined,
    isVerified: merchant.isVerified,
    isActive: merchant.isActive,
    isForceClosed: merchant.isForceClosed,
    subscriptionPrice: merchant.subscriptionPrice !== null ? Number(merchant.subscriptionPrice) : undefined,
    mpUserId: merchant.mpUserId || undefined,
    mpSubscriptionId: merchant.mpSubscriptionId || undefined,
    subscriptionStatus: merchant.subscriptionStatus || undefined,
    isPubliclyVisible: isMerchantPubliclyVisible(merchant),
    publicationBlockReason: getMerchantPublicationBlockReason(merchant) || undefined,
    termsAcceptedAt: merchant.termsAcceptedAt || undefined,
    privacyAcceptedAt: merchant.privacyAcceptedAt || undefined,
    marketingConsent: !!merchant.marketingConsent,
    createdAt: merchant.createdAt,
    updatedAt: merchant.updatedAt,
    averageRating: reviewsStats?.avg ? Number((reviewsStats.avg).toFixed(1)) : 0,
    reviewsCount: reviewsStats ? reviewsStats.count : 0,
    operatingHours: {
      open: merchant.openTime,
      close: merchant.closeTime
    },
    address: {
      street: merchant.street,
      number: merchant.number,
      neighborhood: merchant.neighborhood,
      city: merchant.city,
      state: merchant.state,
      zipCode: merchant.zipCode,
      coordinates: merchant.latitude && merchant.longitude ? {
        lat: Number(merchant.latitude),
        lng: Number(merchant.longitude)
      } : undefined
    },
    save: async function() {
      const updated = await prisma.merchant.update({
        where: { id: this.id },
        data: {
          name: this.name,
          email: this.email,
          phone: this.phone,
          category: this.category,
          paymentMethods: this.paymentMethods,
          logoImage: this.logoImage,
          coverImage: this.coverImage,
          isVerified: this.isVerified,
          isActive: this.isActive,
          isForceClosed: this.isForceClosed,
          subscriptionPrice: this.subscriptionPrice,
          openTime: this.operatingHours.open,
          closeTime: this.operatingHours.close,
          street: this.address.street,
          number: this.address.number,
          neighborhood: this.address.neighborhood,
          city: this.address.city,
          state: this.address.state,
          zipCode: this.address.zipCode,
          latitude: this.address.coordinates?.lat,
          longitude: this.address.coordinates?.lng
        }
      });
      Object.assign(this, formatMerchant(updated));
      return this;
    },
    toObject: function() {
      const { save, toObject, markModified, ...rest } = this;
      return rest;
    },
    markModified: function(path: string) {
      // no-op para compatibilidade Mongoose
    }
  };
};

export class MerchantService {
  public static async listMerchants(filters: { category?: string; city?: string } = {}): Promise<any[]> {
    const where: any = {
      isActive: true,
      isVerified: true,
      subscriptionStatus: MERCHANT_SUBSCRIPTION_STATUS.ACTIVE
    };
    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }
    const merchants = await prisma.merchant.findMany({ where });

    // Busca agregada das avaliações das lojas para evitar N+1
    const reviewsMap = new Map<string, { avg: number; count: number }>();
    const aggregations = await prisma.review.groupBy({
      by: ['merchantId'],
      _avg: { rating: true },
      _count: { id: true }
    });
    aggregations.forEach(agg => {
      reviewsMap.set(agg.merchantId, {
        avg: agg._avg.rating || 0,
        count: agg._count.id || 0
      });
    });

    return merchants.map(m => formatMerchant(m, reviewsMap.get(m.id)));
  }

  public static async getMerchantById(id: string): Promise<any | null> {
    const merchant = await prisma.merchant.findFirst({
      where: {
        id,
        isActive: true,
        isVerified: true,
        subscriptionStatus: MERCHANT_SUBSCRIPTION_STATUS.ACTIVE
      }
    });
    if (!merchant) return null;

    const agg = await prisma.review.aggregate({
      where: { merchantId: id },
      _avg: { rating: true },
      _count: { id: true }
    });

    return formatMerchant(merchant, {
      avg: agg._avg.rating || 0,
      count: agg._count.id || 0
    });
  }

  public static async updateProfile(
    id: string,
    data: {
      name?: string;
      phone?: string;
      category?: 'Comida' | 'Farmácia' | 'Construção' | 'Geral';
      isForceClosed?: boolean;
      logoImage?: string;
      coverImage?: string;
    }
  ): Promise<any | null> {
    const merchant = await prisma.merchant.update({
      where: { id },
      data
    });
    return formatMerchant(merchant);
  }

  public static async updateOperatingHours(id: string, operatingHours: IOperatingHours): Promise<any | null> {
    const merchant = await prisma.merchant.update({
      where: { id },
      data: {
        openTime: operatingHours.open,
        closeTime: operatingHours.close
      }
    });
    return formatMerchant(merchant);
  }

  public static async updatePaymentMethods(id: string, paymentMethods: string[]): Promise<any | null> {
    const merchant = await prisma.merchant.update({
      where: { id },
      data: { paymentMethods }
    });
    return formatMerchant(merchant);
  }

  public static async deactivateMerchant(id: string): Promise<any | null> {
    const merchant = await prisma.merchant.update({
      where: { id },
      data: { isActive: false }
    });
    return formatMerchant(merchant);
  }

  public static async reactivateMerchant(id: string): Promise<any | null> {
    const merchant = await prisma.merchant.update({
      where: { id },
      data: { isActive: true }
    });
    return formatMerchant(merchant);
  }

  public static async countMerchants(): Promise<number> {
    return await prisma.merchant.count({
      where: {
        isActive: true,
        isVerified: true,
        subscriptionStatus: MERCHANT_SUBSCRIPTION_STATUS.ACTIVE
      }
    });
  }

  public static async countVerifiedMerchants(): Promise<number> {
    return await prisma.merchant.count({
      where: {
        isActive: true,
        isVerified: true,
        subscriptionStatus: MERCHANT_SUBSCRIPTION_STATUS.ACTIVE
      }
    });
  }
}
