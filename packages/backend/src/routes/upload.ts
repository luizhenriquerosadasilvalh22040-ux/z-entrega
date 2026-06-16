import { Router } from 'express';
import { UploadController } from '../controllers/UploadController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Rota protegida para upload de imagens
router.post('/', authenticate, UploadController.uploadImage);

export default router;
