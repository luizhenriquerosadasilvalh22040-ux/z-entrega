import Joi from 'joi';

export const createOrderSchema = Joi.object({
  merchantId: Joi.string().required(),
  items: Joi.array().items(
    Joi.object({
      productId: Joi.string().required(),
      quantity: Joi.number().min(1).required(),
      chosenOptions: Joi.array().items(
        Joi.object({
          groupName: Joi.string().required(),
          optionName: Joi.string().required(),
          price: Joi.number().required()
        })
      ).optional(),
      notes: Joi.string().allow('').optional()
    })
  ).min(1).required(),
  paymentMethod: Joi.string().required(),
  addressDetails: Joi.object({
    complement: Joi.string().allow('').optional(),
    referencePoint: Joi.string().allow('').optional()
  }).optional(),
  deliveryAddress: Joi.object({
    street: Joi.string().required(),
    number: Joi.string().required(),
    neighborhood: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().length(2).uppercase().required(),
    zipCode: Joi.string().required(),
    complement: Joi.string().allow('').optional(),
    referencePoint: Joi.string().allow('').optional(),
    coordinates: Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required()
    }).optional()
  }).optional()
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid(
    'PENDING', 
    'PAID',
    'ACCEPTED', 
    'PREPARING', 
    'READY', 
    'DISPATCHED', 
    'IN_TRANSIT', 
    'DELIVERED', 
    'CANCELLED'
  ).required()
});
