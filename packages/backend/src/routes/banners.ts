import { Router } from 'express';
import { BannerController } from '../controllers/BannerController';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// Obter banners ativos (público)
router.get('/', BannerController.list);

// Rotas administrativas (apenas admin)
router.post('/', authenticate, authorize(['admin']), BannerController.create);
router.delete('/:id', authenticate, authorize(['admin']), BannerController.delete);

export default router;
