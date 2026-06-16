import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth';

export interface IDecodedUser {
  userId: string;
  role: 'customer' | 'merchant' | 'admin';
}

// Extende a interface Request do Express globalmente
declare global {
  namespace Express {
    interface Request {
      user?: IDecodedUser;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  // 1. Tenta obter do cookie accessToken
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies: { [key: string]: string } = {};
    cookieHeader.split(';').forEach(c => {
      const parts = c.split('=');
      const name = parts[0].trim();
      const val = parts.slice(1).join('=');
      if (name && val) {
        cookies[name] = decodeURIComponent(val);
      }
    });
    token = cookies['accessToken'];
  }

  // 2. Fallback para header Authorization
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    res.status(401).json({ status: 'fail', message: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret) as IDecodedUser;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ status: 'fail', message: 'Invalid or expired token' });
  }
};

export const authorize = (allowedRoles: ('customer' | 'merchant' | 'admin')[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ status: 'fail', message: 'Not authenticated' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ status: 'fail', message: 'Unauthorized access' });
      return;
    }

    next();
  };
};
