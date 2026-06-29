import Joi from 'joi';

export const createBannerSchema = Joi.object({
  imageUrl: Joi.string().uri({ scheme: ['http', 'https'] }).max(500).required(),
  title: Joi.string().trim().max(120).allow('').optional()
});
