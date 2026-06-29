import { Request, Response, NextFunction } from 'express';
import { MerchantService } from '../services/MerchantService';
import prisma from '../config/prisma';
import { canManageMerchantResource } from '../domain/accessControl';

export class MerchantController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, city } = req.query;
      const merchants = await MerchantService.listMerchants({
        category: category as string,
        city: city as string
      });
      res.status(200).json({ status: 'success', data: { merchants } });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const merchant = await MerchantService.getMerchantById(id);
      if (!merchant) {
        res.status(404).json({ status: 'fail', message: 'Merchant not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { merchant } });
    } catch (error) {
      next(error);
    }
  }

  public static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!req.user || !canManageMerchantResource(req.user, id)) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      const merchant = await MerchantService.updateProfile(id, req.body);
      if (!merchant) {
        res.status(404).json({ status: 'fail', message: 'Merchant not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { merchant } });
    } catch (error) {
      next(error);
    }
  }

  public static async updateOperatingHours(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!req.user || !canManageMerchantResource(req.user, id)) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      const merchant = await MerchantService.updateOperatingHours(id, req.body);
      if (!merchant) {
        res.status(404).json({ status: 'fail', message: 'Merchant not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { merchant } });
    } catch (error) {
      next(error);
    }
  }

  public static async updatePaymentMethods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!req.user || !canManageMerchantResource(req.user, id)) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      const { paymentMethods } = req.body;
      const merchant = await MerchantService.updatePaymentMethods(id, paymentMethods);
      if (!merchant) {
        res.status(404).json({ status: 'fail', message: 'Merchant not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { merchant } });
    } catch (error) {
      next(error);
    }
  }

  public static async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!req.user || !canManageMerchantResource(req.user, id)) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      const merchant = await MerchantService.deactivateMerchant(id);
      if (!merchant) {
        res.status(404).json({ status: 'fail', message: 'Merchant not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { merchant } });
    } catch (error) {
      next(error);
    }
  }

  public static async reactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!req.user || !canManageMerchantResource(req.user, id)) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      const merchant = await MerchantService.reactivateMerchant(id);
      if (!merchant) {
        res.status(404).json({ status: 'fail', message: 'Merchant not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { merchant } });
    } catch (error) {
      next(error);
    }
  }

  public static async updateLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!req.user || !canManageMerchantResource(req.user, id)) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      const { logoImage } = req.body;
      const merchant = await MerchantService.updateProfile(id, { logoImage } as any);
      if (!merchant) {
        res.status(404).json({ status: 'fail', message: 'Merchant not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { merchant } });
    } catch (error) {
      next(error);
    }
  }

  public static async updateCover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!req.user || !canManageMerchantResource(req.user, id)) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      const { coverImage } = req.body;
      const merchant = await MerchantService.updateProfile(id, { coverImage } as any);
      if (!merchant) {
        res.status(404).json({ status: 'fail', message: 'Merchant not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { merchant } });
    } catch (error) {
      next(error);
    }
  }

  public static async count(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await MerchantService.countMerchants();
      res.status(200).json({ status: 'success', data: { count } });
    } catch (error) {
      next(error);
    }
  }

  public static async countVerified(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await MerchantService.countVerifiedMerchants();
      res.status(200).json({ status: 'success', data: { count } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtém a lista de avaliações de um lojista
   */
  public static async getReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: merchantId } = req.params;
      const reviews = await prisma.review.findMany({
        where: { merchantId },
        include: {
          customer: {
            select: {
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.status(200).json({
        status: 'success',
        data: { reviews }
      });
    } catch (error) {
      next(error);
    }
  }
}
