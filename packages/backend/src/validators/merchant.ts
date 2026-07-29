import Joi from 'joi';

const OperatingHoursSchema = Joi.object({
  open: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
  close: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required()
});

export const updateMerchantProfileSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  phone: Joi.string().optional(),
  category: Joi.string().valid('Comida', 'Farmácia', 'Construção', 'Geral').optional(),
  isForceClosed: Joi.boolean().optional()
});

export const updateOperatingHoursSchema = OperatingHoursSchema;

export const updatePaymentMethodsSchema = Joi.object({
  paymentMethods: Joi.array().items(Joi.string()).min(1).required()
});

export const completeMerchantBusinessProfileSchema = Joi.object({
  cnpj: Joi.string().pattern(/^\d{14}$/).required(),
  address: Joi.object({
    street: Joi.string().trim().min(2).max(120).required(),
    number: Joi.string().trim().min(1).max(20).required(),
    neighborhood: Joi.string().trim().min(2).max(80).required(),
    city: Joi.string().trim().min(2).max(80).required(),
    state: Joi.string().length(2).uppercase().required(),
    zipCode: Joi.string().pattern(/^\d{5}-?\d{3}$/).required()
  }).required()
});
