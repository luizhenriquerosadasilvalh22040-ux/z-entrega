import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';

export const validate = (schema: Schema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const details = error.details.map(detail => ({
        message: detail.message,
        path: detail.path
      }));
      
      res.status(400).json({
        status: 'fail',
        message: 'Validation error',
        errors: details
      });
      return;
    }

    // Substitui pelo valor limpo (stripUnknown)
    req[property] = value;
    next();
  };
};
