import Joi from 'joi';

const OptionSchema = Joi.object({
  name: Joi.string().trim().min(1).max(80).required(),
  price: Joi.number().precision(2).min(0).max(9999).required()
});

const OptionGroupSchema = Joi.object({
  name: Joi.string().trim().min(1).max(80).required(),
  required: Joi.boolean().required(),
  minSelect: Joi.number().integer().min(0).max(20).required(),
  maxSelect: Joi.number().integer().min(Joi.ref('minSelect')).max(20).required(),
  options: Joi.array().items(OptionSchema).min(1).max(30).required()
});

export const createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(500).allow('').required(),
  price: Joi.number().precision(2).min(0.01).max(99999).required(),
  category: Joi.string().trim().min(2).max(80).required(),
  image: Joi.string().uri().allow('').optional(),
  stockQuantity: Joi.number().integer().min(0).max(100000).optional(),
  optionGroups: Joi.array().items(OptionGroupSchema).max(10).optional()
});

export const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  description: Joi.string().trim().max(500).allow('').optional(),
  price: Joi.number().precision(2).min(0.01).max(99999).optional(),
  category: Joi.string().trim().min(2).max(80).optional(),
  image: Joi.string().uri().allow('').optional(),
  isAvailable: Joi.boolean().optional(),
  stockQuantity: Joi.number().integer().min(0).max(100000).optional(),
  optionGroups: Joi.array().items(OptionGroupSchema).max(10).optional()
}).min(1);

export const updateProductStockSchema = Joi.object({
  stockQuantity: Joi.number().integer().min(0).max(100000).optional(),
  isPaused: Joi.boolean().optional()
}).or('stockQuantity', 'isPaused');
