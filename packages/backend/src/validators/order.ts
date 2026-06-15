import Joi from 'joi';

export const createOrderSchema = Joi.object({
  merchantId: Joi.string().required(),
  items: Joi.array().items(
    Joi.object({
      productId: Joi.string().required(),
      quantity: Joi.number().min(1).required()
    })
  ).min(1).required(),
  paymentMethod: Joi.string().required()
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid(
    'PENDING', 
    'ACCEPTED', 
    'PREPARING', 
    'READY', 
    'DISPATCHED', 
    'IN_TRANSIT', 
    'DELIVERED', 
    'CANCELLED'
  ).required()
});
