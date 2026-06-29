import Joi from 'joi';

export const createReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(500).allow('').optional()
});
