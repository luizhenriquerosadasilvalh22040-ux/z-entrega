import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (process.env.NODE_ENV === 'development') {
    logger.error('API Error: %s - Stack: %s', err.message, err.stack);
  } else {
    logger.error('API Error: %s', err.message);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
