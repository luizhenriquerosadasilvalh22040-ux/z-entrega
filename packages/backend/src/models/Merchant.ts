import prisma from '../config/prisma';
import { formatMerchant } from '../services/MerchantService';
import { QueryPromise } from './helpers';

export class Merchant {
  public static async findById(id: string): Promise<any> {
    const merchant = await prisma.merchant.findUnique({
      where: { id }
    });
    return formatMerchant(merchant)!;
  }

  public static async findOne(query: any): Promise<any> {
    const where: any = {};
    if (query.email) where.email = query.email;
    if (query.cnpj) where.cnpj = query.cnpj;
    const merchant = await prisma.merchant.findFirst({
      where
    });
    return formatMerchant(merchant)!;
  }

  public static find(query: any = {}) {
    const where: any = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    const promise = prisma.merchant.findMany({ where }).then(list => list.map(m => formatMerchant(m)!));
    return new QueryPromise(promise);
  }

  public static async countDocuments(query: any = {}) {
    const where: any = {};
    if (query.isVerified !== undefined) where.isVerified = query.isVerified;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    return await prisma.merchant.count({ where });
  }

  public static async findByIdAndUpdate(id: string, update: any, options: any = {}) {
    const updateData = update.$set || update;
    const data: any = {};
    if (updateData.isVerified !== undefined) data.isVerified = updateData.isVerified;
    if (updateData.subscriptionPrice !== undefined) data.subscriptionPrice = updateData.subscriptionPrice;
    if (updateData.isActive !== undefined) data.isActive = updateData.isActive;
    if (updateData.name !== undefined) data.name = updateData.name;
    if (updateData.phone !== undefined) data.phone = updateData.phone;
    
    const merchant = await prisma.merchant.update({
      where: { id },
      data
    });
    return formatMerchant(merchant);
  }

  public static async deleteMany(query: any = {}) {
    return await prisma.merchant.deleteMany({});
  }
}

export type IMerchantDocument = any;
export type IOperatingHours = any;
