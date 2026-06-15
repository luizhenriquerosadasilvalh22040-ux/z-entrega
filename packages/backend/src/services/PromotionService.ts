import { Promotion, IPromotionDocument } from '../models/Promotion';
import { Types } from 'mongoose';

export class PromotionService {
  public static async createPromotion(
    merchantId: string,
    data: { name: string; discountPercentage: number; startDate: Date; endDate: Date; targetProducts?: string[] }
  ): Promise<IPromotionDocument> {
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new Error('Start date must be before end date');
    }

    const promotion = new Promotion({
      merchantId: new Types.ObjectId(merchantId),
      name: data.name,
      discountPercentage: data.discountPercentage,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      targetProducts: data.targetProducts?.map(id => new Types.ObjectId(id)) || [],
      isActive: true
    });

    return await promotion.save();
  }

  public static async updatePromotion(
    id: string,
    merchantId: string,
    data: Partial<{ name: string; discountPercentage: number; startDate: Date; endDate: Date; isActive: boolean; targetProducts: string[] }>
  ): Promise<IPromotionDocument | null> {
    const updateObj: any = { ...data };
    
    if (data.startDate) updateObj.startDate = new Date(data.startDate);
    if (data.endDate) updateObj.endDate = new Date(data.endDate);
    if (data.targetProducts) {
      updateObj.targetProducts = data.targetProducts.map(id => new Types.ObjectId(id));
    }

    if (updateObj.startDate && updateObj.endDate && updateObj.startDate >= updateObj.endDate) {
      throw new Error('Start date must be before end date');
    }

    return await Promotion.findOneAndUpdate(
      { _id: id, merchantId: new Types.ObjectId(merchantId) },
      { $set: updateObj },
      { new: true }
    );
  }

  public static async listMerchantPromotions(merchantId: string): Promise<IPromotionDocument[]> {
    return await Promotion.find({ merchantId: new Types.ObjectId(merchantId) });
  }

  public static async getActivePromotions(merchantId: string): Promise<IPromotionDocument[]> {
    const now = new Date();
    return await Promotion.find({
      merchantId: new Types.ObjectId(merchantId),
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    });
  }
}
