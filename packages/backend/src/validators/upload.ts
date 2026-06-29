import Joi from 'joi';

const MAX_BASE64_IMAGE_CHARS = Number(process.env.MAX_UPLOAD_BASE64_CHARS || 2_200_000);

export const uploadImageSchema = Joi.object({
  image: Joi.string()
    .max(MAX_BASE64_IMAGE_CHARS)
    .pattern(/^data:image\/(png|jpg|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/)
    .required()
});
