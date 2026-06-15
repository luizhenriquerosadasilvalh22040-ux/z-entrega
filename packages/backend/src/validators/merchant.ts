import Joi from 'joi';

const OperatingHoursSchema = Joi.object({
  open: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
  close: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required()
});

export const updateMerchantProfileSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  phone: Joi.string().optional(),
  category: Joi.string().valid('Comida', 'Farmácia', 'Construção', 'Geral').optional()
});

export const updateOperatingHoursSchema = OperatingHoursSchema;

export const updatePaymentMethodsSchema = Joi.object({
  paymentMethods: Joi.array().items(Joi.string()).min(1).required()
});
