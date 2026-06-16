import { Merchant, IMerchantDocument } from '../models/Merchant';
import { IAddress, IOperatingHours } from '../types';

export class MerchantService {
  public static async listMerchants(filters: { category?: string; city?: string } = {}): Promise<IMerchantDocument[]> {
    const query: any = { isActive: true };
    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.city) {
      query['address.city'] = { $regex: new RegExp(filters.city, 'i') };
    }
    return await Merchant.find(query, { passwordHash: 0 });
  }

  public static async getMerchantById(id: string): Promise<IMerchantDocument | null> {
    return await Merchant.findById(id, { passwordHash: 0 });
  }

  public static async updateProfile(id: string, data: { name?: string; phone?: string; category?: 'Comida' | 'Farmácia' | 'Construção' | 'Geral'; isForceClosed?: boolean }): Promise<IMerchantDocument | null> {
    return await Merchant.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, select: { passwordHash: 0 } }
    );
  }

  public static async updateOperatingHours(id: string, operatingHours: IOperatingHours): Promise<IMerchantDocument | null> {
    return await Merchant.findByIdAndUpdate(
      id,
      { $set: { operatingHours } },
      { new: true, select: { passwordHash: 0 } }
    );
  }

  public static async updatePaymentMethods(id: string, paymentMethods: string[]): Promise<IMerchantDocument | null> {
    return await Merchant.findByIdAndUpdate(
      id,
      { $set: { paymentMethods } },
      { new: true, select: { passwordHash: 0 } }
    );
  }

  public static async deactivateMerchant(id: string): Promise<IMerchantDocument | null> {
    return await Merchant.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true, select: { passwordHash: 0 } }
    );
  }

  public static async reactivateMerchant(id: string): Promise<IMerchantDocument | null> {
    return await Merchant.findByIdAndUpdate(
      id,
      { $set: { isActive: true } },
      { new: true, select: { passwordHash: 0 } }
    );
  }

  public static async countMerchants(): Promise<number> {
    return await Merchant.countDocuments({ isActive: true });
  }

  public static async countVerifiedMerchants(): Promise<number> {
    return await Merchant.countDocuments({ isActive: true, isVerified: true });
  }
}
