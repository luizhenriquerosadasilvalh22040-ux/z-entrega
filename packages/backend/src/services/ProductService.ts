import { Product, IProductDocument } from '../models/Product';
import { Types } from 'mongoose';

export class ProductService {
  public static async createProduct(
    merchantId: string,
    data: { name: string; description: string; price: number; category: string; image?: string }
  ): Promise<IProductDocument> {
    const product = new Product({
      merchantId: new Types.ObjectId(merchantId),
      ...data,
      isAvailable: true
    });
    return await product.save();
  }

  public static async updateProduct(
    id: string,
    merchantId: string,
    data: Partial<{ name: string; description: string; price: number; category: string; image: string; isAvailable: boolean }>
  ): Promise<IProductDocument | null> {
    return await Product.findOneAndUpdate(
      { _id: id, merchantId: new Types.ObjectId(merchantId) },
      { $set: data },
      { new: true }
    );
  }

  public static async deleteProduct(id: string, merchantId: string): Promise<IProductDocument | null> {
    return await Product.findOneAndDelete({ _id: id, merchantId: new Types.ObjectId(merchantId) });
  }

  public static async listMerchantProducts(merchantId: string): Promise<IProductDocument[]> {
    return await Product.find({ merchantId: new Types.ObjectId(merchantId) });
  }

  public static async searchProducts(query: string): Promise<IProductDocument[]> {
    return await Product.find(
      { $text: { $search: query }, isAvailable: true }
    );
  }
}
