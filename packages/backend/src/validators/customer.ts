import Joi from 'joi';

const CoordinateSchema = Joi.object({
  lat: Joi.number().required(),
  lng: Joi.number().required()
});

export const updateCustomerProfileSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  phone: Joi.string().optional()
});

export const updateCustomerAddressSchema = Joi.object({
  street: Joi.string().required(),
  number: Joi.string().required(),
  neighborhood: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().length(2).uppercase().required(),
  zipCode: Joi.string().required(),
  coordinates: CoordinateSchema.optional()
});
