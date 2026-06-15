import Joi from 'joi';

export const createPromotionSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  discountPercentage: Joi.number().min(1).max(100).required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
  targetProducts: Joi.array().items(Joi.string()).optional()
});

export const updatePromotionSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  discountPercentage: Joi.number().min(1).max(100).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  isActive: Joi.boolean().optional(),
  targetProducts: Joi.array().items(Joi.string()).optional()
});
