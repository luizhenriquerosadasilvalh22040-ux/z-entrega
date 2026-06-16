import Joi from 'joi';

const CoordinateSchema = Joi.object({
  lat: Joi.number().required(),
  lng: Joi.number().required()
});

const SavedAddressSchema = Joi.object({
  nickname: Joi.string().required(),
  street: Joi.string().required(),
  number: Joi.string().required(),
  neighborhood: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().length(2).uppercase().required(),
  zipCode: Joi.string().required(),
  coordinates: CoordinateSchema.optional(),
  complement: Joi.string().allow('').optional(),
  referencePoint: Joi.string().allow('').optional()
});

export const updateCustomerProfileSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  phone: Joi.string().optional(),
  savedAddresses: Joi.array().items(SavedAddressSchema).optional()
});

export const updateCustomerAddressSchema = Joi.object({
  street: Joi.string().required(),
  number: Joi.string().required(),
  neighborhood: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().length(2).uppercase().required(),
  zipCode: Joi.string().required(),
  coordinates: CoordinateSchema.optional(),
  complement: Joi.string().allow('').optional(),
  referencePoint: Joi.string().allow('').optional()
});
