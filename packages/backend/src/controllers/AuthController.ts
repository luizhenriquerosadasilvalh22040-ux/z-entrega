import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { Customer } from '../models/Customer';
import { Merchant } from '../models/Merchant';

export class AuthController {
  private static setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 dia
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
    });
  }

  private static clearAuthCookies(res: Response): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict'
    });
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict'
    });
  }

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

      AuthController.setAuthCookies(res, accessToken, refreshToken);

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

      AuthController.setAuthCookies(res, accessToken, refreshToken);

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

      AuthController.setAuthCookies(res, accessToken, refreshToken);

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
      let refreshToken = req.body.refreshToken;
      
      // Fallback para ler do cookie refreshToken
      if (!refreshToken && req.headers.cookie) {
        const cookies: { [key: string]: string } = {};
        req.headers.cookie.split(';').forEach(c => {
          const parts = c.split('=');
          const name = parts[0].trim();
          const val = parts.slice(1).join('=');
          if (name && val) {
            cookies[name] = decodeURIComponent(val);
          }
        });
        refreshToken = cookies['refreshToken'];
      }

      if (!refreshToken) {
        res.status(400).json({ status: 'fail', message: 'Refresh token não fornecido' });
        return;
      }

      const tokens = await AuthService.refreshAccessToken(refreshToken);

      AuthController.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

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
      let refreshToken = req.body.refreshToken;

      // Fallback para ler do cookie refreshToken
      if (!refreshToken && req.headers.cookie) {
        const cookies: { [key: string]: string } = {};
        req.headers.cookie.split(';').forEach(c => {
          const parts = c.split('=');
          const name = parts[0].trim();
          const val = parts.slice(1).join('=');
          if (name && val) {
            cookies[name] = decodeURIComponent(val);
          }
        });
        refreshToken = cookies['refreshToken'];
      }

      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }

      AuthController.clearAuthCookies(res);

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

  public static async requestCustomerOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, name, address } = req.body;
      const { isNewUser } = await AuthService.requestCustomerOtp(phone, name, address);
      res.status(200).json({
        status: 'success',
        message: 'Código de verificação enviado para seu WhatsApp.',
        data: { isNewUser }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async verifyCustomerOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, code } = req.body;
      const { customer, accessToken, refreshToken } = await AuthService.verifyCustomerOtp(phone, code);

      const customerObj = customer.toObject();
      delete customerObj.passwordHash;
      delete customerObj.verificationCode;

      AuthController.setAuthCookies(res, accessToken, refreshToken);

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

  public static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, role } = req.body;
      await AuthService.forgotPassword(email, role);
      res.status(200).json({
        status: 'success',
        message: 'Código de redefinição de senha enviado.'
      });
    } catch (error) {
      next(error);
    }
  }

  public static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword, role } = req.body;
      await AuthService.resetPassword(token, newPassword, role);
      res.status(200).json({
        status: 'success',
        message: 'Senha redefinida com sucesso!'
      });
    } catch (error) {
      next(error);
    }
  }
}
