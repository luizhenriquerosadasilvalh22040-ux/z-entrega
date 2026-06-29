import Joi from 'joi';

const uuid = Joi.string().uuid({ version: ['uuidv4'] });

export const subscribeSchema = Joi.object({
  cardToken: Joi.string().trim().min(8).max(300).required(),
  email: Joi.string().trim().email().max(160).required()
});

export const validateCouponSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]{3,32}$/).required(),
  merchantId: uuid.required(),
  subtotal: Joi.number().precision(2).min(0.01).max(99999).required()
});
