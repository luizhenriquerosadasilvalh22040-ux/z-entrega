import { Request, Response, NextFunction } from 'express';
import { canManageMerchantResource } from '../domain/accessControl';
import { PromotionService } from '../services/PromotionService';

export class PromotionController {
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        res.status(403).json({ status: 'fail', message: 'Only merchants can manage promotions' });
        return;
      }

      const promotion = await PromotionService.createPromotion(req.user.userId, req.body);
      res.status(201).json({ status: 'success', data: { promotion } });
    } catch (error) {
      next(error);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'merchant') {
        res.status(403).json({ status: 'fail', message: 'Only merchants can manage promotions' });
        return;
      }

      const { id } = req.params;
      const promotion = await PromotionService.updatePromotion(id, req.user.userId, req.body);
      if (!promotion) {
        res.status(404).json({ status: 'fail', message: 'Promotion not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { promotion } });
    } catch (error) {
      next(error);
    }
  }

  public static async listByMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { merchantId } = req.params;
      if (!req.user || !canManageMerchantResource(req.user, merchantId)) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      const promotions = await PromotionService.listMerchantPromotions(merchantId);
      res.status(200).json({ status: 'success', data: { promotions } });
    } catch (error) {
      next(error);
    }
  }

  public static async listActiveByMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { merchantId } = req.params;
      const promotions = await PromotionService.getActivePromotions(merchantId);
      res.status(200).json({ status: 'success', data: { promotions } });
    } catch (error) {
      next(error);
    }
  }
}
