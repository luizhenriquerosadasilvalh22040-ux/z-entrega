import Joi from 'joi';

const CoordinateSchema = Joi.object({
  lat: Joi.number().required(),
  lng: Joi.number().required()
});

const AddressSchema = Joi.object({
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

const OperatingHoursSchema = Joi.object({
  open: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
  close: Joi.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).required()
});

export const customerRegisterSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  cpf: Joi.string().regex(/^\d{11}$/).required(), // CPF apenas números (11 digitos)
  phone: Joi.string().required(),
  address: AddressSchema.required()
});

export const customerRequestOtpSchema = Joi.object({
  phone: Joi.string().required(),
  name: Joi.string().min(3).max(100).optional(),
  address: AddressSchema.optional()
});

export const customerVerifyOtpSchema = Joi.object({
  phone: Joi.string().required(),
  code: Joi.string().required()
});

export const merchantRegisterSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  cnpj: Joi.string().regex(/^\d{14}$/).required(), // CNPJ apenas números (14 digitos)
  phone: Joi.string().required(),
  category: Joi.string().valid('Comida', 'Farmácia', 'Construção', 'Geral').required(),
  operatingHours: OperatingHoursSchema.required(),
  paymentMethods: Joi.array().items(Joi.string()).min(1).required(),
  address: AddressSchema.required()
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});
