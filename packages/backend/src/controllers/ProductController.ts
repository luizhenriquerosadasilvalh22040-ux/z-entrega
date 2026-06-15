import { Request, Response, NextFunction } from 'express';
import { ProductService } from '../services/ProductService';

export class ProductController {
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        res.status(403).json({ status: 'fail', message: 'Only merchants can manage products' });
        return;
      }

      const product = await ProductService.createProduct(req.user.userId, req.body);
      res.status(201).json({ status: 'success', data: { product } });
    } catch (error) {
      next(error);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        res.status(403).json({ status: 'fail', message: 'Only merchants can manage products' });
        return;
      }

      const { id } = req.params;
      const product = await ProductService.updateProduct(id, req.user.userId, req.body);
      if (!product) {
        res.status(404).json({ status: 'fail', message: 'Product not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { product } });
    } catch (error) {
      next(error);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        res.status(403).json({ status: 'fail', message: 'Only merchants can manage products' });
        return;
      }

      const { id } = req.params;
      const product = await ProductService.deleteProduct(id, req.user.userId);
      if (!product) {
        res.status(404).json({ status: 'fail', message: 'Product not found' });
        return;
      }
      res.status(200).json({ status: 'success', message: 'Product deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  public static async listByMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { merchantId } = req.params;
      const products = await ProductService.listMerchantProducts(merchantId);
      res.status(200).json({ status: 'success', data: { products } });
    } catch (error) {
      next(error);
    }
  }

  public static async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;
      if (!q) {
        res.status(400).json({ status: 'fail', message: 'Search query is required' });
        return;
      }
      const products = await ProductService.searchProducts(q as string);
      res.status(200).json({ status: 'success', data: { products } });
    } catch (error) {
      next(error);
    }
  }
}
