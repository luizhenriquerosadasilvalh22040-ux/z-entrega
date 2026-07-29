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

export const customerRequestOtpSchema = Joi.object({
  phone: Joi.string().required(),
  name: Joi.string().min(3).max(100).optional(),
  address: AddressSchema.optional(),
  termsAccepted: Joi.boolean().optional(),
  privacyAccepted: Joi.boolean().optional(),
  marketingConsent: Joi.boolean().optional()
});

export const customerVerifyOtpSchema = Joi.object({
  phone: Joi.string().required(),
  code: Joi.string().pattern(/^\d{6}$/).required()
});

export const merchantRegisterSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  phone: Joi.string().required(),
  category: Joi.string().valid('Comida', 'Farmácia', 'Construção', 'Geral').required(),
  termsAccepted: Joi.boolean().valid(true).required(),
  privacyAccepted: Joi.boolean().valid(true).required(),
  marketingConsent: Joi.boolean().optional()
});

export const merchantVerifyEmailSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().pattern(/^\d{6}$/).required()
});

export const merchantResendEmailSchema = Joi.object({
  email: Joi.string().email().required()
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('merchant', 'admin').required()
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required(),
  role: Joi.string().valid('merchant', 'admin').required()
});
