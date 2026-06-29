import Joi from 'joi';
import { ORDER_STATUS } from '../domain/orderStatus';

const uuid = Joi.string().uuid({ version: ['uuidv4'] });

export const createOrderSchema = Joi.object({
  merchantId: uuid.required(),
  items: Joi.array().items(
    Joi.object({
      productId: uuid.required(),
      quantity: Joi.number().integer().min(1).max(99).required(),
      chosenOptions: Joi.array().items(
        Joi.object({
          groupName: Joi.string().trim().min(1).max(80).required(),
          optionName: Joi.string().trim().min(1).max(80).required(),
          price: Joi.number().precision(2).min(0).max(9999).required()
        })
      ).max(30).optional(),
      notes: Joi.string().trim().max(300).allow('').optional()
    })
  ).min(1).max(50).required(),
  paymentMethod: Joi.string().valid('PIX', 'Cartão', 'Dinheiro').required(),
  addressDetails: Joi.object({
    complement: Joi.string().trim().max(120).allow('').optional(),
    referencePoint: Joi.string().trim().max(160).allow('').optional()
  }).optional(),
  deliveryAddress: Joi.object({
    street: Joi.string().trim().min(2).max(120).required(),
    number: Joi.string().trim().min(1).max(20).required(),
    neighborhood: Joi.string().trim().min(2).max(80).required(),
    city: Joi.string().trim().min(2).max(80).required(),
    state: Joi.string().length(2).uppercase().required(),
    zipCode: Joi.string().pattern(/^\d{8}$/).required(),
    complement: Joi.string().trim().max(120).allow('').optional(),
    referencePoint: Joi.string().trim().max(160).allow('').optional(),
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required()
    }).optional()
  }).optional(),
  couponCode: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]{3,32}$/).optional(),
  cardToken: Joi.string().trim().max(300).optional(),
  paymentMethodId: Joi.string().trim().max(80).optional(),
  installments: Joi.number().integer().min(1).max(12).optional()
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid(...Object.values(ORDER_STATUS)).required()
});
