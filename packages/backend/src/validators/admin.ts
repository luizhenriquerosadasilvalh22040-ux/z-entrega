import Joi from 'joi';

const uuid = Joi.string().uuid({ version: ['uuidv4'] });

export const updateWhatsAppTemplateSchema = Joi.object({
  body: Joi.string().trim().min(1).max(1200).required(),
  isActive: Joi.boolean().optional(),
  locale: Joi.string().trim().pattern(/^[a-z]{2}-[A-Z]{2}$/).default('pt-BR').optional()
});

export const updateSettingsSchema = Joi.object({
  defaultSubscriptionPrice: Joi.number().precision(2).min(0).max(9999).required()
});

export const createDelivererSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  email: Joi.string().trim().email().max(160).required(),
  phone: Joi.string().trim().pattern(/^\+?\d{10,15}$/).required(),
  vehicle: Joi.string().valid('Moto', 'Bicicleta', 'Carro').required(),
  plate: Joi.string().trim().uppercase().max(12).allow('').optional(),
  isActiveToday: Joi.boolean().optional(),
  initialPassword: Joi.string().min(12).max(128).optional()
});

export const updateDelivererSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).optional(),
  email: Joi.string().trim().email().max(160).optional(),
  phone: Joi.string().trim().pattern(/^\+?\d{10,15}$/).optional(),
  vehicle: Joi.string().valid('Moto', 'Bicicleta', 'Carro').optional(),
  plate: Joi.string().trim().uppercase().max(12).allow('').optional(),
  isActive: Joi.boolean().optional()
}).min(1);

export const toggleActiveTodaySchema = Joi.object({
  isActiveToday: Joi.boolean().required()
});

export const toggleVerifyMerchantSchema = Joi.object({
  isVerified: Joi.boolean().required()
});

export const updateMerchantSubscriptionPriceSchema = Joi.object({
  subscriptionPrice: Joi.number().precision(2).min(0).max(9999).allow(null).optional()
}).required();

export const createCouponSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]{3,32}$/).required(),
  discountType: Joi.string().valid('PERCENTAGE', 'FIXED').required(),
  discountValue: Joi.when('discountType', {
    is: 'PERCENTAGE',
    then: Joi.number().precision(2).min(1).max(100).required(),
    otherwise: Joi.number().precision(2).min(0.01).max(9999).required()
  }),
  minOrderValue: Joi.number().precision(2).min(0).max(99999).allow(null).optional(),
  expirationDate: Joi.date().iso().greater('now').required(),
  merchantId: uuid.allow(null, '').optional(),
  maxUses: Joi.number().integer().min(1).max(100000).allow(null).optional()
});
