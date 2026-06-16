import Joi from 'joi';

const OptionSchema = Joi.object({
  name: Joi.string().required(),
  price: Joi.number().min(0).required()
});

const OptionGroupSchema = Joi.object({
  name: Joi.string().required(),
  required: Joi.boolean().required(),
  minSelect: Joi.number().min(0).required(),
  maxSelect: Joi.number().min(0).required(),
  options: Joi.array().items(OptionSchema).min(1).required()
});

export const createProductSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).required(),
  price: Joi.number().min(0.01).required(),
  category: Joi.string().required(),
  image: Joi.string().uri().allow('').optional(),
  stockQuantity: Joi.number().integer().min(0).optional(),
  optionGroups: Joi.array().items(OptionGroupSchema).optional()
});

export const updateProductSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).optional(),
  price: Joi.number().min(0.01).optional(),
  category: Joi.string().optional(),
  image: Joi.string().uri().allow('').optional(),
  isAvailable: Joi.boolean().optional(),
  stockQuantity: Joi.number().integer().min(0).optional(),
  optionGroups: Joi.array().items(OptionGroupSchema).optional()
});
