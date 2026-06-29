import { Router } from 'express';
import { UploadController } from '../controllers/UploadController';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import { uploadImageSchema } from '../validators/upload';

const router = Router();

// Rota protegida para upload de imagens
router.post('/', authenticate, validate(uploadImageSchema), UploadController.uploadImage);

export default router;
