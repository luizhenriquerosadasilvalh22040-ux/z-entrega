import { Router } from 'express';
import { BannerController } from '../controllers/BannerController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import { createBannerSchema } from '../validators/banner';

const router = Router();

// Obter banners ativos (público)
router.get('/', BannerController.list);

// Rotas administrativas (apenas admin)
router.post('/', authenticate, authorize(['admin']), validate(createBannerSchema), BannerController.create);
router.delete('/:id', authenticate, authorize(['admin']), BannerController.delete);

export default router;
