import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { Customer } from '../models/Customer';
import { Merchant } from '../models/Merchant';

export class AuthController {
  public static async registerCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customer = await AuthService.registerCustomer(req.body);
      
      // Remove a senha do objeto de retorno
      const response = customer.toObject();
      delete response.passwordHash;

      res.status(201).json({
        status: 'success',
        data: { customer: response }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async loginCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const { customer, accessToken, refreshToken } = await AuthService.loginCustomer(email, password);

      const customerObj = customer.toObject();
      delete customerObj.passwordHash;

      res.status(200).json({
        status: 'success',
        data: {
          customer: customerObj,
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async registerMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchant = await AuthService.registerMerchant(req.body);

      const response = merchant.toObject();
      delete response.passwordHash;

      res.status(201).json({
        status: 'success',
        data: { merchant: response }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async loginMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const { merchant, accessToken, refreshToken } = await AuthService.loginMerchant(email, password);

      const merchantObj = merchant.toObject();
      delete merchantObj.passwordHash;

      res.status(200).json({
        status: 'success',
        data: {
          merchant: merchantObj,
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async loginAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const { admin, accessToken, refreshToken } = await AuthService.loginAdmin(email, password);

      res.status(200).json({
        status: 'success',
        data: {
          admin,
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const tokens = await AuthService.refreshAccessToken(refreshToken);

      res.status(200).json({
        status: 'success',
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  }

  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      await AuthService.logout(refreshToken);

      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  public static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'fail', message: 'Not authenticated' });
        return;
      }

      const { userId, role } = req.user;
      
      let userObj: any = null;
      if (role === 'customer') {
        const customer = await Customer.findById(userId);
        if (customer) {
          userObj = customer.toObject();
          delete userObj.passwordHash;
        }
      } else if (role === 'merchant') {
        const merchant = await Merchant.findById(userId);
        if (merchant) {
          userObj = merchant.toObject();
          delete userObj.passwordHash;
        }
      } else if (role === 'admin') {
        userObj = { name: 'Administrador Geral', email: 'admin@trazpraca.com' };
      }

      if (!userObj) {
        res.status(404).json({ status: 'fail', message: 'User not found' });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: {
          user: userObj,
          role
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
