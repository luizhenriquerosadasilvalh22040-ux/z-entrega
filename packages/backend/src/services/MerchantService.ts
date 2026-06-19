import prisma from '../config/prisma';
import { IAddress, IOperatingHours } from '../types';

export const formatMerchant = (merchant: any) => {
  if (!merchant) return null;
  return {
    _id: merchant.id,
    id: merchant.id,
    name: merchant.name,
    email: merchant.email,
    passwordHash: merchant.passwordHash,
    cnpj: merchant.cnpj,
    phone: merchant.phone,
    category: merchant.category,
    paymentMethods: merchant.paymentMethods,
    logoImage: merchant.logoImage || undefined,
    coverImage: merchant.coverImage || undefined,
    isVerified: merchant.isVerified,
    isActive: merchant.isActive,
    isForceClosed: merchant.isForceClosed,
    subscriptionPrice: merchant.subscriptionPrice !== null ? Number(merchant.subscriptionPrice) : undefined,
    createdAt: merchant.createdAt,
    updatedAt: merchant.updatedAt,
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
    const where: any = { isActive: true };
    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }
    const merchants = await prisma.merchant.findMany({ where });
    return merchants.map(m => formatMerchant(m));
  }

  public static async getMerchantById(id: string): Promise<any | null> {
    const merchant = await prisma.merchant.findUnique({ where: { id } });
    return formatMerchant(merchant);
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
      where: { isActive: true }
    });
  }

  public static async countVerifiedMerchants(): Promise<number> {
    return await prisma.merchant.count({
      where: { isActive: true, isVerified: true }
    });
  }
}
