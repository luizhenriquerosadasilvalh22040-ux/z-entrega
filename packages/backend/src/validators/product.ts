import Joi from 'joi';

export const createProductSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).required(),
  price: Joi.number().min(0.01).required(),
  category: Joi.string().required(),
  image: Joi.string().uri().optional()
});

export const updateProductSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).optional(),
  price: Joi.number().min(0.01).optional(),
  category: Joi.string().optional(),
  image: Joi.string().uri().optional(),
  isAvailable: Joi.boolean().optional()
});
