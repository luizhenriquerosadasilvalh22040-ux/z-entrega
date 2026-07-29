import Joi from 'joi';

export const createBannerSchema = Joi.object({
  imageUrl: Joi.string().uri({ scheme: ['http', 'https'] }).max(500).required(),
  title: Joi.string().trim().max(120).allow('').optional(),
  linkUrl: Joi.string()
    .trim()
    .max(500)
    .custom((value, helpers) => {
      if (!value) return value;
      if (value.startsWith('/')) return value;
      try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) ? value : helpers.error('string.uri');
      } catch {
        return helpers.error('string.uri');
      }
    })
    .allow('')
    .optional()
});
